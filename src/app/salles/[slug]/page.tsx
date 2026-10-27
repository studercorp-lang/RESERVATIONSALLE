import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { formatEuros } from "@/lib/availability/pricing";
import { getRoomSchedule } from "@/lib/availability/search";
import { minutesLabel } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { parisToUtc, utcToParis } from "@/lib/time";
import { dateBounds } from "@/lib/validation/search-params";
import { SearchForm } from "@/components/SearchForm";
import { WeekSchedule } from "@/components/WeekSchedule";
import { Card, PhotoPlaceholder } from "@/components/ui";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
};

const WEEKDAYS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const getRoom = (slug: string) =>
  prisma.room.findFirst({
    where: { slug, active: true },
    include: { photos: { orderBy: { sortOrder: "asc" } }, priceRules: true, openingHours: { orderBy: [{ weekday: "asc" }, { openMin: "asc" }] } },
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const room = await getRoom((await params).slug);
  return { title: room?.name ?? "Salle introuvable" };
}

/** Regroupe les jours consécutifs ayant la même valeur : « Lundi – Vendredi ». */
function groupDays<T>(valueOf: (weekday: number) => T, key: (v: T) => string) {
  const groups: { from: number; to: number; value: T }[] = [];
  for (let d = 1; d <= 7; d++) {
    const v = valueOf(d);
    const last = groups[groups.length - 1];
    if (last && key(last.value) === key(v)) last.to = d;
    else groups.push({ from: d, to: d, value: v });
  }
  return groups.map((g) => ({ label: g.from === g.to ? WEEKDAYS[g.from] : `${WEEKDAYS[g.from]} – ${WEEKDAYS[g.to]}`, value: g.value }));
}

export default async function RoomPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const room = await getRoom(slug);
  if (!room) notFound();

  const settings = await getSettings();
  const bounds = dateBounds(settings);
  const today = bounds.minDate;
  const from = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date >= today && sp.date <= bounds.maxDate ? sp.date : today;
  const shift = (iso: string, n: number) => utcToParis(addDays(parisToUtc(iso, 12 * 60), n)).isoDate;
  const prev = shift(from, -7) >= today ? shift(from, -7) : from !== today ? today : null;
  const next = shift(from, 7) <= bounds.maxDate ? shift(from, 7) : null;
  const days = await getRoomSchedule(room.id, from, 7);

  const prices = groupDays(
    (d) => ({
      hour: room.priceRules.find((p) => p.weekday === d && p.unit === "HOUR")?.amountCents,
      half: room.priceRules.find((p) => p.weekday === d && p.unit === "HALF_DAY")?.amountCents,
      day: room.priceRules.find((p) => p.weekday === d && p.unit === "DAY")?.amountCents,
    }),
    (v) => JSON.stringify(v),
  );
  const hours = groupDays(
    (d) => room.openingHours.filter((h) => h.weekday === d).map((h) => `${minutesLabel(h.openMin)} – ${minutesLabel(h.closeMin)}`).join(", ") || "Fermé",
    (v) => v,
  );
  const price = (c?: number) => (c != null ? formatEuros(c) : "—");

  return (
    <article className="space-y-8">
      <div>
        <Link href="/#salles" className="text-sm text-brand underline">← Toutes les salles</Link>
        <h1 className="mt-2 text-3xl font-bold">{room.name}</h1>
        <p className="text-muted">
          Jusqu&apos;à {room.capacity} personnes{room.accessiblePmr ? " · Accessible aux personnes à mobilité réduite" : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {room.photos.length === 0 ? (
            <PhotoPlaceholder name={room.name} />
          ) : (
            room.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt={p.alt} loading={i === 0 ? "eager" : "lazy"} className="aspect-[16/9] w-full rounded-md object-cover" />
            ))
          )}
        </div>
        <div className="space-y-6">
          <p>{room.description}</p>
          <section aria-labelledby="equipements">
            <h2 id="equipements" className="mb-2 text-lg font-semibold">Équipements</h2>
            <ul className="flex flex-wrap gap-2">
              {room.equipment.map((e) => <li key={e} className="rounded-full bg-brand-soft px-3 py-1 text-sm">{e}</li>)}
              {room.accessiblePmr && <li className="rounded-full bg-brand-soft px-3 py-1 text-sm">Accessibilité PMR</li>}
            </ul>
          </section>
          <section aria-labelledby="horaires">
            <h2 id="horaires" className="mb-2 text-lg font-semibold">Horaires d&apos;ouverture</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {hours.map((h) => (
                <div key={h.label} className="contents"><dt className="font-medium">{h.label}</dt><dd>{h.value}</dd></div>
              ))}
            </dl>
          </section>
          {room.priceRules.length > 0 && (
            <section aria-labelledby="tarifs">
              <h2 id="tarifs" className="mb-2 text-lg font-semibold">Tarifs indicatifs (TTC)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-line"><th scope="col" className="py-2 pr-2">Jours</th><th scope="col" className="py-2 pr-2">Heure</th><th scope="col" className="py-2 pr-2">Demi-journée</th><th scope="col" className="py-2">Journée</th></tr></thead>
                  <tbody>
                    {prices.map((p) => (
                      <tr key={p.label} className="border-b border-line last:border-0">
                        <th scope="row" className="py-2 pr-2 font-medium">{p.label}</th>
                        <td className="py-2 pr-2">{price(p.value.hour)}</td>
                        <td className="py-2 pr-2">{price(p.value.half)}</td>
                        <td className="py-2">{price(p.value.day)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">Demi-journée : jusqu&apos;à 5 heures. Un devis personnalisé vous est adressé après votre demande.</p>
            </section>
          )}
        </div>
      </div>

      <Card>
        <h2 className="mb-4 text-xl font-semibold">Demander cette salle</h2>
        <SearchForm action="/reserver" roomSlug={room.slug} {...bounds} defaults={{ date: sp.date === from ? from : undefined }} submitLabel="Continuer" />
      </Card>

      <section aria-labelledby="planning">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="planning" className="text-xl font-semibold">Disponibilités</h2>
          <nav aria-label="Semaines" className="flex gap-3 text-sm">
            {prev && <Link href={`/salles/${room.slug}?date=${prev}`} className="text-brand underline">← 7 jours précédents</Link>}
            {next && <Link href={`/salles/${room.slug}?date=${next}`} className="text-brand underline">7 jours suivants →</Link>}
          </nav>
        </div>
        <WeekSchedule days={days} />
        <p className="mt-2 text-xs text-muted">Réservation en ligne au moins {settings.minNoticeHours} h à l&apos;avance.</p>
      </section>
    </article>
  );
}
