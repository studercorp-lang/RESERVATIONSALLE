/**
 * Règles de disponibilité « pures » (sans base de données), faciles à tester.
 *
 * Toutes les heures reçues sont des instants UTC ; les règles qui dépendent de
 * l'heure locale (horaires d'ouverture, jours) sont évaluées à l'heure de Paris.
 */
import { addMonths } from "date-fns";
import type { Settings } from "@/lib/settings";
import { parisToUtc, utcToParis } from "@/lib/time";

/** Les horaires de début et de fin doivent tomber sur un pas de 15 minutes. */
export const SLOT_STEP_MIN = 15;

export type RoomRules = {
  capacity: number;
  minDurationMin: number;
  maxDurationMin: number;
  bufferMin: number;
  active: boolean;
  openingHours: { weekday: number; openMin: number; closeMin: number; lastStartMin?: number | null }[];
};

export type Interval = { start: Date; end: Date };

/** Codes d'erreur métier (traduits pour l'affichage dans `REJECTION_MESSAGES`). */
export type RejectionReason =
  | "ROOM_INACTIVE"
  | "INVALID_RANGE"
  | "NOT_ON_GRID"
  | "IN_PAST"
  | "TOO_SOON"
  | "TOO_FAR"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "OVER_CAPACITY"
  | "OUTSIDE_OPENING_HOURS"
  | "START_TOO_LATE"
  | "CLOSED"
  | "SLOT_TAKEN"
  | "NOT_MODIFIABLE";

export const REJECTION_MESSAGES: Record<RejectionReason, string> = {
  ROOM_INACTIVE: "Cette salle n'est pas disponible à la réservation.",
  INVALID_RANGE: "L'heure de fin doit être après l'heure de début.",
  NOT_ON_GRID: "Les horaires doivent être choisis par tranches de 15 minutes.",
  IN_PAST: "Ce créneau est déjà passé.",
  TOO_SOON: "Ce créneau est trop proche : merci de nous contacter directement.",
  TOO_FAR: "Ce créneau est trop éloigné dans le temps pour être réservé en ligne.",
  TOO_SHORT: "La durée est inférieure à la durée minimale de réservation de cette salle.",
  TOO_LONG: "La durée dépasse la durée maximale de réservation de cette salle.",
  OVER_CAPACITY: "Le nombre de personnes dépasse la capacité de cette salle.",
  OUTSIDE_OPENING_HOURS: "Ce créneau est en dehors des horaires d'ouverture de la salle.",
  START_TOO_LATE: "L'heure de début est trop tardive : consultez les horaires de la salle.",
  CLOSED: "La salle est fermée à cette date.",
  SLOT_TAKEN: "Ce créneau n'est plus disponible.",
  NOT_MODIFIABLE: "Cette réservation ne peut plus être modifiée.",
};

/** Deux intervalles semi-ouverts [début, fin) se chevauchent-ils ? */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Plage réellement bloquée par une réservation : [début, fin + temps tampon). */
export function blockedInterval(startsAt: Date, endsAt: Date, bufferMin: number): Interval {
  return { start: startsAt, end: new Date(endsAt.getTime() + bufferMin * 60_000) };
}

/**
 * Position d'un créneau sur « l'horloge » de son jour de début (heure de Paris) :
 * minutes depuis minuit du jour de début ; la fin peut dépasser 1440 si elle
 * tombe le lendemain (ex. 3h00 le lendemain = 1620). null si le créneau
 * déborde au-delà du lendemain.
 */
export function slotClock(startsAt: Date, endsAt: Date): { weekday: number; startMin: number; endMin: number } | null {
  const s = utcToParis(startsAt);
  const e = utcToParis(endsAt);
  const nextDay = utcToParis(parisToUtc(s.isoDate, 1440)).isoDate;
  const endMin = e.isoDate === s.isoDate ? e.minutes : e.isoDate === nextDay ? 1440 + e.minutes : null;
  return endMin === null ? null : { weekday: s.weekday, startMin: s.minutes, endMin };
}

/**
 * Le créneau tient-il entièrement dans une plage d'ouverture qui commence le jour
 * du début ? Les plages peuvent se terminer le lendemain (ex. 15h → 3h du matin).
 */
export function openingHoursCheck(
  openingHours: RoomRules["openingHours"],
  startsAt: Date,
  endsAt: Date,
): "OK" | "OUTSIDE_OPENING_HOURS" | "START_TOO_LATE" {
  const clock = slotClock(startsAt, endsAt);
  if (!clock) return "OUTSIDE_OPENING_HOURS";
  const fitting = openingHours.filter(
    (h) => h.weekday === clock.weekday && h.openMin <= clock.startMin && clock.endMin <= h.closeMin,
  );
  if (fitting.length === 0) return "OUTSIDE_OPENING_HOURS";
  return fitting.some((h) => h.lastStartMin == null || clock.startMin <= h.lastStartMin) ? "OK" : "START_TOO_LATE";
}

export function fitsOpeningHours(openingHours: RoomRules["openingHours"], startsAt: Date, endsAt: Date): boolean {
  return openingHoursCheck(openingHours, startsAt, endsAt) === "OK";
}

/**
 * Vérifie toutes les règles d'une salle pour un créneau donné, hors conflits
 * avec les autres réservations (vérifiés à part, en base).
 * Renvoie la liste des motifs de refus (vide = créneau acceptable).
 */
export function checkSlotRules(input: {
  room: RoomRules;
  startsAt: Date;
  endsAt: Date;
  attendees: number;
  closures: Interval[];
  settings: Pick<Settings, "minNoticeHours" | "maxAdvanceMonths">;
  now: Date;
}): RejectionReason[] {
  const { room, startsAt, endsAt, attendees, closures, settings, now } = input;
  const reasons: RejectionReason[] = [];
  if (!room.active) reasons.push("ROOM_INACTIVE");

  const durationMin = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (!(durationMin > 0)) return [...reasons, "INVALID_RANGE"];

  if (utcToParis(startsAt).minutes % SLOT_STEP_MIN !== 0 || utcToParis(endsAt).minutes % SLOT_STEP_MIN !== 0) {
    reasons.push("NOT_ON_GRID");
  }

  if (startsAt <= now) reasons.push("IN_PAST");
  else if (startsAt.getTime() < now.getTime() + settings.minNoticeHours * 3_600_000) reasons.push("TOO_SOON");
  if (startsAt > addMonths(now, settings.maxAdvanceMonths)) reasons.push("TOO_FAR");

  if (durationMin < room.minDurationMin) reasons.push("TOO_SHORT");
  if (durationMin > room.maxDurationMin) reasons.push("TOO_LONG");
  if (!Number.isInteger(attendees) || attendees < 1 || attendees > room.capacity) reasons.push("OVER_CAPACITY");

  const opening = openingHoursCheck(room.openingHours, startsAt, endsAt);
  if (opening !== "OK") reasons.push(opening);
  if (closures.some((c) => overlaps(c, { start: startsAt, end: endsAt }))) reasons.push("CLOSED");

  return reasons;
}

/**
 * Le créneau demandé (avec son tampon) entre-t-il en conflit avec des plages
 * déjà bloquées ? Même logique que la contrainte PostgreSQL `bookings_no_overlap`.
 */
export function conflictsWith(startsAt: Date, endsAt: Date, bufferMin: number, busy: Interval[]): boolean {
  const wanted = blockedInterval(startsAt, endsAt, bufferMin);
  return busy.some((b) => overlaps(wanted, b));
}

/** Fusionne des intervalles qui se touchent ou se chevauchent (pour l'affichage du calendrier). */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) {
      if (i.end > last.end) last.end = i.end;
    } else out.push({ start: i.start, end: i.end });
  }
  return out;
}

/** Retire des plages `open` les plages `busy` → plages réellement libres (pour le calendrier). */
export function subtractIntervals(open: Interval[], busy: Interval[]): Interval[] {
  const merged = mergeIntervals(busy);
  const out: Interval[] = [];
  for (const o of open) {
    let cursor = o.start;
    for (const b of merged) {
      if (b.end <= cursor || b.start >= o.end) continue;
      if (b.start > cursor) out.push({ start: cursor, end: b.start });
      if (b.end > cursor) cursor = b.end;
    }
    if (cursor < o.end) out.push({ start: cursor, end: o.end });
  }
  return out;
}
