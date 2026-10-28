import Link from "next/link";
import { getTimeOptions } from "@/lib/availability/search";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { dateBounds } from "@/lib/validation/search-params";
import { SearchForm } from "@/components/SearchForm";
import { Card, PhotoPlaceholder } from "@/components/ui";
import { SITE } from "@/config/site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, times, rooms] = await Promise.all([
    getSettings(),
    getTimeOptions(),
    prisma.room.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, include: { photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { id: true, alt: true } } } }),
  ]);
  const bounds = dateBounds(settings);

  return (
    <div className="space-y-10">
      <section aria-labelledby="titre">
        <h1 id="titre" className="text-3xl font-bold sm:text-4xl">Réservez votre salle chez {SITE.name}</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">
          Choisissez votre créneau, envoyez votre demande en quelques minutes : notre équipe vous recontacte avec un devis personnalisé.
        </p>
      </section>

      <section id="recherche" aria-labelledby="titre-recherche">
        <Card>
          <h2 id="titre-recherche" className="mb-4 text-xl font-semibold">Quand souhaitez-vous venir ?</h2>
          <SearchForm {...bounds} times={times} />
        </Card>
      </section>

      <section id="salles" aria-labelledby="titre-salles">
        <h2 id="titre-salles" className="mb-4 text-2xl font-semibold">Nos salles</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <Card className="flex h-full flex-col">
                {room.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/photos/${room.photos[0].id}`} alt={room.photos[0].alt} className="aspect-[16/9] w-full rounded-md object-cover" loading="lazy" />
                ) : (
                  <PhotoPlaceholder name={room.name} />
                )}
                <h3 className="mt-3 text-lg font-semibold">{room.name}</h3>
                <p className="text-sm text-muted">Jusqu&apos;à {room.capacity} personnes{room.accessiblePmr ? " · Accessible PMR" : ""}</p>
                <p className="mt-2 flex-1 text-sm">{room.description}</p>
                <Link href={`/salles/${room.slug}`} className="mt-3 font-medium text-brand underline">
                  Voir la salle et ses disponibilités<span className="sr-only"> : {room.name}</span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
