import Link from "next/link";
import { prisma } from "@/lib/db";
import { contactWhere } from "@/lib/admin/contacts";
import { requireStaff } from "@/lib/auth/session";
import { formatPhone, formatShortDate } from "@/lib/format";
import { PageTitle, primarySmall, smallButton } from "@/components/admin";
import { inputClass } from "@/components/ui";

export const metadata = { title: "Contacts" };
const PAGE_SIZE = 50;

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; prospection?: string; page?: string }> }) {
  const [sp, session] = await Promise.all([searchParams, requireStaff()]);
  const page = Math.max(1, Number(sp.page) || 1);
  const filters = { q: sp.q, prospection: sp.prospection === "1" };
  const where = contactWhere(filters);
  const [total, contacts] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { lastContactAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { bookings: true } }, bookings: { orderBy: { startsAt: "desc" }, take: 1, select: { startsAt: true } } },
    }),
  ]);
  const query = new URLSearchParams(Object.entries({ q: sp.q ?? "", prospection: sp.prospection ?? "" }).filter(([, v]) => v));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div>
      {/* Lien simple (pas de préchargement) : un export ne doit partir que sur clic */}
      <PageTitle actions={<a href={`/admin/contacts/export?${query}`} className={smallButton}>Exporter (CSV)</a>}>Contacts</PageTitle>
      <p className="mb-4 text-sm text-muted">
        Les personnes ayant fait une demande de réservation. Pour une campagne commerciale, utilisez uniquement le filtre « Accord pour la prospection » : contacter les autres n&apos;est pas autorisé.
      </p>
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4">
        <div className="min-w-60 flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium">Recherche</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Nom, e-mail, société" className={inputClass} />
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="prospection" value="1" defaultChecked={filters.prospection} className="h-4 w-4 accent-brand" /> Accord pour la prospection uniquement
        </label>
        <button className={primarySmall}>Filtrer</button>
      </form>

      <p className="mb-2 text-sm text-muted" aria-live="polite">{total} contact{total > 1 ? "s" : ""}</p>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-surface">
            <tr>
              <th scope="col" className="p-3">Nom</th>
              <th scope="col" className="p-3">Société</th>
              <th scope="col" className="p-3">E-mail</th>
              <th scope="col" className="p-3">Téléphone</th>
              <th scope="col" className="p-3">Réservations</th>
              <th scope="col" className="p-3">Prospection</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="p-3 font-medium">
                  {isAdmin ? <Link href={`/admin/donnees-personnelles/${c.id}`} className="text-brand underline">{c.firstName} {c.lastName}</Link> : `${c.firstName} ${c.lastName}`}
                </td>
                <td className="p-3">{c.company ?? "—"}</td>
                <td className="p-3"><a href={`mailto:${c.email}`} className="text-brand underline">{c.email}</a></td>
                <td className="p-3 whitespace-nowrap"><a href={`tel:${c.phone}`}>{formatPhone(c.phone)}</a></td>
                <td className="p-3">
                  <Link href={`/admin/reservations?q=${encodeURIComponent(c.email)}`} className="text-brand underline">{c._count.bookings}</Link>
                  {c.bookings[0] && <span className="text-muted"> · dernière {formatShortDate(c.bookings[0].startsAt)}</span>}
                </td>
                <td className="p-3">{c.marketingOptIn ? "Oui" : "Non"}</td>
              </tr>
            ))}
            {contacts.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">Aucun contact.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`/admin/contacts?${new URLSearchParams({ ...Object.fromEntries(query), page: String(page - 1) })}`} className={smallButton}>← Précédente</Link>}
          <span>Page {page} / {pages}</span>
          {page < pages && <Link href={`/admin/contacts?${new URLSearchParams({ ...Object.fromEntries(query), page: String(page + 1) })}`} className={smallButton}>Suivante →</Link>}
        </nav>
      )}
    </div>
  );
}
