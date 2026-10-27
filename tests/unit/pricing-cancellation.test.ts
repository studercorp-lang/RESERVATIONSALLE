import { describe, expect, it } from "vitest";
import { estimatePriceCents, formatEuros } from "@/lib/availability/pricing";
import { cancellationFeePercent } from "@/lib/booking/cancellation";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";

describe("estimation du prix (tarif selon le jour)", () => {
  const rules = [1, 2, 3, 4, 5, 6, 7].flatMap((weekday) => {
    const weekend = weekday >= 6;
    return [
      { weekday, unit: "HOUR" as const, amountCents: weekend ? 20000 : 15000 },
      { weekday, unit: "HALF_DAY" as const, amountCents: weekend ? 75000 : 55000 },
      { weekday, unit: "DAY" as const, amountCents: weekend ? 130000 : 95000 },
    ];
  });

  it("à l'heure en semaine (lundi, 2 h)", () => {
    expect(estimatePriceCents(rules, parisToUtc("2027-01-11", 540), parisToUtc("2027-01-11", 660))).toBe(30000);
  });

  it("toute heure entamée est due (1 h 15 = 2 h)", () => {
    expect(estimatePriceCents(rules, parisToUtc("2027-01-11", 540), parisToUtc("2027-01-11", 615))).toBe(30000);
  });

  it("forfait demi-journée si plus avantageux (4 h)", () => {
    expect(estimatePriceCents(rules, parisToUtc("2027-01-11", 540), parisToUtc("2027-01-11", 780))).toBe(55000);
  });

  it("forfait journée au-delà d'une demi-journée (9 h)", () => {
    expect(estimatePriceCents(rules, parisToUtc("2027-01-11", 540), parisToUtc("2027-01-11", 1080))).toBe(95000);
  });

  it("tarif week-end le samedi", () => {
    expect(estimatePriceCents(rules, parisToUtc("2027-01-16", 540), parisToUtc("2027-01-16", 660))).toBe(40000);
  });

  it("aucun tarif défini → pas d'estimation", () => {
    expect(estimatePriceCents([], parisToUtc("2027-01-11", 540), parisToUtc("2027-01-11", 660))).toBeNull();
  });

  it("formatage en euros", () => {
    expect(formatEuros(95000).replace(/\s/g, " ")).toBe("950,00 €");
  });
});

describe("frais d'annulation (barème QUAI 19)", () => {
  const start = parisToUtc("2027-03-31", 14 * 60); // mercredi 31 mars 2027, 14h
  const fee = (date: string, minutes = 10 * 60) => cancellationFeePercent(start, parisToUtc(date, minutes), DEFAULT_SETTINGS);

  it("30 jours avant ou plus : aucun frais", () => {
    expect(fee("2027-02-15")).toBe(0);
    expect(fee("2027-03-01")).toBe(0); // 30 jours avant
  });

  it("de 29 à 16 jours avant : 25 %", () => {
    expect(fee("2027-03-02")).toBe(25); // 29 jours avant
    expect(fee("2027-03-15")).toBe(25); // 16 jours avant
  });

  it("de 15 à 8 jours avant : 50 %", () => {
    expect(fee("2027-03-16")).toBe(50); // 15 jours avant
    expect(fee("2027-03-23")).toBe(50); // 8 jours avant
  });

  it("7 jours avant ou moins : 90 %", () => {
    expect(fee("2027-03-24")).toBe(90); // 7 jours avant
    expect(fee("2027-03-31", 9 * 60)).toBe(90); // le jour même, avant le début
  });

  it("absence / annulation après le début : 100 %", () => {
    expect(fee("2027-03-31", 15 * 60)).toBe(100);
  });

  it("compte en jours calendaires de Paris, malgré le changement d'heure (28 mars)", () => {
    expect(fee("2027-03-24", 23 * 60 + 30)).toBe(90); // 23h30 à Paris = encore le 24
  });
});
