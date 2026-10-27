import { describe, expect, it } from "vitest";
import { checkSlotRules, conflictsWith, fitsOpeningHours, mergeIntervals, type RoomRules } from "@/lib/availability/rules";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";

const NOW = new Date("2027-01-04T10:00:00Z"); // lundi 4 janvier 2027, 11h à Paris
const everyDay = (openMin: number, closeMin: number) =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, openMin, closeMin }));

const room: RoomRules = {
  capacity: 20,
  minDurationMin: 60,
  maxDurationMin: 600,
  bufferMin: 30,
  active: true,
  openingHours: everyDay(8 * 60, 23 * 60),
};

const check = (date: string, start: number, end: number, overrides: Partial<{ attendees: number; room: RoomRules; closures: { start: Date; end: Date }[] }> = {}) =>
  checkSlotRules({
    room: overrides.room ?? room,
    startsAt: parisToUtc(date, start),
    endsAt: parisToUtc(date, end),
    attendees: overrides.attendees ?? 10,
    closures: overrides.closures ?? [],
    settings: DEFAULT_SETTINGS,
    now: NOW,
  });

describe("règles d'un créneau", () => {
  it("accepte un créneau valide", () => {
    expect(check("2027-01-11", 9 * 60, 12 * 60)).toEqual([]);
  });

  it("refuse un créneau passé", () => {
    expect(check("2027-01-03", 9 * 60, 12 * 60)).toContain("IN_PAST");
  });

  it("refuse un créneau trop proche (délai minimum de 24 h)", () => {
    expect(check("2027-01-04", 20 * 60, 22 * 60)).toContain("TOO_SOON");
  });

  it("refuse un créneau au-delà de 6 mois", () => {
    expect(check("2027-07-12", 9 * 60, 12 * 60)).toContain("TOO_FAR");
  });

  it("refuse une fin avant le début", () => {
    expect(check("2027-01-11", 12 * 60, 9 * 60)).toEqual(["INVALID_RANGE"]);
  });

  it("refuse les horaires hors pas de 15 minutes", () => {
    expect(check("2027-01-11", 9 * 60 + 10, 12 * 60)).toContain("NOT_ON_GRID");
  });

  it("refuse une durée trop courte ou trop longue", () => {
    expect(check("2027-01-11", 9 * 60, 9 * 60 + 30)).toContain("TOO_SHORT");
    expect(check("2027-01-11", 8 * 60, 19 * 60)).toContain("TOO_LONG");
  });

  it("refuse un nombre de personnes supérieur à la capacité (ou nul)", () => {
    expect(check("2027-01-11", 9 * 60, 12 * 60, { attendees: 21 })).toContain("OVER_CAPACITY");
    expect(check("2027-01-11", 9 * 60, 12 * 60, { attendees: 0 })).toContain("OVER_CAPACITY");
    expect(check("2027-01-11", 9 * 60, 12 * 60, { attendees: 20 })).toEqual([]);
  });

  it("refuse un créneau hors horaires d'ouverture", () => {
    expect(check("2027-01-11", 7 * 60, 9 * 60)).toContain("OUTSIDE_OPENING_HOURS");
    expect(check("2027-01-11", 22 * 60, 23 * 60 + 30)).toContain("OUTSIDE_OPENING_HOURS");
  });

  it("refuse un jour où la salle est fermée (aucun horaire)", () => {
    const closedSunday = { ...room, openingHours: room.openingHours.filter((h) => h.weekday !== 7) };
    expect(check("2027-01-10", 9 * 60, 12 * 60, { room: closedSunday })).toContain("OUTSIDE_OPENING_HOURS");
  });

  it("refuse un créneau pendant une fermeture exceptionnelle", () => {
    const closures = [{ start: parisToUtc("2027-01-11", 0), end: parisToUtc("2027-01-11", 1440) }];
    expect(check("2027-01-11", 9 * 60, 12 * 60, { closures })).toContain("CLOSED");
    expect(check("2027-01-12", 9 * 60, 12 * 60, { closures })).toEqual([]);
  });

  it("refuse une salle désactivée", () => {
    expect(check("2027-01-11", 9 * 60, 12 * 60, { room: { ...room, active: false } })).toContain("ROOM_INACTIVE");
  });
});

describe("horaires d'ouverture", () => {
  const lateFriday = [{ weekday: 5, openMin: 8 * 60, closeMin: 1440 }];

  it("accepte une fin à minuit pile si la salle est ouverte jusqu'à minuit", () => {
    expect(fitsOpeningHours(lateFriday, parisToUtc("2027-01-15", 20 * 60), parisToUtc("2027-01-15", 1440))).toBe(true);
  });

  it("refuse un créneau qui déborde sur le lendemain", () => {
    expect(fitsOpeningHours(lateFriday, parisToUtc("2027-01-15", 22 * 60), parisToUtc("2027-01-16", 60))).toBe(false);
  });

  it("fonctionne le jour du passage à l'heure d'été (journée de 23 h)", () => {
    const sunday = [{ weekday: 7, openMin: 8 * 60, closeMin: 23 * 60 }];
    const start = parisToUtc("2027-03-28", 8 * 60);
    const end = parisToUtc("2027-03-28", 12 * 60);
    expect(fitsOpeningHours(sunday, start, end)).toBe(true);
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(4);
  });

  it("le jour du passage à l'heure d'hiver, 1h-4h dure réellement 4 h", () => {
    const start = parisToUtc("2027-10-31", 60);
    const end = parisToUtc("2027-10-31", 4 * 60);
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(4);
  });
});

describe("conflits avec le temps tampon", () => {
  const busy = [{ start: new Date("2027-01-11T09:00:00Z"), end: new Date("2027-01-11T11:30:00Z") }]; // 9h-11h + 30 min

  it("détecte un chevauchement direct ou avec le tampon", () => {
    expect(conflictsWith(new Date("2027-01-11T10:00:00Z"), new Date("2027-01-11T12:00:00Z"), 30, busy)).toBe(true);
    expect(conflictsWith(new Date("2027-01-11T11:15:00Z"), new Date("2027-01-11T12:00:00Z"), 30, busy)).toBe(true);
    expect(conflictsWith(new Date("2027-01-11T07:00:00Z"), new Date("2027-01-11T08:45:00Z"), 30, busy)).toBe(true);
  });

  it("accepte des créneaux qui respectent le tampon", () => {
    expect(conflictsWith(new Date("2027-01-11T11:30:00Z"), new Date("2027-01-11T12:00:00Z"), 30, busy)).toBe(false);
    expect(conflictsWith(new Date("2027-01-11T07:00:00Z"), new Date("2027-01-11T08:30:00Z"), 30, busy)).toBe(false);
  });

  it("fusionne les plages occupées contiguës", () => {
    const d = (h: number) => new Date(Date.UTC(2027, 0, 11, h));
    expect(mergeIntervals([{ start: d(12), end: d(14) }, { start: d(9), end: d(11) }, { start: d(10), end: d(12) }])).toEqual([
      { start: d(9), end: d(14) },
    ]);
  });
});
