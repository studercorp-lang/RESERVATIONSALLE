/**
 * Traitement complet d'une demande de réservation envoyée depuis le site :
 * validation → enregistrement (client, réservation, consentements, lien) → e-mails.
 */
import { ConsentType, type Booking } from "@prisma/client";
import { addDays } from "date-fns";
import { SITE, appUrl } from "@/config/site";
import { prisma } from "@/lib/db";
import { REJECTION_MESSAGES } from "@/lib/availability/rules";
import { deliver } from "@/lib/email/transport";
import { customerRequestReceived, teamNewRequest, type BookingMailData } from "@/lib/email/templates";
import { createManageToken } from "@/lib/security/tokens";
import { parisToUtc } from "@/lib/time";
import { bookingRequestSchema, fieldErrors, type BookingRequest } from "@/lib/validation/booking";
import { BookingRejectedError, reserveSlot } from "./reserve";

/** Validité du lien de gestion : jusqu'à 30 jours après la fin du créneau. */
export const MANAGE_LINK_DAYS_AFTER = 30;

export type BookingRequestResult =
  | {
      ok: true;
      booking: { reference: string; status: Booking["status"]; roomName: string; startsAt: string; endsAt: string; attendees: number; estimatedCents: number | null };
      emailSent: boolean;
    }
  | { ok: false; fieldErrors?: Record<string, string>; formError?: string };

export async function submitBookingRequest(raw: unknown, now = new Date()): Promise<BookingRequestResult> {
  const parsed = bookingRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const req: BookingRequest = parsed.data;

  const room = await prisma.room.findFirst({ where: { slug: req.roomSlug, active: true } });
  if (!room) return { ok: false, formError: REJECTION_MESSAGES.ROOM_INACTIVE };

  const startsAt = parisToUtc(req.slot.date, req.slot.startMin);
  const endsAt = parisToUtc(req.slot.date, req.slot.endMin);
  const { token, hash } = createManageToken();
  const c = req.contact;

  let booking: Booking;
  try {
    booking = await reserveSlot(
      {
        roomId: room.id,
        startsAt,
        endsAt,
        attendees: req.slot.attendees,
        comment: c.comment,
        customer: async (tx) => {
          // Un même e-mail = un même contact. On garde les coordonnées les plus récentes.
          // Le consentement marketing n'est jamais retiré ici : décocher la case
          // signifie seulement « pas de nouveau consentement ».
          const data = { firstName: c.firstName, lastName: c.lastName, phone: c.phone, company: c.company ?? null, lastContactAt: now };
          const customer = await tx.customer.upsert({
            where: { email: c.email },
            create: { email: c.email, ...data, marketingOptIn: req.marketingOptIn },
            update: { ...data, ...(req.marketingOptIn ? { marketingOptIn: true } : {}) },
          });
          return customer.id;
        },
        afterCreate: async (tx, b) => {
          const consents: { type: ConsentType; textVersion: string }[] = [{ type: ConsentType.TERMS, textVersion: SITE.termsVersion }];
          if (req.marketingOptIn) consents.push({ type: ConsentType.MARKETING, textVersion: SITE.marketingVersion });
          await tx.consent.createMany({
            data: consents.map((x) => ({ ...x, customerId: b.customerId, bookingId: b.id, granted: true, source: "formulaire", createdAt: now })),
          });
          await tx.booking.update({
            where: { id: b.id },
            data: { manageTokenHash: hash, manageTokenExpiry: addDays(b.endsAt, MANAGE_LINK_DAYS_AFTER) },
          });
        },
      },
      now,
    );
  } catch (error) {
    if (error instanceof BookingRejectedError) {
      return { ok: false, formError: error.reasons.map((r) => REJECTION_MESSAGES[r]).join(" ") };
    }
    throw error;
  }

  const mail: BookingMailData = {
    reference: booking.reference,
    status: booking.status,
    roomName: room.name,
    startsAt,
    endsAt,
    attendees: booking.attendees,
    estimatedCents: booking.estimatedCents,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    company: c.company,
    comment: c.comment,
    manageUrl: appUrl(`/reservation/${token}`),
  };

  // La demande est enregistrée même si l'envoi d'un e-mail échoue (l'équipe la voit dans le back-office).
  let emailSent = true;
  try {
    await deliver({ to: c.email, replyTo: SITE.contactEmail, ...customerRequestReceived(mail) });
  } catch {
    emailSent = false;
    console.error(`[email] échec de l'envoi de l'accusé de réception (réservation ${booking.id})`); // aucune donnée personnelle
  }
  try {
    if (process.env.EMAIL_TEAM) await deliver({ to: process.env.EMAIL_TEAM, replyTo: c.email, ...teamNewRequest(mail) });
  } catch {
    console.error(`[email] échec de la notification équipe (réservation ${booking.id})`);
  }

  return {
    ok: true,
    emailSent,
    booking: {
      reference: booking.reference,
      status: booking.status,
      roomName: room.name,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      attendees: booking.attendees,
      estimatedCents: booking.estimatedCents,
    },
  };
}
