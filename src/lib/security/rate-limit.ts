/**
 * Limitation du nombre de requêtes (anti-abus / anti-spam), stockée en base :
 * pas besoin de serveur supplémentaire. Fenêtre fixe : `limit` actions par
 * tranche de `windowSec` secondes et par clé.
 *
 * La clé est une empreinte salée (ex. de l'adresse IP) : l'adresse IP elle-même
 * n'est jamais enregistrée.
 */
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

export function rateKey(bucket: string, identifier: string): string {
  const salt = process.env.AUTH_SECRET ?? "dev";
  return `${bucket}:${createHash("sha256").update(`${salt}|${identifier}`).digest("hex").slice(0, 32)}`;
}

/** Renvoie true si l'action est autorisée, false si la limite est atteinte. */
export async function consumeRateLimit(key: string, limit: number, windowSec: number, now = new Date()): Promise<boolean> {
  const windowStart = new Date(Math.floor(now.getTime() / (windowSec * 1000)) * windowSec * 1000);
  // Une seule requête SQL atomique : pas de « course » entre deux requêtes simultanées.
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limits" ("key", "count", "windowStart") VALUES (${key}, 1, ${windowStart})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limits"."windowStart" = EXCLUDED."windowStart" THEN "rate_limits"."count" + 1 ELSE 1 END,
      "windowStart" = EXCLUDED."windowStart"
    RETURNING "count"`;
  return rows[0].count <= limit;
}

/** Adresse IP du visiteur (derrière le proxy de l'hébergeur), utilisée uniquement pour calculer la clé. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
