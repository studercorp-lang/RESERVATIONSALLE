/**
 * Horaires QUAI 19 : ouverture de 15h00 à 03h00 le lendemain,
 * début de réservation au plus tard à 22h00.
 */
import { describe, expect, it } from "vitest";
import { checkSlotRules, openingHoursCheck, slotClock, type RoomRules } from "@/lib/availability/rules";
import { defaultTimes, timeOptions } from "@/lib/availability/time-options";
import { estimatePriceCents } from "@/lib/availability/pricing";
import { formatSlot, minutesLabel } from "@/lib/format";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";

const QUAI19 = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, openMin: 900, closeMin: 1620, lastStartMin: 1320 }));
const room: RoomRules = { capacity: 50, minDurationMin: 60, maxDurationMin: 720, bufferMin: 30, active: true, openingHours: QUAI19 };
const NOW = new Date("2027-01-04T10:00:00Z");
const slot = (date: string, start: number, end: number) => [parisToUtc(date, start), parisToUtc(date, end)] as const;
const check = (date: string, start: number, end: number) =>
  checkSlotRules({ room, startsAt: parisToUtc(date, start), endsAt: parisToUtc(date, end), attendees: 10, closures: [], settings: DEFAULT_SETTINGS, now: NOW });

describe("créneaux de soirée et de nuit", () => {
  it("accepte 15h00 → 03h00 le lendemain (la plage complète)", () => {
    expect(check("2027-01-15", 900, 1620)).toEqual([]);
  });

  it("accepte 22h00 → 02h00 le lendemain (dernier début possible)", () => {
    expect(check("2027-01-15", 1320, 1560)).toEqual([]);
  });

  it("refuse un début après 22h00", () => {
    expect(check("2027-01-15", 1335, 1560)).toEqual(["START_TOO_LATE"]);
    expect(check("2027-01-15", 1380, 1560)).toEqual(["START_TOO_LATE"]);
  });

  it("refuse un début avant 15h00 ou une fin après 03h00", () => {
    expect(check("2027-01-15", 840, 1020)).toEqual(["OUTSIDE_OPENING_HOURS"]);
    expect(check("2027-01-15", 1200, 1635)).toEqual(["OUTSIDE_OPENING_HOURS"]);
  });

  it("refuse un début après minuit (01h00 n'est pas un début valide)", () => {
    expect(check("2027-01-16", 60, 120)).toContain("OUTSIDE_OPENING_HOURS");
  });

  it("le samedi 15h → dimanche 3h utilise les horaires du samedi", () => {
    const [s, e] = slot("2027-01-16", 900, 1620);
    expect(slotClock(s, e)).toEqual({ weekday: 6, startMin: 900, endMin: 1620 });
    const onlySaturday = QUAI19.filter((h) => h.weekday === 6);
    expect(openingHoursCheck(onlySaturday, s, e)).toBe("OK");
  });

  it("nuit du passage à l'heure d'hiver (31 oct. 2027) : 22h → 3h dure réellement 6 h", () => {
    const [s, e] = slot("2027-10-30", 1320, 1620);
    expect((e.getTime() - s.getTime()) / 3_600_000).toBe(6);
    expect(openingHoursCheck(QUAI19, s, e)).toBe("OK");
  });

  it("nuit du passage à l'heure d'été (28 mars 2027) : 22h → 3h dure réellement 4 h", () => {
    const [s, e] = slot("2027-03-27", 1320, 1620);
    expect((e.getTime() - s.getTime()) / 3_600_000).toBe(4);
  });

  it("le tarif appliqué est celui du jour de début (vendredi soir → tarif du vendredi)", () => {
    const rules = [
      { weekday: 5, unit: "HOUR" as const, amountCents: 10000 },
      { weekday: 6, unit: "HOUR" as const, amountCents: 20000 },
    ];
    const [s, e] = slot("2027-01-15", 1320, 1500); // vendredi 22h → samedi 1h
    expect(estimatePriceCents(rules, s, e)).toBe(30000);
  });
});

describe("listes d'heures et libellés", () => {
  it("propose des débuts de 15h00 à 22h00 et des fins jusqu'à 03h00 le lendemain", () => {
    const opts = timeOptions(QUAI19);
    expect(opts.starts[0]).toBe(900);
    expect(opts.starts.at(-1)).toBe(1320);
    expect(opts.ends.at(-1)).toBe(1620);
    expect(defaultTimes(opts)).toEqual({ startMin: 1080, endMin: 1260 });
  });

  it("libellés lisibles après minuit", () => {
    expect(minutesLabel(1320)).toBe("22h00");
    expect(minutesLabel(1440)).toBe("minuit");
    expect(minutesLabel(1620)).toBe("03h00 (lendemain)");
  });

  it("récapitulatif : « de 22h00 à 03h00 le lendemain »", () => {
    const [s, e] = slot("2027-01-15", 1320, 1620);
    expect(formatSlot(s, e)).toBe("vendredi 15 janvier 2027, de 22h00 à 03h00 le lendemain");
  });
});
