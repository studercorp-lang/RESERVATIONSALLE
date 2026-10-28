import Link from "next/link";
import { BookingStatus } from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { formatSlot } from "@/lib/format";
import { Flash, PageTitle, StatusBadge, primarySmall } from "@/components/admin";
import { Card } from "@/components/ui";

const FLASH = {
  "mot-de-passe": "Votre mot de passe a été modifié.",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ ok?: string; refus?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const [pending, upcoming, pendingCount, weekCount] = await Promise.all([
    prisma.booking.findMany({ where: { status: BookingStatus.PENDING }, orderBy: { createdAt: "asc" }, take: 10, include: { room: true, customer: true } }),
    prisma.booking.findMany({
      where: { status: BookingStatus.CONFIRMED, startsAt: { gte: now, lt: addDays(now, 7) } },
      orderBy: { startsAt: "asc" },
      include: { room: true, customer: true },
    }),
    prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.booking.count({ where: { status: BookingStatus.CONFIRMED, startsAt: { gte: now, lt: addDays(now, 7) } } }),
  ]);

  const row = (b: (typeof pending)[number], extra?: React.ReactNode) => (
    <li key={b.id} className="flex flex-col gap-1 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Link href={`/admin/reservations/${b.id}`} className="font-semibold text-brand underline">{b.reference}</Link> · {b.room.name} · {b.attendees} pers.
        <p className="text-sm first-letter:uppercase">{formatSlot(b.startsAt, b.endsAt)}</p>
        <p className="text-sm text-muted">{b.customer.firstName} {b.customer.lastName}{b.customer.company ? ` — ${b.customer.company}` : ""}</p>
      </div>
      {extra}
    </li>
  );

  return (
    <div>
      <PageTitle actions={<Link href="/admin/reservations/nouvelle" className={primarySmall}>+ Saisir une réservation</Link>}>Tableau de bord</PageTitle>
      <Flash messages={FLASH} code={sp.ok} />
      {sp.refus === "droits" && <div role="alert" className="mb-4 rounded-md border-l-4 border-danger bg-red-50 p-3">Cette page est réservée aux administrateurs.</div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card><p className="text-sm text-muted">Demandes à traiter</p><p className="text-3xl font-bold">{pendingCount}</p></Card>
        <Card><p className="text-sm text-muted">Réservations confirmées (7 prochains jours)</p><p className="text-3xl font-bold">{weekCount}</p></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Demandes en attente (les plus anciennes d&apos;abord)</h2>
          {pending.length === 0 ? <p className="text-muted">Aucune demande en attente.</p> : (
            <ul>{pending.map((b) => row(b, b.pendingExpiresAt && (
              <span className={`text-xs ${b.pendingExpiresAt < addDays(now, 2) ? "font-semibold text-danger" : "text-muted"}`}>
                Expire le {b.pendingExpiresAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
              </span>
            )))}</ul>
          )}
          {pendingCount > pending.length && <Link href="/admin/reservations?statut=PENDING" className="text-sm text-brand underline">Voir toutes les demandes</Link>}
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Prochaines réservations confirmées</h2>
          {upcoming.length === 0 ? <p className="text-muted">Rien de prévu dans les 7 prochains jours.</p> : <ul>{upcoming.map((b) => row(b, <StatusBadge status={b.status} />))}</ul>}
        </Card>
      </div>
    </div>
  );
}
