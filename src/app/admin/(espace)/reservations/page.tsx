import Link from "next/link";
import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { bookingWhere } from "@/lib/admin/bookings";
import { formatEuros } from "@/lib/availability/pricing";
import { formatShortDate, formatTime } from "@/lib/format";
import { PageTitle, STATUS_ADMIN, StatusBadge, primarySmall, smallButton } from "@/components/admin";
import { inputClass } from "@/components/ui";

export const metadata = { title: "Réservations" };
const PAGE_SIZE = 50;

type SP = { statut?: string; salle?: string; du?: string; au?: string; q?: string; page?: string };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = bookingWhere({ status: sp.statut, roomId: sp.salle, from: sp.du, to: sp.au, q: sp.q });
  const [rooms, total, bookings] = await Promise.all([
    prisma.room.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { startsAt: sp.statut === "PENDING" ? "asc" : "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { room: { select: { name: true } }, customer: { select: { firstName: true, lastName: true, company: true } } },
    }),
  ]);
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "page" && v) as [string, string][]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (p: number) => `/admin/reservations?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) })}`;

  return (
    <div>
      <PageTitle
        actions={
          <>
            {/* Lien simple (pas de préchargement) : un export ne doit partir que sur clic */}
            <a href={`/admin/reservations/export?${query}`} className={smallButton}>Exporter (CSV)</a>
            <Link href="/admin/reservations/nouvelle" className={primarySmall}>+ Saisir une réservation</Link>
          </>
        }
      >
        Réservations
      </PageTitle>

      <form method="get" className="mb-6 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="mb-1 block text-sm font-medium">Recherche</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Référence, nom, e-mail, société" className={inputClass} />
        </div>
        <div>
          <label htmlFor="statut" className="mb-1 block text-sm font-medium">Statut</label>
          <select id="statut" name="statut" defaultValue={sp.statut ?? ""} className={inputClass}>
            <option value="">Tous</option>
            {Object.values(BookingStatus).map((s) => <option key={s} value={s}>{STATUS_ADMIN[s].label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="salle" className="mb-1 block text-sm font-medium">Salle</label>
          <select id="salle" name="salle" defaultValue={sp.salle ?? ""} className={inputClass}>
            <option value="">Toutes</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="du" className="mb-1 block text-sm font-medium">Du</label>
          <input id="du" name="du" type="date" defaultValue={sp.du} className={inputClass} />
        </div>
        <div>
          <label htmlFor="au" className="mb-1 block text-sm font-medium">Au</label>
          <input id="au" name="au" type="date" defaultValue={sp.au} className={inputClass} />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button className={primarySmall}>Filtrer</button>
          <Link href="/admin/reservations" className={smallButton}>Réinitialiser</Link>
        </div>
      </form>

      <p className="mb-2 text-sm text-muted" aria-live="polite">{total} réservation{total > 1 ? "s" : ""}</p>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-surface">
            <tr>
              <th scope="col" className="p-3">Référence</th>
              <th scope="col" className="p-3">Créneau</th>
              <th scope="col" className="p-3">Salle</th>
              <th scope="col" className="p-3">Client</th>
              <th scope="col" className="p-3">Pers.</th>
              <th scope="col" className="p-3">Estimation</th>
              <th scope="col" className="p-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-line last:border-0 hover:bg-surface">
                <td className="p-3"><Link href={`/admin/reservations/${b.id}`} className="font-semibold text-brand underline">{b.reference}</Link></td>
                <td className="p-3 whitespace-nowrap">{formatShortDate(b.startsAt)} · {formatTime(b.startsAt)}–{formatTime(b.endsAt)}</td>
                <td className="p-3">{b.room.name}</td>
                <td className="p-3">{b.customer.firstName} {b.customer.lastName}{b.customer.company && <span className="block text-xs text-muted">{b.customer.company}</span>}</td>
                <td className="p-3">{b.attendees}</td>
                <td className="p-3 whitespace-nowrap">{b.estimatedCents != null ? formatEuros(b.estimatedCents) : "—"}</td>
                <td className="p-3"><StatusBadge status={b.status} /></td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted">Aucune réservation ne correspond à ces critères.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && <Link href={pageLink(page - 1)} className={smallButton}>← Précédente</Link>}
          <span>Page {page} / {pages}</span>
          {page < pages && <Link href={pageLink(page + 1)} className={smallButton}>Suivante →</Link>}
        </nav>
      )}
    </div>
  );
}
