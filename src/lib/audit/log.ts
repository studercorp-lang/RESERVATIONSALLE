/**
 * Journal d'audit : trace qui a consulté, modifié, exporté ou supprimé quelles
 * données, et quand. Ne jamais y mettre de données personnelles en clair :
 * uniquement des identifiants techniques et des noms de champs.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const ACTOR_CUSTOMER = "client (lien de gestion)";
export const ACTOR_SYSTEM = "système (tâche automatique)";

export async function audit(
  entry: {
    actorId?: string | null;
    actorLabel: string;
    action: string; // ex. "booking.cancel"
    entityType: string; // ex. "Booking"
    entityId?: string | null;
    details?: Prisma.InputJsonValue;
  },
  db: Prisma.TransactionClient = prisma,
) {
  await db.auditLog.create({ data: { ...entry, actorId: entry.actorId ?? null, entityId: entry.entityId ?? null } });
}
