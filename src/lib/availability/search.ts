/**
 * Recherche de disponibilité et planning des salles (vue calendrier).
 */
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";
import { estimatePriceCents } from "./pricing";
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
  open: Interval[]; // plages d'ouverture (UTC)
  busy: Interval[]; // plages occupées ou fermées, fusionnées — sans aucune info client
};

/**
 * Planning d'une salle sur `days` jours à partir de `fromDate` (vue jour / semaine).
 * Les plages occupées incluent le temps tampon, et ne révèlent jamais qui a réservé.
 */
export async function getRoomSchedule(roomId: string, fromDate: string, days: number, now = new Date()): Promise<DaySchedule[]> {
  const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId }, include: { openingHours: true } });
  const dates = Array.from({ length: days }, (_, i) => {
    const d = addDays(parisToUtc(fromDate, 12 * 60), i); // midi : à l'abri des changements d'heure
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d); // AAAA-MM-JJ
  });
  const from = parisToUtc(dates[0], 0);
  const to = parisToUtc(dates[dates.length - 1], 1440);
  const [busy, closures] = await Promise.all([getBusyByRoom([roomId], from, to, now), getClosuresByRoom([roomId], from, to)]);
  const allBusy = mergeIntervals([...(busy.get(roomId) ?? []), ...(closures.get(roomId) ?? [])]);

  return dates.map((date) => {
    const dayStart = parisToUtc(date, 0);
    const dayEnd = parisToUtc(date, 1440);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
    return {
      date,
      open: room.openingHours
        .filter((h) => h.weekday === weekday)
        .sort((a, b) => a.openMin - b.openMin)
        .map((h) => ({ start: parisToUtc(date, h.openMin), end: parisToUtc(date, h.closeMin) })),
      busy: allBusy
        .filter((b) => b.start < dayEnd && b.end > dayStart)
        .map((b) => ({ start: b.start < dayStart ? dayStart : b.start, end: b.end > dayEnd ? dayEnd : b.end })),
    };
  });
}
