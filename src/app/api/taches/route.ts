/**
 * Déclenchement des tâches automatiques par l'hébergeur (tâche planifiée « cron »).
 * Appel : POST /api/taches avec l'en-tête « Authorization: Bearer <CRON_SECRET> ».
 */
import { timingSafeEqual } from "node:crypto";
import { runJobs } from "@/lib/jobs/run";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "a-remplacer" || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("Non autorisé", { status: 401 });
  const report = await runJobs();
  console.log(`[tâches] ${JSON.stringify(report)}`);
  return Response.json(report);
}
