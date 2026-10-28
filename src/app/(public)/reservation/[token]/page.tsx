import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { formatEuros } from "@/lib/availability/pricing";
import { describeCancellationPolicy } from "@/lib/booking/cancellation";
import { clientPermissions, findBookingByToken } from "@/lib/booking/manage";
import { STATUS_LABELS } from "@/lib/email/templates";
import { formatPhone, formatSlot } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { slotClock } from "@/lib/availability/rules";
import { getTimeOptions } from "@/lib/availability/search";
import { utcToParis } from "@/lib/time";
import { dateBounds } from "@/lib/validation/search-params";
import { Alert, Card } from "@/components/ui";
import { CancelForm, ContactForm, MarketingForm, ModifyForm } from "./ManageForms";

// Page personnelle : jamais indexée, et le lien n'est jamais transmis à un autre site.
export const metadata: Metadata = { title: "Ma réservation", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string }> };

const OK_MESSAGES: Record<string, string> = {
  annulee: "Votre réservation est annulée. Un e-mail de confirmation vous a été envoyé (il précise les frais éventuels).",
  modifiee: "Votre demande a été modifiée. Un e-mail récapitulatif vous a été envoyé.",
  coordonnees: "Vos coordonnées ont été mises à jour.",
  desinscription: "C'est noté : vous ne recevrez plus d'informations commerciales de notre part.",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  CONFIRMED: "bg-brand-soft text-brand-dark",
};

export default async function ManageBookingPage({ params, searchParams }: Props) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const now = new Date();
  const booking = await findBookingByToken(token, now);

  if (!booking) {
    return (
      <Card>
        <h1 className="text-2xl font-bold">Lien invalide ou expiré</h1>
        <p className="mt-2">
          Ce lien de gestion n&apos;est plus valable. Pour toute question sur votre réservation, écrivez-nous à{" "}
          <a href={`mailto:${SITE.contactEmail}`} className="text-brand underline">{SITE.contactEmail}</a>.
        </p>
      </Card>
    );
  }

  const settings = await getSettings();
  const perms = clientPermissions(booking, settings, now);
  const bounds = dateBounds(settings, now);
  const clock = slotClock(booking.startsAt, booking.endsAt);
  const times = await getTimeOptions(booking.roomId);
  const c = booking.customer;
  const okMessage = sp.ok ? OK_MESSAGES[sp.ok] : undefined;
  const statusLabel = booking.status === "PENDING" && !perms.active ? STATUS_LABELS.EXPIRED : STATUS_LABELS[booking.status];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Votre réservation {booking.reference}</h1>
        <p className="mt-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLES[booking.status] ?? "bg-line text-ink"}`}>{statusLabel}</span>
        </p>
      </div>

      {okMessage && <Alert tone="info">{okMessage}</Alert>}

      <Card>
        <h2 className="sr-only">Récapitulatif</h2>
        <dl className="grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-muted">Salle</dt><dd className="font-semibold">{booking.room.name}</dd>
          <dt className="text-muted">Date et horaires</dt><dd className="font-semibold first-letter:uppercase">{formatSlot(booking.startsAt, booking.endsAt)}</dd>
          <dt className="text-muted">Personnes</dt><dd className="font-semibold">{booking.attendees}</dd>
          {booking.estimatedCents != null && (<><dt className="text-muted">Estimation indicative</dt><dd className="font-semibold">{formatEuros(booking.estimatedCents)} TTC (devis à suivre)</dd></>)}
          <dt className="text-muted">Adresse</dt><dd>{SITE.address}</dd>
          <dt className="text-muted">Contact</dt><dd>{c.firstName} {c.lastName}{c.company ? ` — ${c.company}` : ""}<br />{c.email} · {formatPhone(c.phone)}</dd>
          {booking.comment && (<><dt className="text-muted">Votre commentaire</dt><dd className="whitespace-pre-line">{booking.comment}</dd></>)}
        </dl>
      </Card>

      {perms.active && (
        <Card>
          <h2 className="mb-3 text-xl font-semibold">Modifier le créneau</h2>
          {perms.canModify ? (
            <>
              <p className="mb-4 text-sm text-muted">Même salle. Le nouveau créneau est vérifié en temps réel ; votre demande reste en cours d&apos;étude par notre équipe.</p>
              <ModifyForm
                token={token}
                minDate={bounds.minDate}
                maxDate={bounds.maxDate}
                times={times}
                defaults={{ date: utcToParis(booking.startsAt).isoDate, startMin: clock?.startMin, endMin: clock?.endMin, attendees: booking.attendees }}
              />
            </>
          ) : (
            <p>
              {perms.modifyBlockedReason === "confirmed"
                ? "Votre réservation est confirmée : pour toute modification, contactez-nous afin que nous adaptions le devis."
                : `Les modifications en ligne sont possibles jusqu'à ${settings.clientChangeDeadlineHours} h avant le créneau. Contactez-nous.`}{" "}
              <a href={`mailto:${SITE.contactEmail}?subject=${encodeURIComponent(`Réservation ${booking.reference}`)}`} className="text-brand underline">{SITE.contactEmail}</a>
            </p>
          )}
        </Card>
      )}

      {perms.canEditContact && (
        <Card>
          <h2 className="mb-3 text-xl font-semibold">Corriger mes coordonnées</h2>
          <p className="mb-4 text-sm text-muted">
            Pour changer d&apos;adresse e-mail, écrivez-nous à <a href={`mailto:${SITE.privacyEmail}`} className="underline">{SITE.privacyEmail}</a>.
          </p>
          <ContactForm token={token} defaults={{ lastName: c.lastName, firstName: c.firstName, phone: formatPhone(c.phone), company: c.company ?? "" }} />
        </Card>
      )}

      {perms.canCancel && (
        <Card>
          <h2 className="mb-3 text-xl font-semibold">Annuler</h2>
          <p className="mb-4 text-sm text-muted">
            {booking.status === "PENDING"
              ? "Votre demande n'est pas encore confirmée : vous pouvez l'annuler sans frais."
              : `Frais d'annulation (sur le montant du devis) : ${describeCancellationPolicy(settings)}.`}{" "}
            <Link href="/conditions-reservation" className="underline">Conditions de réservation</Link>
          </p>
          <CancelForm token={token} feePercent={perms.feePercent} />
        </Card>
      )}

      {c.marketingOptIn && (
        <Card>
          <h2 className="mb-3 text-xl font-semibold">Informations commerciales</h2>
          <p className="mb-4 text-sm">Vous avez accepté de recevoir nos informations commerciales. Vous pouvez retirer ce consentement à tout moment.</p>
          <MarketingForm token={token} />
        </Card>
      )}

      <p className="text-sm text-muted">
        Ce lien est personnel : ne le partagez pas. Il reste valable jusqu&apos;à 30 jours après votre réservation. Pour exercer vos droits sur vos
        données : <a href={`mailto:${SITE.privacyEmail}`} className="underline">{SITE.privacyEmail}</a>.
      </p>
    </div>
  );
}
