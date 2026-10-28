/**
 * Recherche de disponibilité et planning des salles (vue calendrier).
 */
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { parisToUtc, utcToParis } from "@/lib/time";
import { estimatePriceCents } from "./pricing";
import { timeOptions, type TimeOptions } from "./time-options";
import { getBusyByRoom, getClosuresByRoom } from "./queries";
import { checkSlotRules, conflictsWith, mergeIntervals, type Interval, type RejectionReason } from "./rules";

export type SearchInput = {
  date: string; // AAAA-MM-JJ, heure de Paris
  startMin: number; // minutes depuis minuit
  endMin: number; // minutes depuis minuit (1440 = minuit)
  attendees: number;
};

export type RoomAvailability = {
  roomId: string;
  slug: string;
  name: string;
  capacity: number;
  available: boolean;
  reasons: RejectionReason[];
  estimatedCents: number | null;
};

const roomInclude = { openingHours: true, priceRules: true } as const;

/**
 * Pour chaque salle active, indique si elle est réservable sur le créneau demandé.
 * L'interface publique n'affiche que les salles disponibles.
 */
export async function searchAvailability(
  input: SearchInput,
  now = new Date(),
  settings?: Settings,
): Promise<RoomAvailability[]> {
  const cfg = settings ?? (await getSettings());
  const startsAt = parisToUtc(input.date, input.startMin);
  const endsAt = parisToUtc(input.date, input.endMin);

  const rooms = await prisma.room.findMany({ where: { active: true }, include: roomInclude, orderBy: { sortOrder: "asc" } });
  const ids = rooms.map((r) => r.id);
  // Fenêtre élargie pour attraper les tampons qui débordent
  const maxBuffer = Math.max(0, ...rooms.map((r) => r.bufferMin));
  const from = new Date(startsAt.getTime() - 24 * 3_600_000);
  const to = new Date(endsAt.getTime() + (maxBuffer + 60) * 60_000);
  const [busy, closures] = await Promise.all([getBusyByRoom(ids, from, to, now), getClosuresByRoom(ids, from, to)]);

  return rooms.map((room) => {
    const reasons = checkSlotRules({
      room,
      startsAt,
      endsAt,
      attendees: input.attendees,
      closures: closures.get(room.id) ?? [],
      settings: cfg,
      now,
    });
    if (reasons.length === 0 && conflictsWith(startsAt, endsAt, room.bufferMin, busy.get(room.id) ?? [])) {
      reasons.push("SLOT_TAKEN");
    }
    return {
      roomId: room.id,
      slug: room.slug,
      name: room.name,
      capacity: room.capacity,
      available: reasons.length === 0,
      reasons,
      estimatedCents: estimatePriceCents(room.priceRules, startsAt, endsAt),
    };
  });
}

export type DaySchedule = {
  date: string;
  window: Interval; // période affichée pour ce jour (de l'ouverture à la fermeture, éventuellement le lendemain)
  open: Interval[]; // plages d'ouverture (UTC)
  busy: Interval[]; // plages occupées ou fermées, fusionnées — sans aucune info client
};

/**
 * Planning d'une salle sur `days` jours à partir de `fromDate` (vue jour / semaine).
 * Chaque « jour » couvre la plage d'ouverture qui commence ce jour-là, y compris
 * sa partie après minuit (ex. vendredi 15h → samedi 3h).
 * Les plages occupées incluent le temps tampon, et ne révèlent jamais qui a réservé.
 */
export async function getRoomSchedule(roomId: string, fromDate: string, days: number, now = new Date()): Promise<DaySchedule[]> {
  const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId }, include: { openingHours: true } });
  const dates = Array.from({ length: days }, (_, i) => utcToParis(addDays(parisToUtc(fromDate, 12 * 60), i)).isoDate); // midi : à l'abri des changements d'heure
  const from = parisToUtc(dates[0], 0);
  const to = parisToUtc(dates[dates.length - 1], 2880);
  const [busy, closures] = await Promise.all([getBusyByRoom([roomId], from, to, now), getClosuresByRoom([roomId], from, to)]);
  const allBusy = mergeIntervals([...(busy.get(roomId) ?? []), ...(closures.get(roomId) ?? [])]);

  return dates.map((date) => {
    const weekday = utcToParis(parisToUtc(date, 12 * 60)).weekday;
    const hours = room.openingHours.filter((h) => h.weekday === weekday).sort((a, b) => a.openMin - b.openMin);
    const window = hours.length
      ? { start: parisToUtc(date, Math.min(...hours.map((h) => h.openMin))), end: parisToUtc(date, Math.max(...hours.map((h) => h.closeMin))) }
      : { start: parisToUtc(date, 0), end: parisToUtc(date, 1440) };
    return {
      date,
      window,
      open: hours.map((h) => ({ start: parisToUtc(date, h.openMin), end: parisToUtc(date, h.closeMin) })),
      busy: allBusy
        .filter((b) => b.start < window.end && b.end > window.start)
        .map((b) => ({ start: b.start < window.start ? window.start : b.start, end: b.end > window.end ? window.end : b.end })),
    };
  });
}

/** Heures à proposer dans les formulaires : celles d'une salle, ou de toutes les salles actives. */
export async function getTimeOptions(roomId?: string): Promise<TimeOptions> {
  const hours = await prisma.openingHours.findMany({
    where: roomId ? { roomId } : { room: { active: true } },
    select: { weekday: true, openMin: true, closeMin: true, lastStartMin: true },
  });
  return timeOptions(hours);
}
