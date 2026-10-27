import Link from "next/link";
import type { Metadata } from "next";
import { searchAvailability } from "@/lib/availability/search";
import { formatEuros } from "@/lib/availability/pricing";
import { minutesLabel } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { dateBounds, slotFromParams, slotToQuery } from "@/lib/validation/search-params";
import { SearchForm } from "@/components/SearchForm";
import { Alert, ButtonLink, Card, Steps } from "@/components/ui";

export const metadata: Metadata = { title: "Salles disponibles" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const settings = await getSettings();
  const bounds = dateBounds(settings);
  const { slot, errors } = slotFromParams(sp);
  const results = slot ? await searchAvailability(slot, new Date(), settings) : [];
  const available = results.filter((r) => r.available);
  const tooBig = slot && results.length > 0 && results.every((r) => r.reasons.includes("OVER_CAPACITY"));
  // Motif commun à toutes les salles (passé, trop tôt…) : on l'explique au client
  const common = results.length && !available.length ? results[0].reasons.filter((r) => results.every((x) => x.reasons.includes(r))) : [];

  return (
    <div>
      <Steps current={1} />
      <h1 className="text-2xl font-bold sm:text-3xl">Salles disponibles</h1>

      <Card className="my-6">
        <SearchForm {...bounds} defaults={slot ?? {}} submitLabel="Modifier la recherche" />
      </Card>

      {errors && <Alert>{Object.values(errors).join(" ")}</Alert>}

      {slot && (
        <section aria-live="polite" aria-labelledby="resultats">
          <h2 id="resultats" className="mb-4 text-lg">
            Le <strong>{dateLabel(slot.date)}</strong>, de <strong>{minutesLabel(slot.startMin)}</strong> à{" "}
            <strong>{minutesLabel(slot.endMin)}</strong>, pour <strong>{slot.attendees}</strong> personne{slot.attendees > 1 ? "s" : ""} :{" "}
            {available.length === 0 ? "aucune salle disponible." : `${available.length} salle${available.length > 1 ? "s" : ""} disponible${available.length > 1 ? "s" : ""}.`}
          </h2>

          {available.length === 0 && (
            <Alert tone="info">
              {tooBig ? (
                <p>Aucune de nos salles ne peut accueillir autant de personnes. Contactez-nous pour en discuter.</p>
              ) : common.includes("IN_PAST") || common.includes("TOO_SOON") ? (
                <p>Ce créneau est trop proche pour une réservation en ligne (au moins {settings.minNoticeHours} h à l&apos;avance). Contactez-nous directement.</p>
              ) : common.includes("TOO_FAR") ? (
                <p>Les réservations en ligne sont ouvertes jusqu&apos;à {settings.maxAdvanceMonths} mois à l&apos;avance.</p>
              ) : (
                <p>Essayez un autre horaire ou une autre date, ou consultez le planning de chaque salle ci-dessous.</p>
              )}
            </Alert>
          )}

          <ul className="mt-4 space-y-4">
            {available.map((r) => (
              <li key={r.roomId}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{r.name}</h3>
                    <p className="text-sm text-muted">Jusqu&apos;à {r.capacity} personnes</p>
                    {r.estimatedCents != null && (
                      <p className="mt-1">
                        Estimation : <strong>{formatEuros(r.estimatedCents)} TTC</strong>{" "}
                        <span className="text-sm text-muted">(indicatif, devis personnalisé à suivre)</span>
                      </p>
                    )}
                    <Link href={`/salles/${r.slug}?date=${slot.date}`} className="text-sm text-brand underline">
                      Voir la salle<span className="sr-only"> {r.name}</span>
                    </Link>
                  </div>
                  <ButtonLink href={`/reserver?${slotToQuery(slot, { salle: r.slug })}`}>
                    Choisir<span className="sr-only"> {r.name}</span>
                  </ButtonLink>
                </Card>
              </li>
            ))}
          </ul>

          {available.length === 0 && results.length > 0 && (
            <p className="mt-6">
              Plannings :{" "}
              {results.map((r, i) => (
                <span key={r.roomId}>
                  {i > 0 && " · "}
                  <Link className="text-brand underline" href={`/salles/${r.slug}?date=${slot.date}`}>{r.name}</Link>
                </span>
              ))}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
