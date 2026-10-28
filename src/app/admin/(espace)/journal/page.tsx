import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AUDIT_LABELS } from "@/lib/audit/labels";
import { requireStaff } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";
import { PageTitle, primarySmall, smallButton } from "@/components/admin";
import { inputClass } from "@/components/ui";

export const metadata = { title: "Journal d'audit" };
const PAGE_SIZE = 100;

const CATEGORIES: Record<string, string> = {
  "customer.": "Données personnelles",
  "booking.": "Réservations",
  "admin.": "Équipe et connexions",
  "room.": "Salles",
  "closure.": "Blocages",
  "settings.": "Réglages",
};

const entityLink = (type: string, id: string | null) =>
  !id ? null : type === "Booking" ? `/admin/reservations/${id}` : type === "Customer" ? `/admin/donnees-personnelles/${id}` : type === "Room" ? `/admin/salles/${id}` : null;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ categorie?: string; du?: string; au?: string; vues?: string; page?: string }> }) {
  await requireStaff("ADMIN");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (sp.categorie && sp.categorie in CATEGORIES) where.action = { startsWith: sp.categorie };
  if (sp.vues !== "1") where.NOT = { action: { in: ["booking.view", "customer.view"] } };
  const range: Prisma.DateTimeFilter = {};
  if (sp.du && /^\d{4}-\d{2}-\d{2}$/.test(sp.du)) range.gte = parisToUtc(sp.du, 0);
  if (sp.au && /^\d{4}-\d{2}-\d{2}$/.test(sp.au)) range.lt = parisToUtc(sp.au, 1440);
  if (range.gte || range.lt) where.createdAt = range;

  const [settings, total, logs] = await Promise.all([
    getSettings(),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { actor: { select: { name: true } } } }),
  ]);
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "page" && v) as [string, string][]);

  return (
    <div>
      <PageTitle>Journal d&apos;audit</PageTitle>
      <p className="mb-4 text-sm text-muted">Qui a consulté, modifié, exporté ou supprimé quoi, et quand. Conservé {settings.retentionAuditMonths} mois. Aucune donnée personnelle n&apos;y est recopiée.</p>
      <form method="get" className="mb-6 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div>
          <label htmlFor="categorie" className="mb-1 block text-sm font-medium">Catégorie</label>
          <select id="categorie" name="categorie" defaultValue={sp.categorie ?? ""} className={inputClass}>
            <option value="">Toutes</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label htmlFor="du" className="mb-1 block text-sm font-medium">Du</label><input id="du" name="du" type="date" defaultValue={sp.du} className={inputClass} /></div>
        <div><label htmlFor="au" className="mb-1 block text-sm font-medium">Au</label><input id="au" name="au" type="date" defaultValue={sp.au} className={inputClass} /></div>
        <label className="flex items-center gap-2 pb-2.5 text-sm"><input type="checkbox" name="vues" value="1" defaultChecked={sp.vues === "1"} className="h-4 w-4 accent-brand" /> Inclure les consultations</label>
        <div className="flex gap-2"><button className={primarySmall}>Filtrer</button><Link href="/admin/journal" className={smallButton}>Réinitialiser</Link></div>
      </form>

      <p className="mb-2 text-sm text-muted">{total} entrée{total > 1 ? "s" : ""}</p>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-surface">
            <tr><th scope="col" className="p-3">Date</th><th scope="col" className="p-3">Auteur</th><th scope="col" className="p-3">Action</th><th scope="col" className="p-3">Élément</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const href = entityLink(l.entityType, l.entityId);
              return (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="p-3 whitespace-nowrap">{l.createdAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</td>
                  <td className="p-3">{l.actor?.name ?? l.actorLabel}</td>
                  <td className="p-3">{AUDIT_LABELS[l.action] ?? l.action}</td>
                  <td className="p-3">{href ? <Link href={href} className="text-brand underline">voir</Link> : <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
            {logs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted">Aucune entrée.</td></tr>}
          </tbody>
        </table>
      </div>
      {total > PAGE_SIZE && (
        <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`/admin/journal?${new URLSearchParams({ ...Object.fromEntries(query), page: String(page - 1) })}`} className={smallButton}>← Plus récentes</Link>}
          <span>Page {page} / {Math.ceil(total / PAGE_SIZE)}</span>
          {page * PAGE_SIZE < total && <Link href={`/admin/journal?${new URLSearchParams({ ...Object.fromEntries(query), page: String(page + 1) })}`} className={smallButton}>Plus anciennes →</Link>}
        </nav>
      )}
    </div>
  );
}
