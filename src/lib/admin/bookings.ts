/**
 * Actions de l'équipe sur les réservations (back-office).
 * Chaque action est vérifiée côté serveur, tracée dans le journal d'audit,
 * et peut prévenir le client par e-mail.
 */
import { BookingSource, BookingStatus, ConsentType, Prisma, type Booking } from "@prisma/client";
import { addDays } from "date-fns";
import { SITE } from "@/config/site";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/log";
import { REJECTION_MESSAGES } from "@/lib/availability/rules";
import { isOverlapViolation } from "@/lib/availability/queries";
import { mailData, type ManagedBooking } from "@/lib/booking/manage";
import { MANAGE_LINK_DAYS_AFTER } from "@/lib/booking/request";
import { BookingRejectedError, rescheduleBooking, reserveSlot } from "@/lib/booking/reserve";
import { deliver } from "@/lib/email/transport";
import {
  customerCancelledByTeam,
  customerConfirmed,
  customerRefused,
  customerRequestReceived,
  customerRescheduledByTeam,
} from "@/lib/email/templates";
import { createManageToken } from "@/lib/security/tokens";
import { getSettings } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";
import { contactSchema, fieldErrors, slotSchema } from "@/lib/validation/booking";

export type Actor = { id: string; label: string };
export type AdminResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const ACTIVE: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

async function load(id: string): Promise<ManagedBooking | null> {
  return prisma.booking.findUnique({ where: { id }, include: { room: true, customer: true } });
}

/** Nouveau lien de gestion (l'ancien cesse de fonctionner) — à inclure dans l'e-mail envoyé. */
async function rotateToken(tx: Prisma.TransactionClient, b: Booking): Promise<string> {
  const { token, hash } = createManageToken();
  await tx.booking.update({ where: { id: b.id }, data: { manageTokenHash: hash, manageTokenExpiry: addDays(b.endsAt, MANAGE_LINK_DAYS_AFTER) } });
  return token;
}

async function send(bookingId: string, to: string, mail: { subject: string; html: string; text: string }) {
  try {
    await deliver({ to, replyTo: SITE.contactEmail, ...mail });
    return true;
  } catch {
    console.error(`[email] échec d'envoi (réservation ${bookingId})`);
    return false;
  }
}

const canEmail = (b: ManagedBooking) => !b.customer.anonymizedAt;

/** Confirme une demande (en attente, ou expirée si le créneau est toujours libre). */
export async function confirmBooking(id: string, actor: Actor, opts: { notify: boolean; message?: string }, now = new Date()): Promise<AdminResult> {
  const b = await load(id);
  if (!b) return { ok: false, error: "Réservation introuvable." };
  if (b.status !== BookingStatus.PENDING && b.status !== BookingStatus.EXPIRED) return { ok: false, error: "Seule une demande en attente ou expirée peut être confirmée." };
  if (b.startsAt <= now) return { ok: false, error: "Ce créneau est déjà passé." };
  let token: string | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      const res = await tx.booking.updateMany({
        where: { id, status: b.status },
        data: { status: BookingStatus.CONFIRMED, decidedAt: now, pendingExpiresAt: null },
      });
      if (res.count === 0) throw new Error("CONCURRENT");
      if (opts.notify && canEmail(b)) token = await rotateToken(tx, b);
      await audit({ actorId: actor.id, actorLabel: actor.label, action: "booking.confirm", entityType: "Booking", entityId: id, details: { from: b.status, notified: opts.notify } }, tx);
    });
  } catch (error) {
    // Une demande expirée dont le créneau a été repris entre-temps ne peut pas être confirmée
    if (isOverlapViolation(error)) return { ok: false, error: "Le créneau a été réservé par quelqu'un d'autre entre-temps." };
    if (error instanceof Error && error.message === "CONCURRENT") return { ok: false, error: "La réservation a changé entre-temps : rechargez la page." };
    throw error;
  }
  if (token) await send(id, b.customer.email, customerConfirmed(mailData({ ...b, status: BookingStatus.CONFIRMED }, token), opts.message));
  return { ok: true };
}

/** Refuse une demande en attente (libère le créneau). */
export async function refuseBooking(id: string, actor: Actor, opts: { notify: boolean; message?: string }, now = new Date()): Promise<AdminResult> {
  const b = await load(id);
  if (!b) return { ok: false, error: "Réservation introuvable." };
  if (b.status !== BookingStatus.PENDING) return { ok: false, error: "Seule une demande en attente peut être refusée." };
  const res = await prisma.$transaction(async (tx) => {
    const r = await tx.booking.updateMany({ where: { id, status: BookingStatus.PENDING }, data: { status: BookingStatus.REFUSED, decidedAt: now, pendingExpiresAt: null } });
    if (r.count) await audit({ actorId: actor.id, actorLabel: actor.label, action: "booking.refuse", entityType: "Booking", entityId: id, details: { notified: opts.notify } }, tx);
    return r.count;
  });
  if (!res) return { ok: false, error: "La réservation a changé entre-temps : rechargez la page." };
  if (opts.notify && canEmail(b)) await send(id, b.customer.email, customerRefused(mailData({ ...b, status: BookingStatus.REFUSED }), opts.message));
  return { ok: true };
}

/** Annulation par l'équipe (libère le créneau). */
export async function cancelBookingByTeam(id: string, actor: Actor, opts: { notify: boolean; message?: string }, now = new Date()): Promise<AdminResult> {
  const b = await load(id);
  if (!b) return { ok: false, error: "Réservation introuvable." };
  if (!ACTIVE.includes(b.status)) return { ok: false, error: "Cette réservation n'est pas active." };
  const res = await prisma.$transaction(async (tx) => {
    const r = await tx.booking.updateMany({ where: { id, status: b.status }, data: { status: BookingStatus.CANCELLED, cancelledAt: now } });
    if (r.count) await audit({ actorId: actor.id, actorLabel: actor.label, action: "booking.cancel", entityType: "Booking", entityId: id, details: { by: "team", from: b.status, notified: opts.notify } }, tx);
    return r.count;
  });
  if (!res) return { ok: false, error: "La réservation a changé entre-temps : rechargez la page." };
  if (opts.notify && canEmail(b)) await send(id, b.customer.email, customerCancelledByTeam(mailData({ ...b, status: BookingStatus.CANCELLED }), opts.message));
  return { ok: true };
}

/** Marque une réservation confirmée comme terminée (créneau passé). */
export async function completeBooking(id: string, actor: Actor): Promise<AdminResult> {
  const r = await prisma.booking.updateMany({ where: { id, status: BookingStatus.CONFIRMED }, data: { status: BookingStatus.COMPLETED } });
  if (!r.count) return { ok: false, error: "Seule une réservation confirmée peut être marquée terminée." };
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "booking.complete", entityType: "Booking", entityId: id });
  return { ok: true };
}

/** Note interne (jamais visible du client). */
export async function updateInternalNote(id: string, actor: Actor, note: string): Promise<AdminResult> {
  const clean = note.trim().slice(0, 2000) || null;
  await prisma.booking.update({ where: { id }, data: { internalNote: clean } });
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "booking.note", entityType: "Booking", entityId: id });
  return { ok: true };
}

/** Déplacement par l'équipe : date, horaires, personnes ET salle. Délais en ligne non appliqués. */
export async function rescheduleByTeam(
  id: string,
  actor: Actor,
  raw: { roomId: string; date: unknown; startMin: unknown; endMin: unknown; attendees: unknown },
  opts: { notify: boolean; message?: string },
  now = new Date(),
): Promise<AdminResult> {
  const b = await load(id);
  if (!b) return { ok: false, error: "Réservation introuvable." };
  const parsed = slotSchema.safeParse({ date: raw.date, startMin: raw.startMin, endMin: raw.endMin, attendees: raw.attendees });
  if (!parsed.success) return { ok: false, error: "Créneau invalide.", fieldErrors: fieldErrors(parsed.error) };
  const s = parsed.data;
  const startsAt = parisToUtc(s.date, s.startMin);
  const endsAt = parisToUtc(s.date, s.endMin);
  let token: string | undefined;
  let updated: Booking;
  try {
    updated = await rescheduleBooking(id, { roomId: raw.roomId, startsAt, endsAt, attendees: s.attendees, byTeam: true }, now, undefined, async (tx, nb) => {
      if (opts.notify && canEmail(b)) token = await rotateToken(tx, nb);
      else await tx.booking.update({ where: { id }, data: { manageTokenExpiry: addDays(nb.endsAt, MANAGE_LINK_DAYS_AFTER) } });
      await audit({
        actorId: actor.id, actorLabel: actor.label, action: "booking.reschedule", entityType: "Booking", entityId: id,
        details: { from: { roomId: b.roomId, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), attendees: b.attendees }, to: { roomId: raw.roomId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), attendees: s.attendees } },
      }, tx);
    });
  } catch (error) {
    if (error instanceof BookingRejectedError) return { ok: false, error: error.reasons.map((r) => REJECTION_MESSAGES[r]).join(" ") };
    throw error;
  }
  if (token) {
    const fresh = (await load(id))!;
    await send(id, b.customer.email, customerRescheduledByTeam(mailData({ ...fresh, ...updated }, token), opts.message));
  }
  return { ok: true };
}

/**
 * Saisie manuelle par l'équipe (demande reçue par téléphone, sur place…).
 * Pas de case marketing : un consentement oral n'est pas prouvable.
 */
export async function createBookingByTeam(
  actor: Actor,
  raw: { roomId: string; slot: unknown; contact: unknown; status: "PENDING" | "CONFIRMED"; sendEmail: boolean; termsInformed: boolean },
  now = new Date(),
): Promise<AdminResult> {
  const slot = slotSchema.safeParse(raw.slot);
  const contact = contactSchema.safeParse(raw.contact);
  const errors = { ...(slot.success ? {} : fieldErrors(slot.error)), ...(contact.success ? {} : fieldErrors(contact.error)) };
  if (!raw.termsInformed) errors.termsInformed = "Confirmez que le client a été informé des conditions de réservation.";
  if (!slot.success || !contact.success || Object.keys(errors).length) return { ok: false, error: "Merci de corriger les champs signalés.", fieldErrors: errors };
  const s = slot.data;
  const c = contact.data;
  const startsAt = parisToUtc(s.date, s.startMin);
  const endsAt = parisToUtc(s.date, s.endMin);
  const settings = await getSettings();
  const { token, hash } = createManageToken();

  let booking: Booking;
  try {
    booking = await reserveSlot(
      {
        roomId: raw.roomId, startsAt, endsAt, attendees: s.attendees, comment: c.comment, source: BookingSource.BACKOFFICE, byTeam: true,
        customer: async (tx) => {
          const data = { firstName: c.firstName, lastName: c.lastName, phone: c.phone, company: c.company ?? null, lastContactAt: now };
          return (await tx.customer.upsert({ where: { email: c.email }, create: { email: c.email, ...data }, update: data })).id;
        },
        afterCreate: async (tx, b) => {
          const confirmed = raw.status === "CONFIRMED";
          await tx.booking.update({
            where: { id: b.id },
            data: {
              manageTokenHash: hash, manageTokenExpiry: addDays(b.endsAt, MANAGE_LINK_DAYS_AFTER),
              ...(confirmed ? { status: BookingStatus.CONFIRMED, decidedAt: now, pendingExpiresAt: null } : {}),
            },
          });
          await tx.consent.create({ data: { customerId: b.customerId, bookingId: b.id, type: ConsentType.TERMS, granted: true, textVersion: SITE.termsVersion, source: "back-office (client informé par l'équipe)", createdAt: now } });
          await audit({ actorId: actor.id, actorLabel: actor.label, action: "booking.create", entityType: "Booking", entityId: b.id, details: { source: "BACKOFFICE", status: raw.status } }, tx);
        },
      },
      now,
      { ...settings, autoConfirm: false },
    );
  } catch (error) {
    if (error instanceof BookingRejectedError) return { ok: false, error: error.reasons.map((r) => REJECTION_MESSAGES[r]).join(" ") };
    throw error;
  }
  if (raw.sendEmail) {
    const b = (await load(booking.id))!;
    await send(b.id, c.email, raw.status === "CONFIRMED" ? customerConfirmed(mailData(b, token)) : customerRequestReceived(mailData(b, token)));
  }
  return { ok: true, id: booking.id };
}

// ---------------------------------------------------------------------------
// Liste, filtres, export
// ---------------------------------------------------------------------------

export type BookingFilters = { status?: string; roomId?: string; from?: string; to?: string; q?: string; customerId?: string };

export function bookingWhere(f: BookingFilters): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};
  if (f.status && f.status in BookingStatus) where.status = f.status as BookingStatus;
  if (f.roomId) where.roomId = f.roomId;
  if (f.customerId) where.customerId = f.customerId;
  const range: Prisma.DateTimeFilter = {};
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) range.gte = parisToUtc(f.from, 0);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) range.lt = parisToUtc(f.to, 1440);
  if (range.gte || range.lt) where.startsAt = range;
  const q = f.q?.trim();
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { customer: { email: { contains: q, mode: "insensitive" } } },
      { customer: { lastName: { contains: q, mode: "insensitive" } } },
      { customer: { firstName: { contains: q, mode: "insensitive" } } },
      { customer: { company: { contains: q, mode: "insensitive" } } },
    ];
  }
  return where;
}
