/**
 * Accès base de données pour la disponibilité.
 * Aucune de ces fonctions ne renvoie d'information sur les clients :
 * seulement des plages horaires occupées.
 */
import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Interval } from "./rules";

/**
 * Filtre « réservation active » : en attente (non expirée) ou confirmée.
 * Une demande en attente dont le délai est dépassé ne bloque plus le créneau,
 * même si la tâche automatique ne l'a pas encore passée en EXPIRED.
 */
export function activeBookingWhere(now: Date): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: BookingStatus.CONFIRMED },
      { status: BookingStatus.PENDING, OR: [{ pendingExpiresAt: null }, { pendingExpiresAt: { gt: now } }] },
    ],
  };
}

/** Plages bloquées par des réservations actives, par salle, sur la période [from, to). */
export async function getBusyByRoom(
  roomIds: string[],
  from: Date,
  to: Date,
  now: Date,
  db: Prisma.TransactionClient = prisma,
  excludeBookingId?: string, // la réservation en cours de modification ne se bloque pas elle-même
): Promise<Map<string, Interval[]>> {
  const rows = await db.booking.findMany({
    where: {
      roomId: { in: roomIds },
      startsAt: { lt: to },
      blockedUntil: { gt: from },
      ...activeBookingWhere(now),
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { roomId: true, startsAt: true, blockedUntil: true }, // jamais de données client
    orderBy: { startsAt: "asc" },
  });
  const map = new Map<string, Interval[]>(roomIds.map((id) => [id, []]));
  for (const r of rows) map.get(r.roomId)!.push({ start: r.startsAt, end: r.blockedUntil });
  return map;
}

/** Fermetures exceptionnelles (propres à la salle ou générales) sur la période [from, to). */
export async function getClosuresByRoom(
  roomIds: string[],
  from: Date,
  to: Date,
  db: Prisma.TransactionClient = prisma,
): Promise<Map<string, Interval[]>> {
  const rows = await db.closure.findMany({
    where: { startsAt: { lt: to }, endsAt: { gt: from }, OR: [{ roomId: null }, { roomId: { in: roomIds } }] },
    select: { roomId: true, startsAt: true, endsAt: true },
  });
  const map = new Map<string, Interval[]>(roomIds.map((id) => [id, []]));
  for (const c of rows) {
    const interval = { start: c.startsAt, end: c.endsAt };
    if (c.roomId) map.get(c.roomId)?.push(interval);
    else for (const list of map.values()) list.push(interval);
  }
  return map;
}

/** Passe en EXPIRED les demandes en attente dont le délai est dépassé (libère les créneaux). */
export async function expireStalePending(now: Date, db: Prisma.TransactionClient = prisma, roomId?: string) {
  return db.booking.updateMany({
    where: { status: BookingStatus.PENDING, pendingExpiresAt: { lte: now }, ...(roomId ? { roomId } : {}) },
    data: { status: BookingStatus.EXPIRED },
  });
}

/** L'erreur renvoyée par PostgreSQL vient-elle de la contrainte anti-double réservation ? */
export function isOverlapViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("bookings_no_overlap") || message.includes("23P01");
}
