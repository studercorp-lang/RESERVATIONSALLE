/**
 * Parcours serveur complet d'une demande : validation, enregistrement,
 * consentements, lien sécurisé, e-mails.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { submitBookingRequest } from "@/lib/booking/request";
import { memoryOutbox } from "@/lib/email/transport";
import { hashToken } from "@/lib/security/tokens";

process.env.EMAIL_TRANSPORT = "memory";
process.env.EMAIL_TEAM = "equipe@example.com";
process.env.APP_URL = "https://reservation.example.com";

const NOW = new Date("2027-01-04T10:00:00Z");

const valid = (over: Record<string, unknown> = {}) => ({
  roomSlug: "salon",
  slot: { date: "2027-01-11", startMin: "540", endMin: "660", attendees: "12" },
  contact: { lastName: "Martin", firstName: "Camille", email: "  Camille.Martin@Example.com ", phone: "06 12 34 56 78", company: "", comment: "Disposition en U" },
  acceptTerms: true,
  marketingOptIn: false,
  ...over,
});

beforeEach(async () => {
  memoryOutbox.length = 0;
  await prisma.consent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.closure.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.room.deleteMany();
  await prisma.room.create({
    data: {
      slug: "salon", name: "Le Salon", description: "", capacity: 30,
      openingHours: { create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, openMin: 480, closeMin: 1380 })) },
      priceRules: { create: [{ weekday: 1, unit: "HOUR", amountCents: 8000 }] },
    },
  });
});

afterAll(() => prisma.$disconnect());

describe("demande de réservation (serveur)", () => {
  it("enregistre la demande, normalise les coordonnées et envoie 2 e-mails", async () => {
    const res = await submitBookingRequest(valid(), NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.booking.status).toBe("PENDING");
    expect(res.booking.estimatedCents).toBe(16000);

    const customer = await prisma.customer.findUniqueOrThrow({ where: { email: "camille.martin@example.com" } });
    expect(customer.phone).toBe("+33612345678");
    expect(customer.company).toBeNull();
    expect(customer.marketingOptIn).toBe(false);

    const consents = await prisma.consent.findMany();
    expect(consents.map((c) => c.type)).toEqual(["TERMS"]);

    expect(memoryOutbox.map((m) => m.to)).toEqual(["camille.martin@example.com", "equipe@example.com"]);
    const customerMail = memoryOutbox[0];
    expect(customerMail.subject).toContain(res.booking.reference);
    expect(customerMail.html).toContain("lundi 11 janvier 2027, de 09h00 à 11h00");
  });

  it("le lien de gestion est unique, non stocké en clair, et expire 30 jours après le créneau", async () => {
    await submitBookingRequest(valid(), NOW);
    const token = /reservation\.example\.com\/reservation\/([A-Za-z0-9_-]{43})/.exec(memoryOutbox[0].text)?.[1];
    expect(token).toBeDefined();
    const booking = await prisma.booking.findFirstOrThrow();
    expect(booking.manageTokenHash).toBe(hashToken(token!));
    expect(JSON.stringify(booking)).not.toContain(token!);
    expect(booking.manageTokenExpiry?.toISOString()).toBe("2027-02-10T10:00:00.000Z");
  });

  it("enregistre le consentement marketing seulement s'il est donné", async () => {
    await submitBookingRequest(valid({ marketingOptIn: true }), NOW);
    expect((await prisma.customer.findFirstOrThrow()).marketingOptIn).toBe(true);
    expect((await prisma.consent.findMany({ orderBy: { type: "asc" } })).map((c) => [c.type, c.granted])).toEqual([
      ["TERMS", true],
      ["MARKETING", true],
    ]);
  });

  it("décocher la case marketing lors d'une 2e demande ne retire pas un consentement existant", async () => {
    await submitBookingRequest(valid({ marketingOptIn: true }), NOW);
    await submitBookingRequest(valid({ slot: { date: "2027-01-12", startMin: "540", endMin: "660", attendees: "5" } }), NOW);
    expect(await prisma.customer.count()).toBe(1);
    expect((await prisma.customer.findFirstOrThrow()).marketingOptIn).toBe(true);
  });

  it("refuse sans acceptation des conditions", async () => {
    const res = await submitBookingRequest(valid({ acceptTerms: false }), NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.acceptTerms).toMatch(/conditions/);
    expect(await prisma.booking.count()).toBe(0);
  });

  it("signale chaque champ invalide", async () => {
    const res = await submitBookingRequest(
      valid({ contact: { lastName: "", firstName: "A", email: "pas-un-email", phone: "123", comment: "x".repeat(1001) } }),
      NOW,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(Object.keys(res.fieldErrors ?? {}).sort()).toEqual(["contact.comment", "contact.email", "contact.lastName", "contact.phone"]);
  });

  it("accepte un numéro étranger au format international", async () => {
    const res = await submitBookingRequest(valid({ contact: { ...valid().contact, phone: "+41 44 668 18 00" } }), NOW);
    expect(res.ok).toBe(true);
    expect((await prisma.customer.findFirstOrThrow()).phone).toBe("+41446681800");
  });

  it("créneau déjà pris : message clair et AUCUNE donnée personnelle conservée pour le 2e client", async () => {
    await submitBookingRequest(valid(), NOW);
    const res = await submitBookingRequest(valid({ contact: { ...valid().contact, email: "autre@example.com" } }), NOW);
    expect(res).toEqual({ ok: false, formError: "Ce créneau n'est plus disponible." });
    expect(await prisma.customer.findUnique({ where: { email: "autre@example.com" } })).toBeNull();
    expect(await prisma.consent.count()).toBe(1);
  });

  it("le HTML des e-mails échappe les saisies (anti-injection)", async () => {
    await submitBookingRequest(valid({ contact: { ...valid().contact, firstName: "<script>alert(1)</script>" } }), NOW);
    expect(memoryOutbox.every((m) => !m.html.includes("<script>"))).toBe(true);
    expect(memoryOutbox[0].html).toContain("&lt;script&gt;");
  });
});

describe("messages d'erreur", () => {
  it("sont en français, même pour un champ totalement absent", async () => {
    const res = await submitBookingRequest({ ...valid(), contact: {} }, NOW);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    for (const msg of Object.values(res.fieldErrors ?? {})) expect(msg).not.toMatch(/Invalid|expected|received/);
  });
});
