/** Téléchargement des données d'une personne (JSON ou CSV) — administrateurs uniquement. */
import { NextResponse } from "next/server";
import { actorLabel, currentSession } from "@/lib/auth/session";
import { exportPerson } from "@/lib/gdpr/person";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session || !session.totpPassed || session.user.mustChangePassword || session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin/connexion", req.url));
  }
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const file = await exportPerson((await params).id, { id: session.userId, label: actorLabel(session) }, format);
  if (!file) return new Response("Introuvable", { status: 404 });
  return new Response(file.body, {
    headers: { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="${file.filename}"`, "Cache-Control": "no-store" },
  });
}
