import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/log";
import { actorLabel, requireStaff } from "@/lib/auth/session";
import { formatEuros } from "@/lib/availability/pricing";
import { slotClock } from "@/lib/availability/rules";
import { getTimeOptions } from "@/lib/availability/search";
import { formatPhone, formatSlot } from "@/lib/format";
import { utcToParis } from "@/lib/time";
import { ActionForm } from "@/components/ActionForm";
import { Flash, PageTitle, StatusBadge, dangerSmall, primarySmall, smallButton } from "@/components/admin";
import { SlotFields } from "@/components/SearchForm";
import { Card, inputClass } from "@/components/ui";
import { cancelAction, completeAction, confirmAction, noteAction, refuseAction, rescheduleAction } from "../actions";

export const metadata = { title: "Réservation" };

const FLASH = {
  confirmee: "Réservation confirmée.",
  refusee: "Demande refusée : le créneau est libéré.",
  annulee: "Réservation annulée : le créneau est libéré.",
  terminee: "Réservation marquée comme terminée.",
  note: "Note interne enregistrée.",
  modifiee: "Créneau modifié.",
  creee: "Réservation enregistrée.",
};

const ACTION_LABELS: Record<string, string> = {
  "booking.create": "Créée par l'équipe",
  "booking.confirm": "Confirmée",
  "booking.refuse": "Refusée",
  "booking.cancel": "Annulée",
  "booking.complete": "Marquée terminée",
  "booking.reschedule": "Créneau modifié",
  "booking.note": "Note interne modifiée",
  "booking.view": "Consultée",
};

/** Case « prévenir le client » + message facultatif inséré dans l'e-mail. */
function NotifyFields({ id, defaultChecked = true }: { id: string; defaultChecked?: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <input id={`${id}-notify`} name="notify" type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-brand" />
        <label htmlFor={`${id}-notify`} className="text-sm">Prévenir le client par e-mail</label>
      </div>
      <div>
        <label htmlFor={`${id}-message`} className="mb-1 block text-sm font-medium">Message au client <span className="font-normal text-muted">(facultatif)</span></label>
        <textarea id={`${id}-message`} name="message" rows={2} maxLength={2000} className={inputClass} />
      </div>
    </>
  );
}

export default async function BookingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const [{ id }, sp, session] = await Promise.all([params, searchParams, requireStaff()]);
  const b = await prisma.booking.findUnique({ where: { id }, include: { room: true, customer: true } });
  if (!b) notFound();

  // Consultation de données personnelles : tracée dans le journal d'audit
  await audit({ actorId: session.userId, actorLabel: actorLabel(session), action: "booking.view", entityType: "Booking", entityId: b.id });

  const [rooms, times, history] = await Promise.all([
    prisma.room.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, capacity: true } }),
    getTimeOptions(),
    prisma.auditLog.findMany({ where: { entityType: "Booking", entityId: b.id, action: { not: "booking.view" } }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true } } } }),
  ]);
  const now = new Date();
  const active = b.status === BookingStatus.PENDING || b.status === BookingStatus.CONFIRMED;
  const clock = slotClock(b.startsAt, b.endsAt);
  const c = b.customer;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/reservations" className="text-sm text-brand underline">← Toutes les réservations</Link>
        <PageTitle>
          <span className="mr-3">{b.reference}</span>
          <StatusBadge status={b.status} />
        </PageTitle>
      </div>
      <Flash messages={FLASH} code={sp.ok} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Créneau</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Salle</dt><dd className="font-medium">{b.room.name}</dd>
            <dt className="text-muted">Date</dt><dd className="font-medium first-letter:uppercase">{formatSlot(b.startsAt, b.endsAt)}</dd>
            <dt className="text-muted">Personnes</dt><dd>{b.attendees} <span className="text-muted">/ {b.room.capacity} max.</span></dd>
            <dt className="text-muted">Estimation</dt><dd>{b.estimatedCents != null ? `${formatEuros(b.estimatedCents)} TTC` : "—"}</dd>
            <dt className="text-muted">Origine</dt><dd>{b.source === "ONLINE" ? "Site internet" : "Saisie par l'équipe"}</dd>
            <dt className="text-muted">Reçue le</dt><dd>{b.createdAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</dd>
            {b.status === "PENDING" && b.pendingExpiresAt && (<><dt className="text-muted">Bloqué jusqu&apos;au</dt><dd className={b.pendingExpiresAt < now ? "font-semibold text-danger" : ""}>{b.pendingExpiresAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</dd></>)}
            {b.comment && (<><dt className="text-muted">Commentaire</dt><dd className="whitespace-pre-line">{b.comment}</dd></>)}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Client</h2>
          {c.anonymizedAt ? (
            <p className="text-muted">Données effacées le {c.anonymizedAt.toLocaleDateString("fr-FR")}.</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Nom</dt><dd className="font-medium">{c.firstName} {c.lastName}</dd>
              {c.company && (<><dt className="text-muted">Société</dt><dd>{c.company}</dd></>)}
              <dt className="text-muted">E-mail</dt><dd><a href={`mailto:${c.email}?subject=${encodeURIComponent(`Votre réservation ${b.reference}`)}`} className="text-brand underline">{c.email}</a></dd>
              <dt className="text-muted">Téléphone</dt><dd><a href={`tel:${c.phone}`} className="text-brand underline">{formatPhone(c.phone)}</a></dd>
              <dt className="text-muted">Prospection</dt><dd>{c.marketingOptIn ? "Accepte les informations commerciales" : "Non"}</dd>
            </dl>
          )}
        </Card>
      </div>

      {(b.status === "PENDING" || b.status === "EXPIRED") && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Confirmer</h2>
            <p className="mb-3 text-sm text-muted">Le client reçoit un e-mail de confirmation avec un nouveau lien de gestion.</p>
            <ActionForm action={confirmAction.bind(null, b.id)} submit="Confirmer la réservation" submitClassName={primarySmall}>
              <NotifyFields id="confirm" />
            </ActionForm>
          </Card>
          {b.status === "PENDING" && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Refuser</h2>
              <p className="mb-3 text-sm text-muted">Le créneau est immédiatement libéré.</p>
              <ActionForm action={refuseAction.bind(null, b.id)} submit="Refuser la demande" submitClassName={dangerSmall}>
                <NotifyFields id="refuse" />
              </ActionForm>
            </Card>
          )}
        </div>
      )}

      {active && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Modifier le créneau</h2>
          <p className="mb-3 text-sm text-muted">L&apos;équipe peut changer de salle et n&apos;est pas soumise aux délais de réservation en ligne ; la disponibilité, les horaires et la capacité restent vérifiés.</p>
          <ActionForm action={rescheduleAction.bind(null, b.id)} submit="Enregistrer le nouveau créneau" submitClassName={primarySmall}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="roomId" className="mb-1 block text-sm font-medium">Salle</label>
                <select id="roomId" name="roomId" defaultValue={b.roomId} className={inputClass}>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity} pers.)</option>)}
                </select>
              </div>
              <SlotFields idPrefix="re-" times={times} minDate="2000-01-01" maxDate="2100-12-31"
                defaults={{ date: utcToParis(b.startsAt).isoDate, startMin: clock?.startMin, endMin: clock?.endMin, attendees: b.attendees }} />
            </div>
            <NotifyFields id="reschedule" />
          </ActionForm>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Note interne</h2>
          <ActionForm action={noteAction.bind(null, b.id)} submit="Enregistrer la note" submitClassName={smallButton}>
            <label htmlFor="note" className="sr-only">Note interne</label>
            <textarea id="note" name="note" rows={4} maxLength={2000} defaultValue={b.internalNote ?? ""} className={inputClass} placeholder="Visible uniquement par l'équipe (devis envoyé, caution reçue…)" />
          </ActionForm>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Autres actions</h2>
          <div className="space-y-4">
            {b.status === "CONFIRMED" && b.endsAt <= now && (
              <ActionForm action={completeAction.bind(null, b.id)} submit="Marquer comme terminée" submitClassName={smallButton} />
            )}
            {active ? (
              <details className="rounded-md border border-line p-3">
                <summary className="cursor-pointer font-medium text-danger">Annuler la réservation…</summary>
                <ActionForm action={cancelAction.bind(null, b.id)} submit="Annuler la réservation" submitClassName={dangerSmall} className="mt-3 space-y-3">
                  <NotifyFields id="cancel" />
                  <div className="flex items-center gap-2">
                    <input id="sure" name="sure" type="checkbox" className="h-4 w-4 accent-brand" />
                    <label htmlFor="sure" className="text-sm">Je confirme l&apos;annulation</label>
                  </div>
                </ActionForm>
              </details>
            ) : (
              <p className="text-sm text-muted">Aucune autre action possible pour ce statut.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Historique</h2>
        {history.length === 0 ? <p className="text-sm text-muted">Aucune action enregistrée.</p> : (
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id}>
                <span className="text-muted">{h.createdAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</span> — {ACTION_LABELS[h.action] ?? h.action}{" "}
                <span className="text-muted">par {h.actor?.name ?? h.actorLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
