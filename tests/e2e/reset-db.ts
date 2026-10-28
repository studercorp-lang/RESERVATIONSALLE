/**
 * Vide la base de test de bout en bout (structure conservée).
 * Sécurité : refuse de s'exécuter si l'adresse de la base ne contient pas « e2e ».
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/e2e/.test(new URL(url).pathname)) {
  console.error("Refus : cette commande ne vide que la base de test « …e2e ».");
  process.exit(1);
}

const prisma = new PrismaClient();
prisma
  .$executeRawUnsafe(
    "TRUNCATE audit_logs, admin_sessions, admin_users, consents, bookings, customers, closures, price_rules, opening_hours, room_photos, rooms, settings, rate_limits CASCADE",
  )
  .finally(() => prisma.$disconnect());
