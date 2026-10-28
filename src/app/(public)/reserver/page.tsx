import Link from "next/link";
import type { Metadata } from "next";
import { formatEuros } from "@/lib/availability/pricing";
import { REJECTION_MESSAGES } from "@/lib/availability/rules";
import { searchAvailability } from "@/lib/availability/search";
import { renderLegal } from "@/lib/content/legal";
import { formatSlot } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { parisToUtc } from "@/lib/time";
import { slotFromParams, slotToQuery } from "@/lib/validation/search-params";
import { Alert, Steps } from "@/components/ui";
import { BookingForm } from "./BookingForm";

export const metadata: Metadata = { title: "Votre demande de réservation" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ReservePage({ searchParams }: Props) {
  const sp = await searchParams;
  const roomSlug = typeof sp.salle === "string" ? sp.salle : "";
  const { slot } = slotFromParams(sp);
  const settings = await getSettings();
  const room = slot ? (await searchAvailability(slot, new Date(), settings)).find((r) => r.slug === roomSlug) : undefined;

  if (!slot || !room) {
    return (
      <div>
        <Steps current={1} />
        <Alert>Ce créneau ou cette salle est introuvable.</Alert>
        <Link href="/#recherche" className="mt-4 inline-block text-brand underline">← Faire une nouvelle recherche</Link>
      </div>
    );
  }

  if (!room.available) {
    return (
      <div>
        <Steps current={1} />
        <h1 className="mb-4 text-2xl font-bold">{room.name} n&apos;est pas disponible sur ce créneau</h1>
        <Alert>
          <ul className="list-inside list-disc">{room.reasons.map((r) => <li key={r}>{REJECTION_MESSAGES[r]}</li>)}</ul>
        </Alert>
        <p className="mt-4 flex flex-wrap gap-4">
          <Link href={`/salles/${room.slug}?date=${slot.date}`} className="text-brand underline">Voir le planning de la salle</Link>
          <Link href={`/recherche?${slotToQuery(slot)}`} className="text-brand underline">Voir les autres salles sur ce créneau</Link>
        </p>
      </div>
    );
  }

  const startsAt = parisToUtc(slot.date, slot.startMin);
  const endsAt = parisToUtc(slot.date, slot.endMin);

  return (
    <BookingForm
      slot={{ salle: room.slug, date: slot.date, debut: slot.startMin, fin: slot.endMin, personnes: slot.attendees }}
      privacyNotice={await renderLegal("mention-formulaire")}
      summary={
        <>
          <h2 className="mb-3 font-semibold">Votre demande</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-muted">Salle</dt><dd className="font-medium">{room.name}</dd></div>
            <div><dt className="text-muted">Date et horaires</dt><dd className="font-medium first-letter:uppercase">{formatSlot(startsAt, endsAt)}</dd></div>
            <div><dt className="text-muted">Personnes</dt><dd className="font-medium">{slot.attendees}</dd></div>
            {room.estimatedCents != null && (
              <div><dt className="text-muted">Estimation indicative</dt><dd className="font-medium">{formatEuros(room.estimatedCents)} TTC</dd></div>
            )}
          </dl>
          <p className="mt-3 text-xs text-muted">Aucun paiement en ligne : notre équipe vous adresse un devis. La caution est gérée directement avec l&apos;équipe.</p>
          <Link href={`/recherche?${slotToQuery(slot)}`} className="mt-3 inline-block text-sm text-brand underline">Modifier</Link>
        </>
      }
    />
  );
}
