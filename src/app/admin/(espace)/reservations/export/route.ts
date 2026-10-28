/** Export CSV des réservations (filtres identiques à la liste). Réservé à l'équipe, tracé dans le journal. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/log";
import { bookingWhere } from "@/lib/admin/bookings";
import { toCsv } from "@/lib/admin/csv";
import { actorLabel, currentSession } from "@/lib/auth/session";
import { formatDate, formatPhone, formatTime } from "@/lib/format";
import { STATUS_ADMIN } from "@/components/admin";

export async function GET(req: Request) {
  const session = await currentSession();
  if (!session || !session.totpPassed || !session.user.totpEnabled || session.user.mustChangePassword) {
    return NextResponse.redirect(new URL("/admin/connexion", req.url));
  }
  const p = new URL(req.url).searchParams;
  const filters = { status: p.get("statut") ?? undefined, roomId: p.get("salle") ?? undefined, from: p.get("du") ?? undefined, to: p.get("au") ?? undefined, q: p.get("q") ?? undefined };
  const rows = await prisma.booking.findMany({ where: bookingWhere(filters), orderBy: { startsAt: "asc" }, include: { room: true, customer: true }, take: 10_000 });

  await audit({ actorId: session.userId, actorLabel: actorLabel(session), action: "booking.export", entityType: "Booking", details: { count: rows.length, filters } });

  const csv = toCsv(
    ["Référence", "Statut", "Salle", "Date", "Début", "Fin", "Personnes", "Estimation TTC (€)", "Nom", "Prénom", "Société", "E-mail", "Téléphone", "Commentaire client", "Note interne", "Origine", "Créée le"],
    rows.map((b) => [
      b.reference, STATUS_ADMIN[b.status].label, b.room.name, formatDate(b.startsAt), formatTime(b.startsAt), formatTime(b.endsAt), b.attendees,
      b.estimatedCents != null ? (b.estimatedCents / 100).toFixed(2).replace(".", ",") : "",
      b.customer.lastName, b.customer.firstName, b.customer.company ?? "", b.customer.email, formatPhone(b.customer.phone),
      b.comment ?? "", b.internalNote ?? "", b.source === "ONLINE" ? "Site" : "Équipe", formatDate(b.createdAt),
    ]),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservations-quai19-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
