/**
 * Gestion d'une réservation par le client, via le lien sécurisé reçu par e-mail
 * (sans compte). Chaque action revérifie le lien et les droits côté serveur.
 */
import { BookingStatus, ConsentType, type Booking, type Customer, type Room } from "@prisma/client";
import { addDays } from "date-fns";
import { SITE, appUrl } from "@/config/site";
import { prisma } from "@/lib/db";
import { ACTOR_CUSTOMER, audit } from "@/lib/audit/log";
import { REJECTION_MESSAGES } from "@/lib/availability/rules";
import { deliver } from "@/lib/email/transport";
import { customerCancelled, customerModified, teamClientChange, type BookingMailData } from "@/lib/email/templates";
import { hashToken } from "@/lib/security/tokens";
import { getSettings, type Settings } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";
import { contactSchema, fieldErrors, slotSchema } from "@/lib/validation/booking";
import { cancellationFeePercent } from "./cancellation";
import { MANAGE_LINK_DAYS_AFTER } from "./request";
import { BookingRejectedError, rescheduleBooking } from "./reserve";

export type ManagedBooking = Booking & { room: Room; customer: Customer };
export type ActionResult = { ok: true; message: string } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;
const INVALID_LINK = "Ce lien n'est plus valide. Contactez-nous si besoin.";

/** Retrouve la réservation correspondant au lien ; null si lien inconnu, expiré ou données effacées. */
export async function findBookingByToken(token: string, now = new Date()): Promise<ManagedBooking | null> {
  if (!TOKEN_FORMAT.test(token)) return null;
  const booking = await prisma.booking.findUnique({
    where: { manageTokenHash: hashToken(token) },
    include: { room: true, customer: true },
  });
  if (!booking || !booking.manageTokenExpiry || booking.manageTokenExpiry <= now || booking.customer.anonymizedAt) return null;
  return booking;
}

/** Ce que le client peut faire, et à quelles conditions. */
export function clientPermissions(b: Booking, cfg: Settings, now: Date) {
  const pendingAlive = b.status === BookingStatus.PENDING && (!b.pendingExpiresAt || b.pendingExpiresAt > now);
  const active = pendingAlive || b.status === BookingStatus.CONFIRMED;
  const notStarted = b.startsAt > now;
  const beforeDeadline = b.startsAt.getTime() - cfg.clientChangeDeadlineHours * 3_600_000 > now.getTime();
  return {
    active,
    canCancel: active && notStarted,
    // Une fois la réservation confirmée (devis), les modifications passent par l'équipe.
    canModify: pendingAlive && beforeDeadline,
    modifyBlockedReason: !active
      ? null
      : b.status === BookingStatus.CONFIRMED
        ? "confirmed"
        : !beforeDeadline
          ? "deadline"
          : null,
    canEditContact: active,
    feePercent: b.status === BookingStatus.CONFIRMED ? cancellationFeePercent(b.startsAt, now, cfg) : 0,
  };
}

export function mailData(b: ManagedBooking, token?: string): BookingMailData {
  return {
    reference: b.reference,
    status: b.status,
    roomName: b.room.name,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    attendees: b.attendees,
    estimatedCents: b.estimatedCents,
    firstName: b.customer.firstName,
    lastName: b.customer.lastName,
    email: b.customer.email,
    phone: b.customer.phone,
    company: b.customer.company,
    comment: b.comment,
    manageUrl: token ? appUrl(`/reservation/${token}`) : undefined,
  };
}

/** Envoie les e-mails sans jamais faire échouer l'action (la modification est déjà enregistrée). */
async function notify(bookingId: string, mails: { to?: string; subject: string; html: string; text: string; replyTo?: string }[]) {
  for (const m of mails) {
    if (!m.to) continue;
    try {
      await deliver({ ...m, to: m.to });
    } catch {
      console.error(`[email] échec d'envoi (réservation ${bookingId})`);
    }
  }
}

/** Annulation par le client. Les frais éventuels sont ceux affichés avant validation. */
export async function cancelByClient(token: string, now = new Date()): Promise<ActionResult> {
  const b = await findBookingByToken(token, now);
  if (!b) return { ok: false, error: INVALID_LINK };
  const perms = clientPermissions(b, await getSettings(), now);
  if (!perms.canCancel) return { ok: false, error: "Cette réservation ne peut plus être annulée en ligne. Contactez-nous." };

  const updated = await prisma.$transaction(async (tx) => {
    // Mise à jour conditionnelle : si l'équipe a changé le statut entre-temps, on ne touche à rien.
    const res = await tx.booking.updateMany({
      where: { id: b.id, status: b.status },
      data: { status: BookingStatus.CANCELLED, cancelledAt: now },
    });
    if (res.count === 0) return false;
    await audit({ actorLabel: ACTOR_CUSTOMER, action: "booking.cancel", entityType: "Booking", entityId: b.id, details: { previousStatus: b.status, feePercent: perms.feePercent } }, tx);
    return true;
  });
  if (!updated) return { ok: false, error: "La réservation a été modifiée entre-temps. Rechargez la page." };

  const d = { ...mailData({ ...b, status: BookingStatus.CANCELLED }), feePercent: perms.feePercent };
  await notify(b.id, [
    { to: b.customer.email, replyTo: SITE.contactEmail, ...customerCancelled(d) },
    { to: process.env.EMAIL_TEAM, ...teamClientChange(d, perms.feePercent > 0 ? `Annulation (frais ${perms.feePercent} %)` : "Annulation") },
  ]);
  return {
    ok: true,
    message: perms.feePercent > 0
      ? `Votre réservation est annulée. Des frais de ${perms.feePercent} % du montant du devis s'appliquent ; notre équipe vous recontacte.`
      : "Votre réservation est annulée, sans frais. Un e-mail de confirmation vous a été envoyé.",
  };
}

/** Changement de date / horaires / nombre de personnes (même salle) d'une demande en attente. */
export async function modifyByClient(token: string, raw: unknown, now = new Date()): Promise<ActionResult> {
  const b = await findBookingByToken(token, now);
  if (!b) return { ok: false, error: INVALID_LINK };
  const cfg = await getSettings();
  if (!clientPermissions(b, cfg, now).canModify) return { ok: false, error: "Cette demande ne peut plus être modifiée en ligne. Contactez-nous." };

  const parsed = slotSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const slot = parsed.data;
  const startsAt = parisToUtc(slot.date, slot.startMin);
  const endsAt = parisToUtc(slot.date, slot.endMin);

  let updated: Booking;
  try {
    updated = await rescheduleBooking(b.id, { roomId: b.roomId, startsAt, endsAt, attendees: slot.attendees }, now, cfg, async (tx, nb) => {
      await tx.booking.update({ where: { id: nb.id }, data: { manageTokenExpiry: addDays(nb.endsAt, MANAGE_LINK_DAYS_AFTER) } });
      await audit({
        actorLabel: ACTOR_CUSTOMER, action: "booking.reschedule", entityType: "Booking", entityId: b.id,
        details: { from: { startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), attendees: b.attendees }, to: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), attendees: slot.attendees } },
      }, tx);
    });
  } catch (error) {
    if (error instanceof BookingRejectedError) return { ok: false, error: error.reasons.map((r) => REJECTION_MESSAGES[r]).join(" ") };
    throw error;
  }

  const d = mailData({ ...b, ...updated }, token);
  await notify(b.id, [
    { to: b.customer.email, replyTo: SITE.contactEmail, ...customerModified(d) },
    { to: process.env.EMAIL_TEAM, ...teamClientChange(d, "Modification de créneau") },
  ]);
  return { ok: true, message: "Votre demande a été modifiée. Un e-mail récapitulatif vous a été envoyé." };
}

const contactUpdateSchema = contactSchema.pick({ lastName: true, firstName: true, phone: true, company: true });

/** Correction des coordonnées (droit de rectification). L'e-mail se change via l'équipe. */
export async function updateContactByClient(token: string, raw: unknown, now = new Date()): Promise<ActionResult> {
  const b = await findBookingByToken(token, now);
  if (!b) return { ok: false, error: INVALID_LINK };
  if (!clientPermissions(b, await getSettings(), now).canEditContact) return { ok: false, error: "Contactez-nous pour corriger vos coordonnées." };
  const parsed = contactUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const c = parsed.data;
  const changed = (["lastName", "firstName", "phone", "company"] as const).filter((k) => (b.customer[k] ?? null) !== (c[k] ?? null));
  if (changed.length) {
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: b.customerId }, data: { lastName: c.lastName, firstName: c.firstName, phone: c.phone, company: c.company ?? null } });
      await audit({ actorLabel: ACTOR_CUSTOMER, action: "customer.rectify", entityType: "Customer", entityId: b.customerId, details: { fields: changed } }, tx);
    });
  }
  return { ok: true, message: "Vos coordonnées ont été mises à jour." };
}

/** Retrait du consentement à la prospection commerciale (toujours possible, même après la réservation). */
export async function withdrawMarketingByClient(token: string, now = new Date()): Promise<ActionResult> {
  const b = await findBookingByToken(token, now);
  if (!b) return { ok: false, error: INVALID_LINK };
  if (b.customer.marketingOptIn) {
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: b.customerId }, data: { marketingOptIn: false } });
      await tx.consent.create({ data: { customerId: b.customerId, bookingId: b.id, type: ConsentType.MARKETING, granted: false, textVersion: SITE.marketingVersion, source: "lien-gestion", createdAt: now } });
      await audit({ actorLabel: ACTOR_CUSTOMER, action: "consent.withdraw", entityType: "Customer", entityId: b.customerId, details: { type: "MARKETING" } }, tx);
    });
  }
  return { ok: true, message: "C'est noté : vous ne recevrez plus d'informations commerciales de notre part." };
}
