/** Droits RGPD (export, rectification, effacement) et tâches automatiques (rappels, expiration, purge). */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, addYears } from "date-fns";
import { prisma } from "@/lib/db";
import { confirmBooking } from "@/lib/admin/bookings";
import { findBookingByToken } from "@/lib/booking/manage";
import { submitBookingRequest } from "@/lib/booking/request";
import { memoryOutbox } from "@/lib/email/transport";
import { erasePerson, exportPerson, rectifyPerson, withdrawMarketing } from "@/lib/gdpr/person";
import { applyRetention, runJobs } from "@/lib/jobs/run";
import { DEFAULT_SETTINGS } from "@/lib/settings";

process.env.EMAIL_TRANSPORT = "memory";
const actor = { id: "", label: "équipe:test" };
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

async function request(days: number, email = "camille@example.com", marketingOptIn = false, comment = "Anniversaire") {
  const res = await submitBookingRequest({
    roomSlug: "salon", slot: { date: inDays(days), startMin: "1080", endMin: "1260", attendees: "10" },
    contact: { lastName: "Martin", firstName: "Camille", email, phone: "0612345678", company: "ACME", comment }, acceptTerms: true, marketingOptIn,
  });
  if (!res.ok) throw new Error(JSON.stringify(res));
  memoryOutbox.length = 0;
  return prisma.booking.findFirstOrThrow({ where: { reference: res.booking.reference }, include: { customer: true } });
}

beforeEach(async () => {
  memoryOutbox.length = 0;
  for (const t of ["auditLog", "consent", "booking", "customer", "room", "adminSession", "adminUser", "setting"] as const) {
    // @ts-expect-error — suppression générique des tables de test
    await prisma[t].deleteMany();
  }
  actor.id = (await prisma.adminUser.create({ data: { email: "a@example.com", name: "Alice", passwordHash: "x", role: "ADMIN" } })).id;
  await prisma.room.create({
    data: { slug: "salon", name: "Salon", description: "", capacity: 30, openingHours: { create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, openMin: 900, closeMin: 1620, lastStartMin: 1320 })) } },
  });
});

afterAll(() => prisma.$disconnect());

describe("droits des personnes", () => {
  it("export JSON lisible : coordonnées, réservations, consentements ; tracé", async () => {
    const b = await request(10, "camille@example.com", true);
    const file = await exportPerson(b.customerId, actor, "json");
    const data = JSON.parse(file!.body);
    expect(data.coordonnees).toMatchObject({ nom: "Martin", email: "camille@example.com", telephone: "+33612345678", societe: "ACME" });
    expect(data.reservations[0]).toMatchObject({ reference: b.reference, commentaire: "Anniversaire" });
    expect(data.historiqueDesConsentements.map((c: { type: string }) => c.type)).toEqual(["conditions de réservation", "prospection commerciale"]);
    expect(await prisma.auditLog.count({ where: { action: "customer.export" } })).toBe(1);
  });

  it("export CSV", async () => {
    const b = await request(10);
    const file = await exportPerson(b.customerId, actor, "csv");
    expect(file!.body).toContain("camille@example.com");
    expect(file!.contentType).toContain("text/csv");
  });

  it("rectification, y compris de l'e-mail, sans doublon possible", async () => {
    const b = await request(10);
    await request(12, "autre@example.com");
    expect((await rectifyPerson(b.customerId, actor, { lastName: "Martin", firstName: "Camille", email: "autre@example.com", phone: "0612345678", company: "" })).ok).toBe(false);
    expect((await rectifyPerson(b.customerId, actor, { lastName: "Martin", firstName: "Camille", email: "nouvelle@example.com", phone: "0612345678", company: "" })).ok).toBe(true);
    const c = await prisma.customer.findUniqueOrThrow({ where: { id: b.customerId } });
    expect([c.email, c.company]).toEqual(["nouvelle@example.com", null]);
  });

  it("retrait du consentement marketing tracé avec preuve", async () => {
    const b = await request(10, "camille@example.com", true);
    await withdrawMarketing(b.customerId, actor);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: b.customerId } })).marketingOptIn).toBe(false);
    expect(await prisma.consent.count({ where: { type: "MARKETING", granted: false } })).toBe(1);
  });

  it("effacement refusé s'il reste une réservation à venir active", async () => {
    const b = await request(10);
    const r = await erasePerson(b.customerId, actor);
    expect(r.ok).toBe(false);
  });

  it("effacement : plus aucune donnée identifiante, créneau conservé, lien désactivé", async () => {
    const b = await request(10, "camille@example.com", true);
    await prisma.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", internalNote: "Devis 1200 €" } });
    expect((await erasePerson(b.customerId, actor)).ok).toBe(true);
    const c = await prisma.customer.findUniqueOrThrow({ where: { id: b.customerId }, include: { bookings: true, consents: true } });
    const dump = JSON.stringify(c);
    for (const v of ["Camille", "Martin", "camille@example.com", "612345678", "ACME", "Anniversaire", "Devis"]) expect(dump).not.toContain(v);
    expect(c.bookings).toHaveLength(1);
    expect(c.bookings[0].manageTokenHash).toBeNull();
    expect(c.consents).toHaveLength(0);
    // La même personne peut refaire une demande plus tard (nouvelle fiche)
    await expect(request(20)).resolves.toBeTruthy();
  });
});

describe("tâches automatiques", () => {
  it("expire les demandes non traitées et libère le créneau", async () => {
    const b = await request(30);
    const report = await runJobs(addDays(new Date(), 8));
    expect(report.expiredRequests).toBe(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("EXPIRED");
  });

  it("rappel envoyé une seule fois, avec un lien de gestion valide", async () => {
    const b = await request(3);
    await confirmBooking(b.id, actor, { notify: false });
    const now = new Date(b.startsAt.getTime() - 24 * 3_600_000); // 24 h avant (rappel à 48 h)
    expect((await runJobs(now)).remindersSent).toBe(1);
    expect((await runJobs(now)).remindersSent).toBe(0);
    expect(memoryOutbox).toHaveLength(1);
    expect(memoryOutbox[0].subject).toContain("Rappel");
    const token = /\/reservation\/([A-Za-z0-9_-]{43})/.exec(memoryOutbox[0].text ?? "")?.[1] ?? /\/reservation\/([A-Za-z0-9_-]{43})/.exec(memoryOutbox[0].html)?.[1];
    expect(await findBookingByToken(token!, now)).not.toBeNull();
  });

  it("pas de rappel pour une demande non confirmée", async () => {
    const b = await request(3);
    expect((await runJobs(new Date(b.startsAt.getTime() - 24 * 3_600_000))).remindersSent).toBe(0);
  });

  it("passe en « terminée » une réservation confirmée dont le créneau est passé", async () => {
    const b = await request(3);
    await confirmBooking(b.id, actor, { notify: false });
    expect((await runJobs(addDays(b.endsAt, 1))).completedBookings).toBe(1);
  });
});

describe("durées de conservation", () => {
  it("anonymise un client 3 ans après sa dernière réservation", async () => {
    const b = await request(3);
    const later = addYears(b.endsAt, 3);
    const just = await applyRetention(addDays(later, -2), DEFAULT_SETTINGS);
    expect(just.anonymizedCustomers).toBe(0);
    const after = await applyRetention(addDays(later, 2), DEFAULT_SETTINGS);
    expect(after.anonymizedCustomers).toBe(1);
    expect(after.cleanedBookings).toBe(1);
    const c = await prisma.customer.findUniqueOrThrow({ where: { id: b.customerId } });
    expect(c.anonymizedAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "customer.erase", actorLabel: "système (tâche automatique)" } })).toBe(1);
  });

  it("garde le contact d'un client récent ou ayant une réservation récente", async () => {
    const b = await request(3);
    const r = await applyRetention(addYears(new Date(), 1), DEFAULT_SETTINGS);
    expect(r.anonymizedCustomers).toBe(0);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: b.customerId } })).anonymizedAt).toBeNull();
  });

  it("consentement prospection : conservé jusqu'à 3 ans après le dernier contact, puis anonymisation", async () => {
    const b = await request(3, "camille@example.com", true);
    const r1 = await applyRetention(addDays(addYears(b.endsAt, 3), 2), { ...DEFAULT_SETTINGS, retentionBookingYears: 3, retentionProspectYears: 3 });
    // dernier contact = date de la demande (il y a ~3 ans + 5 jours) : consentement expiré → anonymisé
    expect(r1.expiredConsents).toBe(1);
    expect(r1.anonymizedCustomers).toBe(1);
  });

  it("purge le journal d'audit au-delà de 12 mois", async () => {
    await prisma.auditLog.create({ data: { actorLabel: "x", action: "booking.view", entityType: "Booking", createdAt: addDays(new Date(), -400) } });
    await prisma.auditLog.create({ data: { actorLabel: "x", action: "booking.view", entityType: "Booking" } });
    expect((await applyRetention(new Date(), DEFAULT_SETTINGS)).auditPurged).toBe(1);
  });
});
