/**
 * Vérifie que la BASE DE DONNÉES elle-même empêche les doubles réservations,
 * indépendamment du code de l'application.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BookingStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let roomId: string;
let customerId: string;
let n = 0;

const at = (iso: string) => new Date(iso);

function booking(start: string, end: string, bufferMin = 30, status: BookingStatus = BookingStatus.PENDING) {
  const endsAt = at(end);
  return prisma.booking.create({
    data: {
      reference: `TEST-${++n}`,
      roomId,
      customerId,
      startsAt: at(start),
      endsAt,
      blockedUntil: new Date(endsAt.getTime() + bufferMin * 60_000),
      attendees: 10,
      status,
    },
  });
}

beforeEach(async () => {
  await prisma.consent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.room.deleteMany();
  const room = await prisma.room.create({
    data: { slug: "test", name: "Salle test", description: "", capacity: 20, bufferMin: 30 },
  });
  const customer = await prisma.customer.create({
    data: { email: "test@example.com", firstName: "Test", lastName: "Test", phone: "+33199000000" },
  });
  roomId = room.id;
  customerId = customer.id;
});

afterAll(() => prisma.$disconnect());

describe("contrainte anti-double réservation (PostgreSQL)", () => {
  it("refuse deux réservations qui se chevauchent sur la même salle", async () => {
    await booking("2027-01-15T09:00:00Z", "2027-01-15T11:00:00Z");
    await expect(booking("2027-01-15T10:00:00Z", "2027-01-15T12:00:00Z")).rejects.toThrow();
  });

  it("refuse une réservation qui commence pendant le temps tampon de la précédente", async () => {
    await booking("2027-01-15T09:00:00Z", "2027-01-15T11:00:00Z"); // bloquée jusqu'à 11h30
    await expect(booking("2027-01-15T11:15:00Z", "2027-01-15T12:00:00Z")).rejects.toThrow();
  });

  it("refuse une réservation dont le tampon empiète sur la suivante", async () => {
    await booking("2027-01-15T11:00:00Z", "2027-01-15T12:00:00Z");
    await expect(booking("2027-01-15T09:00:00Z", "2027-01-15T10:45:00Z")).rejects.toThrow(); // bloquée jusqu'à 11h15
  });

  it("accepte des réservations bout à bout en respectant le tampon", async () => {
    await booking("2027-01-15T09:00:00Z", "2027-01-15T11:00:00Z");
    await expect(booking("2027-01-15T11:30:00Z", "2027-01-15T12:00:00Z")).resolves.toBeTruthy();
  });

  it("ignore les réservations annulées, refusées ou expirées", async () => {
    for (const status of [BookingStatus.CANCELLED, BookingStatus.REFUSED, BookingStatus.EXPIRED]) {
      await booking("2027-01-15T09:00:00Z", "2027-01-15T11:00:00Z", 30, status);
    }
    await expect(booking("2027-01-15T09:00:00Z", "2027-01-15T11:00:00Z")).resolves.toBeTruthy();
  });

  it("autorise le même créneau dans deux salles différentes", async () => {
    await booking("2027-01-15T09:00:00Z", "2027-01-15T11:00:00Z");
    const other = await prisma.room.create({ data: { slug: "autre", name: "Autre", description: "", capacity: 5 } });
    await expect(
      prisma.booking.create({
        data: {
          reference: "TEST-AUTRE", roomId: other.id, customerId, attendees: 2,
          startsAt: at("2027-01-15T09:00:00Z"), endsAt: at("2027-01-15T11:00:00Z"), blockedUntil: at("2027-01-15T11:30:00Z"),
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("20 demandes simultanées sur le même créneau : une seule est acceptée", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => booking("2027-02-01T09:00:00Z", "2027-02-01T11:00:00Z")),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.booking.count()).toBe(1);
  });

  it("refuse un créneau dont la fin précède le début", async () => {
    await expect(booking("2027-01-15T11:00:00Z", "2027-01-15T09:00:00Z")).rejects.toThrow();
  });
});
