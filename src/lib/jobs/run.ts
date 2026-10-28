/**
 * Tâches automatiques, à lancer toutes les heures (voir README) :
 * - expiration des demandes non traitées (libère les créneaux) ;
 * - passage en « terminée » des réservations confirmées passées ;
 * - e-mail de rappel avant le créneau ;
 * - application des durées de conservation (RGPD) : anonymisation des clients,
 *   suppression du texte libre des anciennes réservations, purge du journal
 *   d'audit, des sessions expirées et des compteurs anti-abus.
 * Chaque tâche est idempotente : la relancer ne produit pas de doublon.
 * Les journaux n'affichent que des nombres, jamais de données personnelles.
 */
import { BookingStatus } from "@prisma/client";
import { addDays, subMonths, subYears } from "date-fns";
import { SITE } from "@/config/site";
import { prisma } from "@/lib/db";
import { ACTOR_SYSTEM, audit } from "@/lib/audit/log";
import { expireStalePending } from "@/lib/availability/queries";
import { mailData } from "@/lib/booking/manage";
import { MANAGE_LINK_DAYS_AFTER } from "@/lib/booking/request";
import { deliver } from "@/lib/email/transport";
import { customerReminder } from "@/lib/email/templates";
import { anonymizeCustomer } from "@/lib/gdpr/person";
import { createManageToken } from "@/lib/security/tokens";
import { getSettings, type Settings } from "@/lib/settings";

export type JobReport = Record<string, number>;

/** Demandes en attente non traitées dans le délai → EXPIRED. */
export async function expirePending(now: Date) {
  return (await expireStalePending(now)).count;
}

/** Réservations confirmées dont le créneau est passé → COMPLETED. */
export async function completePast(now: Date) {
  return (await prisma.booking.updateMany({ where: { status: BookingStatus.CONFIRMED, endsAt: { lte: now } }, data: { status: BookingStatus.COMPLETED } })).count;
}

/** Rappel envoyé une seule fois, N heures avant le début d'une réservation confirmée. */
export async function sendReminders(now: Date, cfg: Settings) {
  const due = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      reminderSentAt: null,
      startsAt: { gt: now, lte: new Date(now.getTime() + cfg.reminderHoursBefore * 3_600_000) },
      customer: { anonymizedAt: null },
    },
    include: { room: true, customer: true },
  });
  let sent = 0;
  for (const b of due) {
    // On marque d'abord (pas de double envoi si deux tâches tournent en même temps)
    const claimed = await prisma.booking.updateMany({ where: { id: b.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (!claimed.count) continue;
    const { token, hash } = createManageToken();
    await prisma.booking.update({ where: { id: b.id }, data: { manageTokenHash: hash, manageTokenExpiry: addDays(b.endsAt, MANAGE_LINK_DAYS_AFTER) } });
    try {
      await deliver({ to: b.customer.email, replyTo: SITE.contactEmail, ...customerReminder(mailData(b, token)) });
      sent++;
    } catch {
      // Échec : on retentera à la prochaine exécution
      await prisma.booking.update({ where: { id: b.id }, data: { reminderSentAt: null } });
      console.error(`[rappel] échec d'envoi (réservation ${b.id})`);
    }
  }
  return sent;
}

/**
 * Durées de conservation.
 * - Une réservation dont le créneau date de plus de N ans perd son texte libre.
 * - Un client est anonymisé quand sa dernière réservation date de plus de N ans
 *   ET qu'il n'a pas de consentement de prospection encore valable
 *   (consentement donné ET dernier contact il y a moins de 3 ans).
 */
export async function applyRetention(now: Date, cfg: Settings) {
  // Purge du journal d'abord : les traces ajoutées ci-dessous ne doivent jamais être concernées
  const auditPurged = (await prisma.auditLog.deleteMany({ where: { createdAt: { lt: subMonths(now, cfg.retentionAuditMonths) } } })).count;

  const bookingLimit = subYears(now, cfg.retentionBookingYears);
  const prospectLimit = subYears(now, cfg.retentionProspectYears);

  const cleanedBookings = (
    await prisma.booking.updateMany({
      where: { endsAt: { lt: bookingLimit }, OR: [{ comment: { not: null } }, { internalNote: { not: null } }, { manageTokenHash: { not: null } }] },
      data: { comment: null, internalNote: null, manageTokenHash: null, manageTokenExpiry: null },
    })
  ).count;

  // Consentement de prospection expiré (plus de contact depuis N ans) → retiré
  const expiredConsents = (
    await prisma.customer.updateMany({ where: { anonymizedAt: null, marketingOptIn: true, lastContactAt: { lt: prospectLimit } }, data: { marketingOptIn: false } })
  ).count;

  const candidates = await prisma.customer.findMany({
    where: {
      anonymizedAt: null,
      marketingOptIn: false,
      lastContactAt: { lt: bookingLimit },
      bookings: { none: { endsAt: { gte: bookingLimit } } },
    },
    select: { id: true },
  });
  for (const c of candidates) {
    await prisma.$transaction(async (tx) => {
      await anonymizeCustomer(tx, c.id, now);
      await audit({ actorLabel: ACTOR_SYSTEM, action: "customer.erase", entityType: "Customer", entityId: c.id, details: { reason: "durée de conservation atteinte" } }, tx);
    });
  }

  const sessionsPurged = (await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  const rateLimitsPurged = (await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: addDays(now, -1) } } })).count;

  return { cleanedBookings, expiredConsents, anonymizedCustomers: candidates.length, auditPurged, sessionsPurged, rateLimitsPurged };
}

/** Lance toutes les tâches et renvoie un résumé chiffré. */
export async function runJobs(now = new Date()): Promise<JobReport> {
  const cfg = await getSettings();
  const report: JobReport = {
    expiredRequests: await expirePending(now),
    completedBookings: await completePast(now),
    remindersSent: await sendReminders(now, cfg),
    ...(await applyRetention(now, cfg)),
  };
  return report;
}
