/** Export CSV des contacts (équipe connectée uniquement, tracé dans le journal). */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/log";
import { contactWhere } from "@/lib/admin/contacts";
import { toCsv } from "@/lib/admin/csv";
import { actorLabel, currentSession } from "@/lib/auth/session";
import { formatDate, formatPhone } from "@/lib/format";

export async function GET(req: Request) {
  const session = await currentSession();
  if (!session || !session.totpPassed || !session.user.totpEnabled || session.user.mustChangePassword) {
    return NextResponse.redirect(new URL("/admin/connexion", req.url));
  }
  const p = new URL(req.url).searchParams;
  const filters = { q: p.get("q") ?? undefined, prospection: p.get("prospection") === "1" };
  const contacts = await prisma.customer.findMany({
    where: contactWhere(filters),
    orderBy: { lastName: "asc" },
    include: { _count: { select: { bookings: true } } },
    take: 50_000,
  });
  await audit({ actorId: session.userId, actorLabel: actorLabel(session), action: "contacts.export", entityType: "Customer", details: { count: contacts.length, filters } });
  const csv = toCsv(
    ["Nom", "Prénom", "Société", "E-mail", "Téléphone", "Nombre de réservations", "Accord prospection", "Dernier contact"],
    contacts.map((c) => [c.lastName, c.firstName, c.company ?? "", c.email, formatPhone(c.phone), c._count.bookings, c.marketingOptIn ? "oui" : "non", formatDate(c.lastContactAt)]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contacts-quai19${filters.prospection ? "-prospection" : ""}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
