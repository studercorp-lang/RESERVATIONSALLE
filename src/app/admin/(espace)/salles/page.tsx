import Link from "next/link";
import { prisma } from "@/lib/db";
import { minutesLabel } from "@/lib/format";
import { Flash, PageTitle, primarySmall } from "@/components/admin";
import { Card } from "@/components/ui";
import { ClosuresSection } from "./RoomSections";

export const metadata = { title: "Salles et horaires" };
const DAYS = ["", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ ok?: string; chevauche?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const [rooms, globalClosures] = await Promise.all([
    prisma.room.findMany({ orderBy: { sortOrder: "asc" }, include: { openingHours: { orderBy: { weekday: "asc" } }, _count: { select: { photos: true } } } }),
    prisma.closure.findMany({ where: { roomId: null, endsAt: { gt: now } }, orderBy: { startsAt: "asc" } }),
  ]);
  return (
    <div className="space-y-8">
      <PageTitle actions={<Link href="/admin/salles/nouvelle" className={primarySmall}>+ Nouvelle salle</Link>}>Salles et horaires</PageTitle>
      <Flash messages={{ blocage: "Blocage enregistré.", "blocage-supprime": "Blocage supprimé." }} code={sp.ok} />
      {sp.chevauche && <div role="alert" className="rounded-md border-l-4 border-danger bg-red-50 p-3">Attention : ce blocage chevauche des réservations existantes ({sp.chevauche}). Elles n&apos;ont pas été annulées : traitez-les depuis leur fiche.</div>}

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <li key={r.id}>
            <Card className="h-full">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold">{r.name}</h2>
                {!r.active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs">Inactive</span>}
              </div>
              <p className="text-sm text-muted">{r.capacity} personnes · {r._count.photos} photo{r._count.photos > 1 ? "s" : ""}</p>
              <ul className="mt-2 text-sm">
                {r.openingHours.length === 0 ? <li className="text-danger">Aucun horaire : salle non réservable</li> : r.openingHours.map((h) => (
                  <li key={h.id}>{DAYS[h.weekday]} {minutesLabel(h.openMin)} – {minutesLabel(h.closeMin)}{h.lastStartMin != null && <span className="text-muted"> (début ≤ {minutesLabel(h.lastStartMin)})</span>}</li>
                ))}
              </ul>
              <Link href={`/admin/salles/${r.id}`} className="mt-3 inline-block font-medium text-brand underline">Modifier<span className="sr-only"> {r.name}</span></Link>
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Fermetures de tout l&apos;établissement</h2>
        <p className="mb-4 text-sm text-muted">Congés, jours fériés, privatisation complète : bloque toutes les salles à la fois.</p>
        <ClosuresSection roomId={null} closures={globalClosures} />
      </Card>
    </div>
  );
}
