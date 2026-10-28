/** Actions de l'équipe : confirmer, refuser, annuler, déplacer (salle incluse), saisir, exporter. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  bookingWhere,
  cancelBookingByTeam,
  completeBooking,
  confirmBooking,
  createBookingByTeam,
  refuseBooking,
  rescheduleByTeam,
} from "@/lib/admin/bookings";
import { toCsv } from "@/lib/admin/csv";
import { findBookingByToken } from "@/lib/booking/manage";
import { submitBookingRequest } from "@/lib/booking/request";
import { memoryOutbox } from "@/lib/email/transport";

process.env.EMAIL_TRANSPORT = "memory";
const actor = { id: "", label: "équipe:test" };
let salon: string;
let atelier: string;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
const tokenIn = (text: string) => /\/reservation\/([A-Za-z0-9_-]{43})/.exec(text)?.[1];

async function request(days = 20, start = "1080", end = "1260", email = "client@example.com") {
  const res = await submitBookingRequest({
    roomSlug: "salon", slot: { date: inDays(days), startMin: start, endMin: end, attendees: "10" },
    contact: { lastName: "Client", firstName: "Test", email, phone: "0612345678" }, acceptTerms: true, marketingOptIn: false,
  });
  if (!res.ok) throw new Error(JSON.stringify(res));
  const b = await prisma.booking.findFirstOrThrow({ where: { reference: res.booking.reference } });
  memoryOutbox.length = 0;
  return b;
}

beforeEach(async () => {
  memoryOutbox.length = 0;
  await prisma.auditLog.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.room.deleteMany();
  await prisma.adminUser.deleteMany();
  actor.id = (await prisma.adminUser.create({ data: { email: "a@example.com", name: "Alice", passwordHash: "x" } })).id;
  const hours = { create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, openMin: 900, closeMin: 1620, lastStartMin: 1320 })) };
  salon = (await prisma.room.create({ data: { slug: "salon", name: "Salon", description: "", capacity: 30, openingHours: hours } })).id;
  atelier = (await prisma.room.create({ data: { slug: "atelier", name: "Atelier", description: "", capacity: 12, openingHours: hours } })).id;
});

afterAll(() => prisma.$disconnect());

describe("décisions de l'équipe", () => {
  it("confirmer : statut, e-mail avec NOUVEAU lien (l'ancien ne marche plus), audit", async () => {
    const b = await request();
    const oldHash = b.manageTokenHash;
    expect(await confirmBooking(b.id, actor, { notify: true, message: "Devis joint" })).toEqual({ ok: true });
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.status).toBe("CONFIRMED");
    expect(after.pendingExpiresAt).toBeNull();
    expect(after.manageTokenHash).not.toBe(oldHash);
    expect(memoryOutbox[0].subject).toContain("confirmée");
    expect(memoryOutbox[0].text).toContain("Devis joint");
    expect(await findBookingByToken(tokenIn(memoryOutbox[0].text)!)).not.toBeNull();
    expect(await prisma.auditLog.findFirst({ where: { action: "booking.confirm", actorId: actor.id } })).not.toBeNull();
  });

  it("confirmer sans prévenir : aucun e-mail", async () => {
    const b = await request();
    await confirmBooking(b.id, actor, { notify: false });
    expect(memoryOutbox).toHaveLength(0);
  });

  it("refuser libère le créneau", async () => {
    const b = await request();
    expect((await refuseBooking(b.id, actor, { notify: true })).ok).toBe(true);
    expect(memoryOutbox[0].text).toContain("ne pouvons pas donner suite");
    await expect(request(20, "1080", "1260", "autre@example.com")).resolves.toBeTruthy();
  });

  it("on ne refuse pas une réservation déjà confirmée (il faut l'annuler)", async () => {
    const b = await request();
    await confirmBooking(b.id, actor, { notify: false });
    expect((await refuseBooking(b.id, actor, { notify: false })).ok).toBe(false);
    expect((await cancelBookingByTeam(b.id, actor, { notify: true })).ok).toBe(true);
    expect(memoryOutbox[0].text).toContain("annulée par notre équipe");
  });

  it("réactiver une demande expirée si le créneau est toujours libre, sinon refus clair", async () => {
    const b = await request();
    await prisma.booking.update({ where: { id: b.id }, data: { status: "EXPIRED" } });
    const other = await request(20, "1080", "1260", "autre@example.com"); // reprend le créneau
    expect(await confirmBooking(b.id, actor, { notify: false })).toEqual({ ok: false, error: "Le créneau a été réservé par quelqu'un d'autre entre-temps." });
    await refuseBooking(other.id, actor, { notify: false });
    expect((await confirmBooking(b.id, actor, { notify: false })).ok).toBe(true);
  });

  it("terminer : seulement une réservation confirmée", async () => {
    const b = await request();
    expect((await completeBooking(b.id, actor)).ok).toBe(false);
    await confirmBooking(b.id, actor, { notify: false });
    expect((await completeBooking(b.id, actor)).ok).toBe(true);
  });
});

describe("déplacement par l'équipe", () => {
  it("peut changer de salle et vérifie la capacité", async () => {
    const b = await request();
    const slot = { date: inDays(21), startMin: "1200", endMin: "1560", attendees: "10" };
    expect((await rescheduleByTeam(b.id, actor, { roomId: atelier, ...slot }, { notify: true })).ok).toBe(true);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.roomId).toBe(atelier);
    expect(memoryOutbox[0].subject).toContain("Modification");
    expect((await rescheduleByTeam(b.id, actor, { roomId: atelier, ...slot, attendees: "20" }, { notify: false })).ok).toBe(false);
  });

  it("n'est pas soumis au délai de 24 h, mais aux horaires", async () => {
    const b = await request();
    const tomorrow = inDays(1);
    expect((await rescheduleByTeam(b.id, actor, { roomId: salon, date: tomorrow, startMin: "1080", endMin: "1200", attendees: "10" }, { notify: false })).ok).toBe(true);
    const r = await rescheduleByTeam(b.id, actor, { roomId: salon, date: tomorrow, startMin: "1350", endMin: "1440", attendees: "10" }, { notify: false });
    expect(r.ok).toBe(false);
  });
});

describe("saisie manuelle", () => {
  const contact = { lastName: "Tel", firstName: "Client", email: "tel@example.com", phone: "0611223344" };

  it("crée une réservation confirmée, sans consentement marketing, avec lien de gestion", async () => {
    const r = await createBookingByTeam(actor, {
      roomId: salon, slot: { date: inDays(2), startMin: "1080", endMin: "1200", attendees: "5" }, contact,
      status: "CONFIRMED", sendEmail: true, termsInformed: true,
    });
    expect(r.ok).toBe(true);
    const b = await prisma.booking.findFirstOrThrow({ include: { customer: true } });
    expect([b.status, b.source, b.customer.marketingOptIn]).toEqual(["CONFIRMED", "BACKOFFICE", false]);
    expect(await findBookingByToken(tokenIn(memoryOutbox[0].text)!)).not.toBeNull();
  });

  it("exige que le client ait été informé des conditions", async () => {
    const r = await createBookingByTeam(actor, {
      roomId: salon, slot: { date: inDays(2), startMin: "1080", endMin: "1200", attendees: "5" }, contact,
      status: "PENDING", sendEmail: false, termsInformed: false,
    });
    expect(r.ok).toBe(false);
    expect(await prisma.booking.count()).toBe(0);
  });
});

describe("liste et export", () => {
  it("filtre par recherche texte et statut", async () => {
    await request();
    await request(25, "1080", "1260", "dupont@example.com");
    expect(await prisma.booking.count({ where: bookingWhere({ q: "DUPONT" }) })).toBe(1);
    expect(await prisma.booking.count({ where: bookingWhere({ status: "PENDING" }) })).toBe(2);
    expect(await prisma.booking.count({ where: bookingWhere({ status: "CONFIRMED" }) })).toBe(0);
  });

  it("CSV : séparateur ; , BOM, guillemets et neutralisation des formules", () => {
    const csv = toCsv(["A", "B"], [["=HYPERLINK(\"x\")", "texte; avec \"guillemets\""]]);
    expect(csv.startsWith("﻿A;B\r\n")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"texte; avec ""guillemets"""`);
  });
});
