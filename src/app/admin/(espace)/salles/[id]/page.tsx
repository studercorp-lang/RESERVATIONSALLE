import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { bookingsOutsideHours } from "@/lib/admin/rooms";
import { formatSlot } from "@/lib/format";
import { Flash, PageTitle } from "@/components/admin";
import { Card } from "@/components/ui";
import { ClosuresSection, HoursForm, PhotosSection, PricesForm, RoomInfoForm } from "../RoomSections";

export const metadata = { title: "Salle" };

const FLASH = {
  creee: "Salle créée. Renseignez maintenant ses horaires et ses tarifs.",
  infos: "Informations enregistrées.",
  horaires: "Horaires enregistrés.",
  tarifs: "Tarifs enregistrés.",
  blocage: "Blocage enregistré.",
  "blocage-supprime": "Blocage supprimé : le créneau est de nouveau réservable.",
  photo: "Photo ajoutée.",
  "photo-supprimee": "Photo supprimée.",
  "photo-deplacee": "Ordre des photos modifié.",
};

export default async function RoomAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; chevauche?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const now = new Date();
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      openingHours: true,
      priceRules: true,
      photos: { orderBy: { sortOrder: "asc" }, select: { id: true, alt: true } },
      closures: { where: { endsAt: { gt: now } }, orderBy: { startsAt: "asc" } },
    },
  });
  if (!room) notFound();
  const outside = await bookingsOutsideHours(room.id, now);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/salles" className="text-sm text-brand underline">← Salles</Link>
        <PageTitle actions={room.active ? <Link href={`/salles/${room.slug}`} className="text-sm text-brand underline" target="_blank">Voir sur le site</Link> : undefined}>{room.name}</PageTitle>
      </div>
      <Flash messages={FLASH} code={sp.ok} />
      {sp.chevauche && <div role="alert" className="rounded-md border-l-4 border-danger bg-red-50 p-3">Attention : ce blocage chevauche des réservations existantes ({sp.chevauche}). Elles n&apos;ont pas été annulées : traitez-les depuis leur fiche.</div>}
      {outside.length > 0 && (
        <div role="alert" className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-sm">
          <p className="font-semibold">Réservations à venir en dehors des horaires actuels :</p>
          <ul className="mt-1 list-inside list-disc">
            {outside.map((b) => <li key={b.id}><Link href={`/admin/reservations/${b.id}`} className="underline">{b.reference}</Link> — {formatSlot(b.startsAt, b.endsAt)}</li>)}
          </ul>
        </div>
      )}

      <Card><h2 className="mb-4 text-lg font-semibold">Horaires d&apos;ouverture</h2><HoursForm roomId={room.id} hours={room.openingHours} /></Card>
      <Card><h2 className="mb-1 text-lg font-semibold">Bloquer des créneaux</h2><p className="mb-4 text-sm text-muted">Travaux, privatisation, événement interne… Le créneau n&apos;est plus proposé aux clients.</p><ClosuresSection roomId={room.id} closures={room.closures} /></Card>
      <Card><h2 className="mb-4 text-lg font-semibold">Tarifs indicatifs</h2><PricesForm roomId={room.id} prices={room.priceRules} /></Card>
      <Card><h2 className="mb-4 text-lg font-semibold">Photos</h2><PhotosSection roomId={room.id} photos={room.photos} /></Card>
      <Card><h2 className="mb-4 text-lg font-semibold">Informations générales</h2><RoomInfoForm room={room} /></Card>
    </div>
  );
}
