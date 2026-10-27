import { describe, expect, it } from "vitest";
import { parisToUtc, utcToParis } from "@/lib/time";

describe("conversion heure de Paris ↔ UTC", () => {
  it("hiver : Paris = UTC+1", () => {
    expect(parisToUtc("2027-01-15", 14 * 60).toISOString()).toBe("2027-01-15T13:00:00.000Z");
  });

  it("été : Paris = UTC+2", () => {
    expect(parisToUtc("2027-07-15", 14 * 60).toISOString()).toBe("2027-07-15T12:00:00.000Z");
  });

  it("jour du passage à l'heure d'été (28 mars 2027) : 10h00 = 08h00 UTC", () => {
    expect(parisToUtc("2027-03-28", 10 * 60).toISOString()).toBe("2027-03-28T08:00:00.000Z");
  });

  it("jour du passage à l'heure d'hiver (31 octobre 2027) : 10h00 = 09h00 UTC", () => {
    expect(parisToUtc("2027-10-31", 10 * 60).toISOString()).toBe("2027-10-31T09:00:00.000Z");
  });

  it("minuit de fin de journée (1440) = 00h00 le lendemain", () => {
    expect(utcToParis(parisToUtc("2027-01-15", 1440))).toEqual({ isoDate: "2027-01-16", weekday: 6, minutes: 0 });
  });

  it("aller-retour : jour de semaine ISO (lundi = 1, dimanche = 7)", () => {
    expect(utcToParis(parisToUtc("2027-01-18", 9 * 60))).toEqual({ isoDate: "2027-01-18", weekday: 1, minutes: 540 });
    expect(utcToParis(parisToUtc("2027-01-17", 9 * 60)).weekday).toBe(7);
  });
});
