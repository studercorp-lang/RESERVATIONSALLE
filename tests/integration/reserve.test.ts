/**
 * Tests du moteur de disponibilité et de l'enregistrement des réservations,
 * contre une vraie base PostgreSQL (base de test).
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";
import { BookingRejectedError, reserveSlot } from "@/lib/booking/reserve";
import { getRoomSchedule, searchAvailability } from "@/lib/availability/search";

const NOW = new Date("2027-01-04T10:00:00Z"); // lundi 4 janvier 2027
const DAY = "2027-01-11"; // lundi suivant
const S: Settings = { ...DEFAULT_SETTINGS };
let big: { id: string };
let small: { id: string };
let customerId: string;

const allDays = (openMin: number, closeMin: number) =>
  ({ create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, openMin, closeMin })) });

const reserve = (roomId: string, start: number, end: number, extra: Partial<Parameters<typeof reserveSlot>[0]> = {}, settings = S, now = NOW) =>
  reserveSlot({ roomId, customer: customerId, startsAt: parisToUtc(DAY, start), endsAt: parisToUtc(DAY, end), attendees: 10, ...extra }, now, settings);

async function rejection(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof BookingRejectedError) return e.reasons;
    throw e;
  }
  throw new Error("La réservation aurait dû être refusée");
}

beforeEach(async () => {
  await prisma.consent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.closure.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.room.deleteMany();
  big = await prisma.room.create({
    data: { slug: "grande", name: "Grande", description: "", capacity: 80, bufferMin: 60, sortOrder: 0, openingHours: allDays(480, 1380),
      priceRules: { create: [{ weekday: 1, unit: "HOUR", amountCents: 15000 }] } },
  });
  small = await prisma.room.create({
    data: { slug: "petite", name: "Petite", description: "", capacity: 12, bufferMin: 15, sortOrder: 1, openingHours: allDays(480, 1380) },
  });
  customerId = (await prisma.customer.create({ data: { email: "client@example.com", firstName: "Test", lastName: "Client", phone: "+33199000001" } })).id;
});

afterAll(() => prisma.$disconnect());

describe("enregistrement d'une demande", () => {
  it("crée une demande en attente qui bloque le créneau 7 jours, avec estimation", async () => {
    const b = await reserve(big.id, 540, 660);
    expect(b.status).toBe(BookingStatus.PENDING);
    expect(b.reference).toMatch(/^Q19-[2-9A-Z]{6}$/);
    expect(b.blockedUntil.toISOString()).toBe(parisToUtc(DAY, 720).toISOString()); // 11h + 1 h de tampon
    expect(b.pendingExpiresAt?.toISOString()).toBe("2027-01-11T10:00:00.000Z");
    expect(b.estimatedCents).toBe(30000);
  });

  it("confirme directement si la validation automatique est activée", async () => {
    const b = await reserve(big.id, 540, 660, {}, { ...S, autoConfirm: true });
    expect(b.status).toBe(BookingStatus.CONFIRMED);
    expect(b.pendingExpiresAt).toBeNull();
  });

  it("refuse un créneau déjà pris, ou empiétant sur le tampon", async () => {
    await reserve(big.id, 540, 660);
    expect(await rejection(reserve(big.id, 600, 720))).toEqual(["SLOT_TAKEN"]);
    expect(await rejection(reserve(big.id, 690, 780))).toEqual(["SLOT_TAKEN"]); // tampon jusqu'à 12h
    await expect(reserve(big.id, 720, 780)).resolves.toBeTruthy();
  });

  it("une demande en attente expirée libère le créneau", async () => {
    const slot = { startsAt: parisToUtc("2027-01-20", 540), endsAt: parisToUtc("2027-01-20", 660) };
    const first = await reserve(big.id, 0, 0, slot); // expire le 11 janvier
    const later = new Date("2027-01-12T10:00:00Z"); // après l'expiration, avant le créneau
    const second = await reserve(big.id, 0, 0, slot, S, later);
    expect(second.id).not.toBe(first.id);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: first.id } })).status).toBe(BookingStatus.EXPIRED);
  });

  it("une réservation annulée libère le créneau", async () => {
    const b = await reserve(big.id, 540, 660);
    await prisma.booking.update({ where: { id: b.id }, data: { status: BookingStatus.CANCELLED } });
    await expect(reserve(big.id, 540, 660)).resolves.toBeTruthy();
  });

  it("revérifie toutes les règles côté serveur", async () => {
    expect(await rejection(reserve(small.id, 540, 660, { attendees: 13 }))).toContain("OVER_CAPACITY");
    expect(await rejection(reserve(big.id, 420, 600))).toContain("OUTSIDE_OPENING_HOURS");
    await prisma.closure.create({ data: { startsAt: parisToUtc(DAY, 0), endsAt: parisToUtc(DAY, 1440) } }); // toutes salles
    expect(await rejection(reserve(small.id, 540, 660))).toContain("CLOSED");
  });

  it("l'équipe peut saisir une demande hors délais en ligne, mais pas hors règles", async () => {
    const tomorrowEarly = { startsAt: new Date("2027-01-05T08:00:00Z"), endsAt: new Date("2027-01-05T10:00:00Z") };
    expect(await rejection(reserve(big.id, 0, 0, tomorrowEarly))).toContain("TOO_SOON");
    await expect(reserve(big.id, 0, 0, { ...tomorrowEarly, byTeam: true, source: "BACKOFFICE" })).resolves.toBeTruthy();
    expect(await rejection(reserve(small.id, 0, 0, { ...tomorrowEarly, byTeam: true, attendees: 50 }))).toEqual(["OVER_CAPACITY"]);
  });

  it("20 demandes simultanées sur le même créneau : une seule acceptée, les autres reçoivent « créneau pris »", async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => reserve(big.id, 540, 660)));
    const ok = results.filter((r) => r.status === "fulfilled");
    const ko = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(ko.every((r) => r.reason instanceof BookingRejectedError && r.reason.reasons[0] === "SLOT_TAKEN")).toBe(true);
  });
});

describe("recherche de disponibilité", () => {
  it("filtre par capacité et par occupation", async () => {
    let res = await searchAvailability({ date: DAY, startMin: 540, endMin: 660, attendees: 30 }, NOW, S);
    expect(res.filter((r) => r.available).map((r) => r.slug)).toEqual(["grande"]);
    expect(res.find((r) => r.slug === "petite")?.reasons).toContain("OVER_CAPACITY");

    await reserve(big.id, 600, 720);
    res = await searchAvailability({ date: DAY, startMin: 540, endMin: 660, attendees: 10 }, NOW, S);
    expect(res.filter((r) => r.available).map((r) => r.slug)).toEqual(["petite"]);
    expect(res.find((r) => r.slug === "grande")?.reasons).toEqual(["SLOT_TAKEN"]);
  });

  it("le planning montre les plages occupées (tampon inclus) sans aucune donnée client", async () => {
    await reserve(big.id, 540, 660);
    const [day] = await getRoomSchedule(big.id, DAY, 7, NOW);
    expect(day.date).toBe(DAY);
    expect(day.open).toEqual([{ start: parisToUtc(DAY, 480), end: parisToUtc(DAY, 1380) }]);
    expect(day.busy).toEqual([{ start: parisToUtc(DAY, 540), end: parisToUtc(DAY, 720) }]);
    expect(JSON.stringify(day)).not.toMatch(/client|Test|example\.com/i);
  });

  it("le planning sur une semaine traverse correctement le changement d'heure", async () => {
    const week = await getRoomSchedule(big.id, "2027-03-26", 4, NOW);
    expect(week.map((d) => d.date)).toEqual(["2027-03-26", "2027-03-27", "2027-03-28", "2027-03-29"]);
    expect(week[0].open[0].start.toISOString()).toBe("2027-03-26T07:00:00.000Z"); // 8h heure d'hiver
    expect(week[3].open[0].start.toISOString()).toBe("2027-03-29T06:00:00.000Z"); // 8h heure d'été
  });
});

describe("horaires de nuit (15h → 3h)", () => {
  beforeEach(async () => {
    await prisma.openingHours.deleteMany({ where: { roomId: big.id } });
    await prisma.openingHours.createMany({
      data: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ roomId: big.id, weekday, openMin: 900, closeMin: 1620, lastStartMin: 1320 })),
    });
  });

  it("réserve 20h → 02h et bloque le créneau suivant à cheval sur minuit", async () => {
    const b = await reserve(big.id, 1200, 1560, { attendees: 40 });
    expect(b.endsAt.toISOString()).toBe(parisToUtc("2027-01-12", 120).toISOString()); // mardi 2h
    expect(await rejection(reserve(big.id, 1320, 1620))).toEqual(["SLOT_TAKEN"]);
  });

  it("refuse un début à 22h30", async () => {
    expect(await rejection(reserve(big.id, 1350, 1560))).toEqual(["START_TOO_LATE"]);
  });

  it("le planning du jour va de 15h à 3h le lendemain et montre l'occupation après minuit", async () => {
    await reserve(big.id, 1200, 1560, { attendees: 40 }); // 20h → 2h + 1 h de tampon
    const [day] = await getRoomSchedule(big.id, DAY, 1, NOW);
    expect(day.window).toEqual({ start: parisToUtc(DAY, 900), end: parisToUtc(DAY, 1620) });
    expect(day.busy).toEqual([{ start: parisToUtc(DAY, 1200), end: parisToUtc(DAY, 1620) }]);
  });
});
