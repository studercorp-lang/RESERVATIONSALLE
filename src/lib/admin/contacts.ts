/** Liste des contacts clients (hors personnes effacées), pour l'équipe. */
import type { Prisma } from "@prisma/client";

export type ContactFilters = { q?: string; prospection?: boolean };

export function contactWhere(f: ContactFilters): Prisma.CustomerWhereInput {
  const q = f.q?.trim();
  return {
    anonymizedAt: null,
    ...(f.prospection ? { marketingOptIn: true } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
