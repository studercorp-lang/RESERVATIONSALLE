/** Gestion des salles par l'équipe : horaires, blocages, tarifs, photos. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addClosure, addPhoto, bookingsOutsideHours, closureLabel, detectImageType, parseEuros, saveOpeningHours, savePrices, saveRoom, validateHours } from "@/lib/admin/rooms";
import { searchAvailability } from "@/lib/availability/search";
import { reserveSlot } from "@/lib/booking/reserve";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";

const actor = { id: "", label: "équipe:test" };
let roomId: string;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;
const allDays = (over: Partial<{ openMin: number; closeMin: number; lastStartMin: number | null }> = {}) =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, open: true, openMin: 900, closeMin: 1620, lastStartMin: 1320, ...over }));

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.closure.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.room.deleteMany();
  await prisma.adminUser.deleteMany();
  actor.id = (await prisma.adminUser.create({ data: { email: "a@example.com", name: "Alice", passwordHash: "x" } })).id;
  const res = await saveRoom(actor, null, { name: "La Verrière", description: "", capacity: "80", equipment: "Sono, Wi-Fi\nVidéoprojecteur", accessiblePmr: true, minDurationMin: "60", maxDurationMin: "720", bufferMin: "30", active: true, sortOrder: "0" });
  if (!res.ok) throw new Error(res.error);
  roomId = res.id!;
  await saveOpeningHours(actor, roomId, allDays());
});

afterAll(() => prisma.$disconnect());

const search = (date: string, start = 1080, end = 1260) => searchAvailability({ date, startMin: start, endMin: end, attendees: 10 }, new Date(), DEFAULT_SETTINGS);

describe("salle", () => {
  it("création : identifiant d'URL lisible, équipements découpés", async () => {
    const r = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    expect(r.slug).toBe("la-verriere");
    expect(r.equipment).toEqual(["Sono", "Wi-Fi", "Vidéoprojecteur"]);
  });

  it("refuse une durée max inférieure à la durée min", async () => {
    const res = await saveRoom(actor, roomId, { name: "X", description: "", capacity: "10", equipment: "", accessiblePmr: false, minDurationMin: "120", maxDurationMin: "60", bufferMin: "0", active: true, sortOrder: "0" });
    expect(res.ok).toBe(false);
  });
});

describe("horaires modifiables par l'équipe", () => {
  it("fermer le lundi : plus aucun créneau proposé ce jour-là", async () => {
    let monday = inDays(3);
    for (let i = 3; weekdayOf(monday) !== 1; i++) monday = inDays(i);
    expect((await search(monday))[0].available).toBe(true);
    await saveOpeningHours(actor, roomId, allDays().map((d) => (d.weekday === 1 ? { ...d, open: false } : d)));
    expect((await search(monday))[0].reasons).toContain("OUTSIDE_OPENING_HOURS");
    expect(await prisma.auditLog.count({ where: { action: "room.hours" } })).toBe(2);
  });

  it("validation : fermeture après ouverture, dernier début dans la plage", () => {
    expect(validateHours(allDays({ closeMin: 800 }))).toMatch(/fermeture doit être après/);
    expect(validateHours(allDays({ lastStartMin: 1700 }))).toMatch(/dernier début/);
    expect(validateHours(allDays({ lastStartMin: null }))).toBeNull();
  });

  it("signale les réservations à venir devenues hors horaires (sans les modifier)", async () => {
    const date = inDays(10);
    await reserveSlot({ roomId, customer: (await prisma.customer.create({ data: { email: "c@example.com", firstName: "C", lastName: "C", phone: "+33612345678" } })).id, startsAt: parisToUtc(date, 1260), endsAt: parisToUtc(date, 1500), attendees: 5 });
    await saveOpeningHours(actor, roomId, allDays({ lastStartMin: 1200 })); // dernier début avancé à 20h
    const outside = await bookingsOutsideHours(roomId);
    expect(outside).toHaveLength(1);
    expect(await prisma.booking.count({ where: { status: "PENDING" } })).toBe(1);
  });
});

describe("blocages", () => {
  it("journée entière = 6h → 6h le lendemain : bloque la journée, pas la nuit de la veille", async () => {
    const day = inDays(12);
    const res = await addClosure(actor, roomId, { mode: "jours", from: day, to: day, reason: "Travaux" });
    expect(res.ok).toBe(true);
    expect((await search(day))[0].reasons).toContain("CLOSED");
    expect((await search(inDays(11), 1320, 1620))[0].available).toBe(true); // veille 22h → 3h
    const c = await prisma.closure.findFirstOrThrow();
    expect(closureLabel(c)).toMatch(/journée entière/);
  });

  it("créneau précis et blocage de tout l'établissement", async () => {
    const day = inDays(14);
    await addClosure(actor, null, { mode: "creneau", start: `${day}T18:00`, end: `${day}T20:00`, reason: "" });
    expect((await search(day, 1140, 1200))[0].reasons).toContain("CLOSED");
    expect((await search(day, 1230, 1320))[0].available).toBe(true);
  });

  it("prévient si le blocage chevauche une réservation existante", async () => {
    const day = inDays(15);
    const b = await reserveSlot({ roomId, customer: (await prisma.customer.create({ data: { email: "d@example.com", firstName: "D", lastName: "D", phone: "+33612345678" } })).id, startsAt: parisToUtc(day, 1080), endsAt: parisToUtc(day, 1200), attendees: 5 });
    const res = await addClosure(actor, roomId, { mode: "jours", from: day, to: day, reason: "" });
    expect(res.ok && res.overlapping).toEqual([b.reference]);
  });

  it("refuse une fin avant le début", async () => {
    const day = inDays(14);
    expect((await addClosure(actor, roomId, { mode: "creneau", start: `${day}T20:00`, end: `${day}T18:00`, reason: "" })).ok).toBe(false);
  });
});

describe("tarifs", () => {
  it("lecture des montants saisis", () => {
    expect(parseEuros("150")).toBe(15000);
    expect(parseEuros("150,50 €")).toBe(15050);
    expect(parseEuros("1 300")).toBe(130000);
    expect(parseEuros("")).toBeNull();
    expect(parseEuros("abc")).toBe("invalid");
  });

  it("enregistre la grille et refuse un montant invalide", async () => {
    expect((await savePrices(actor, roomId, { "6-HOUR": "200", "6-DAY": "1300" })).ok).toBe(true);
    expect(await prisma.priceRule.count({ where: { roomId } })).toBe(2);
    expect((await savePrices(actor, roomId, { "1-HOUR": "douze" })).ok).toBe(false);
    expect(await prisma.priceRule.count({ where: { roomId } })).toBe(2);
  });
});

describe("photos", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ff3f0005fe02fea7d6a4a70000000049454e44ae426082", "hex");

  it("reconnaît le vrai format du fichier", () => {
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });

  it("ajoute une photo avec texte alternatif, refuse un faux fichier image", async () => {
    expect((await addPhoto(actor, roomId, new File([png], "salle.png", { type: "image/png" }), "Vue de la salle")).ok).toBe(true);
    expect((await addPhoto(actor, roomId, new File(["<script>"], "x.png", { type: "image/png" }), "Texte")).ok).toBe(false);
    expect((await addPhoto(actor, roomId, new File([png], "salle.png"), "")).ok).toBe(false);
    expect(await prisma.roomPhoto.count()).toBe(1);
  });
});
