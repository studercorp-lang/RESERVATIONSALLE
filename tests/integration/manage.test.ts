/**
 * Lien de gestion du client : consultation, modification, annulation (avec frais),
 * correction des coordonnées, retrait du consentement marketing.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { submitBookingRequest } from "@/lib/booking/request";
import {
  cancelByClient,
  clientPermissions,
  findBookingByToken,
  modifyByClient,
  updateContactByClient,
  withdrawMarketingByClient,
} from "@/lib/booking/manage";
import { memoryOutbox } from "@/lib/email/transport";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";

process.env.EMAIL_TRANSPORT = "memory";
process.env.EMAIL_TEAM = "equipe@example.com";

// On travaille avec l'heure réelle : les créneaux sont placés dans le futur.
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

async function newRequest(daysAhead = 40, marketingOptIn = false) {
  memoryOutbox.length = 0;
  const res = await submitBookingRequest({
    roomSlug: "salon",
    slot: { date: inDays(daysAhead), startMin: "540", endMin: "660", attendees: "12" },
    contact: { lastName: "Martin", firstName: "Camille", email: "camille@example.com", phone: "0612345678" },
    acceptTerms: true,
    marketingOptIn,
  });
  if (!res.ok) throw new Error(JSON.stringify(res));
  const token = /\/reservation\/([A-Za-z0-9_-]{43})/.exec(memoryOutbox[0].text)![1];
  memoryOutbox.length = 0;
  return { token, reference: res.booking.reference };
}

beforeEach(async () => {
  memoryOutbox.length = 0;
  await prisma.auditLog.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.room.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.room.create({
    data: {
      slug: "salon", name: "Le Salon", description: "", capacity: 30, bufferMin: 30,
      openingHours: { create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, openMin: 480, closeMin: 1380 })) },
    },
  });
});

afterAll(() => prisma.$disconnect());

describe("accès par le lien", () => {
  it("retrouve la réservation avec un lien valide", async () => {
    const { token, reference } = await newRequest();
    expect((await findBookingByToken(token))?.reference).toBe(reference);
  });

  it("refuse un lien inconnu, mal formé ou expiré", async () => {
    const { token } = await newRequest();
    expect(await findBookingByToken("x".repeat(43))).toBeNull();
    expect(await findBookingByToken("pas-un-jeton")).toBeNull();
    expect(await findBookingByToken(token, addDays(new Date(), 200))).toBeNull();
  });

  it("refuse le lien si les données du client ont été effacées", async () => {
    const { token } = await newRequest();
    await prisma.customer.updateMany({ data: { anonymizedAt: new Date() } });
    expect(await findBookingByToken(token)).toBeNull();
  });
});

describe("annulation", () => {
  it("demande en attente : annulation sans frais, e-mails client + équipe, audit", async () => {
    const { token } = await newRequest(10);
    const res = await cancelByClient(token);
    expect(res).toMatchObject({ ok: true });
    const b = await prisma.booking.findFirstOrThrow();
    expect(b.status).toBe("CANCELLED");
    expect(b.cancelledAt).not.toBeNull();
    expect(memoryOutbox.map((m) => m.to)).toEqual(["camille@example.com", "equipe@example.com"]);
    expect(memoryOutbox[0].text).toContain("sans frais");
    expect(await prisma.auditLog.findFirst({ where: { action: "booking.cancel" } })).toMatchObject({ actorLabel: "client (lien de gestion)" });
    // le créneau est libéré
    await expect(newRequest(10)).resolves.toBeTruthy();
  });

  it("réservation confirmée à 10 jours : frais de 50 % annoncés", async () => {
    const { token } = await newRequest(10);
    await prisma.booking.updateMany({ data: { status: "CONFIRMED" } });
    const b = (await findBookingByToken(token))!;
    expect(clientPermissions(b, DEFAULT_SETTINGS, new Date()).feePercent).toBe(50);
    const res = await cancelByClient(token);
    expect(res.ok && res.message).toContain("50 %");
    expect(memoryOutbox[0].text).toContain("50 %");
  });

  it("impossible d'annuler deux fois", async () => {
    const { token } = await newRequest();
    await cancelByClient(token);
    expect((await cancelByClient(token)).ok).toBe(false);
  });
});

describe("modification", () => {
  it("déplace une demande en attente et vérifie la disponibilité", async () => {
    const { token } = await newRequest(40);
    const res = await modifyByClient(token, { date: inDays(41), startMin: "600", endMin: "720", attendees: "20" });
    expect(res.ok).toBe(true);
    const b = await prisma.booking.findFirstOrThrow();
    expect(b.startsAt.toISOString()).toBe(parisToUtc(inDays(41), 600).toISOString());
    expect(b.attendees).toBe(20);
    expect(b.manageTokenExpiry!.getTime()).toBe(addDays(b.endsAt, 30).getTime());
    expect(memoryOutbox.map((m) => m.subject)[0]).toContain("Modification");
  });

  it("peut décaler sa propre demande sur un créneau qui chevauche l'ancien", async () => {
    const { token } = await newRequest(40);
    expect((await modifyByClient(token, { date: inDays(40), startMin: "600", endMin: "720", attendees: "12" })).ok).toBe(true);
  });

  it("refuse un créneau pris par un autre client", async () => {
    const { token } = await newRequest(40);
    await submitBookingRequest({
      roomSlug: "salon", slot: { date: inDays(42), startMin: "540", endMin: "660", attendees: "5" },
      contact: { lastName: "B", firstName: "B", email: "b@example.com", phone: "0612345679" }, acceptTerms: true, marketingOptIn: false,
    });
    const res = await modifyByClient(token, { date: inDays(42), startMin: "600", endMin: "720", attendees: "12" });
    expect(res).toEqual({ ok: false, error: "Ce créneau n'est plus disponible." });
  });

  it("refuse une modification invalide (capacité)", async () => {
    const { token } = await newRequest(40);
    const res = await modifyByClient(token, { date: inDays(40), startMin: "540", endMin: "660", attendees: "31" });
    expect(res.ok).toBe(false);
  });

  it("réservation confirmée : modification en ligne impossible (passer par l'équipe)", async () => {
    const { token } = await newRequest(40);
    await prisma.booking.updateMany({ data: { status: "CONFIRMED" } });
    expect((await modifyByClient(token, { date: inDays(41), startMin: "540", endMin: "660", attendees: "12" })).ok).toBe(false);
  });

  it("moins de 48 h avant : modification impossible, annulation possible", async () => {
    const { token } = await newRequest(2);
    const b = (await findBookingByToken(token))!;
    const soon = new Date(b.startsAt.getTime() - 24 * 3_600_000);
    const perms = clientPermissions(b, DEFAULT_SETTINGS, soon);
    expect(perms.canModify).toBe(false);
    expect(perms.modifyBlockedReason).toBe("deadline");
    expect(perms.canCancel).toBe(true);
  });
});

describe("coordonnées et consentement", () => {
  it("corrige les coordonnées (droit de rectification) et trace les champs modifiés", async () => {
    const { token } = await newRequest();
    expect((await updateContactByClient(token, { lastName: "Martin-Durand", firstName: "Camille", phone: "07 11 22 33 44", company: "" })).ok).toBe(true);
    const c = await prisma.customer.findFirstOrThrow();
    expect([c.lastName, c.phone]).toEqual(["Martin-Durand", "+33711223344"]);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "customer.rectify" } });
    expect(log.details).toEqual({ fields: ["lastName", "phone"] });
    expect(JSON.stringify(log)).not.toContain("Martin-Durand");
  });

  it("refuse un téléphone invalide", async () => {
    const { token } = await newRequest();
    const res = await updateContactByClient(token, { lastName: "A", firstName: "B", phone: "12", company: "" });
    expect(res.ok).toBe(false);
  });

  it("retire le consentement marketing et en garde la preuve", async () => {
    const { token } = await newRequest(40, true);
    expect((await withdrawMarketingByClient(token)).ok).toBe(true);
    expect((await prisma.customer.findFirstOrThrow()).marketingOptIn).toBe(false);
    const consents = await prisma.consent.findMany({ where: { type: "MARKETING" }, orderBy: { createdAt: "asc" } });
    expect(consents.map((c) => c.granted)).toEqual([true, false]);
  });
});
