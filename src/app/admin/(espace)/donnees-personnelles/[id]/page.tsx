import Link from "next/link";
import { notFound } from "next/navigation";
import { actorLabel, requireStaff } from "@/lib/auth/session";
import { getPerson } from "@/lib/gdpr/person";
import { formatPhone, formatSlot } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { Flash, PageTitle, StatusBadge, dangerSmall, primarySmall, smallButton } from "@/components/admin";
import { Card, inputClass } from "@/components/ui";
import { eraseAction, rectifyAction, withdrawAction } from "../actions";

export const metadata = { title: "Données d'une personne" };

const FLASH = {
  rectifiee: "Données corrigées.",
  retrait: "Consentement à la prospection retiré.",
  effacee: "Données effacées (anonymisées). Pensez à confirmer l'effacement à la personne.",
};

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const [{ id }, sp, session] = await Promise.all([params, searchParams, requireStaff("ADMIN")]);
  const p = await getPerson(id, { id: session.userId, label: actorLabel(session) });
  if (!p) notFound();
  const erased = !!p.anonymizedAt;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/donnees-personnelles" className="text-sm text-brand underline">← Recherche</Link>
        <PageTitle actions={!erased && (
          <>
            <a href={`/admin/donnees-personnelles/${p.id}/export?format=json`} className={smallButton}>Télécharger (JSON)</a>
            <a href={`/admin/donnees-personnelles/${p.id}/export?format=csv`} className={smallButton}>Télécharger (CSV)</a>
          </>
        )}>
          {erased ? "Personne effacée" : `${p.firstName} ${p.lastName}`}
        </PageTitle>
      </div>
      <Flash messages={FLASH} code={sp.ok} />
      {erased && <p className="text-muted">Données anonymisées le {p.anonymizedAt!.toLocaleDateString("fr-FR")}. Seuls les créneaux restent, sans lien avec la personne.</p>}

      {!erased && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Corriger les données (rectification)</h2>
            <ActionForm action={rectifyAction.bind(null, p.id)} submit="Enregistrer les corrections" submitClassName={primarySmall}>
              <div className="grid gap-3 sm:grid-cols-2">
                {([["lastName", "Nom", p.lastName], ["firstName", "Prénom", p.firstName], ["email", "E-mail", p.email], ["phone", "Téléphone", formatPhone(p.phone)], ["company", "Société (facultatif)", p.company ?? ""]] as const).map(([name, label, value]) => (
                  <div key={name}>
                    <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
                    <input id={name} name={name} defaultValue={value} required={name !== "company"} className={inputClass} />
                  </div>
                ))}
              </div>
            </ActionForm>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold">Prospection commerciale</h2>
            <p className="mb-3 text-sm">Consentement actuel : <strong>{p.marketingOptIn ? "accordé" : "non"}</strong></p>
            {p.marketingOptIn && <ActionForm action={withdrawAction.bind(null, p.id)} submit="Retirer le consentement" submitClassName={smallButton} />}
            <h3 className="mb-1 mt-4 font-semibold">Historique des consentements</h3>
            {p.consents.length === 0 ? <p className="text-sm text-muted">Aucun.</p> : (
              <ul className="space-y-1 text-sm">
                {p.consents.map((c) => (
                  <li key={c.id}>
                    {c.createdAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} — {c.type === "TERMS" ? "Conditions de réservation" : "Prospection"} : {c.granted ? "accordé" : "retiré"}{" "}
                    <span className="text-muted">({c.textVersion}, {c.source})</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Réservations</h2>
        {p.bookings.length === 0 ? <p className="text-sm text-muted">Aucune.</p> : (
          <ul className="divide-y divide-line text-sm">
            {p.bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><Link href={`/admin/reservations/${b.id}`} className="font-medium text-brand underline">{b.reference}</Link> — {b.room.name} — <span className="first-letter:uppercase">{formatSlot(b.startsAt, b.endsAt)}</span></span>
                <StatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!erased && (
        <Card className="border-danger">
          <h2 className="mb-2 text-lg font-semibold text-danger">Effacer les données (droit à l&apos;effacement)</h2>
          <p className="mb-3 text-sm">
            Nom, prénom, e-mail, téléphone, société, commentaires et notes sont définitivement effacés ; les créneaux restent dans l&apos;historique sans pouvoir être reliés à la personne.
            Impossible tant qu&apos;une réservation à venir est active. <strong>Action irréversible.</strong>
          </p>
          <ActionForm action={eraseAction.bind(null, p.id)} submit="Effacer définitivement" submitClassName={dangerSmall}>
            <label htmlFor="confirmation" className="mb-1 block text-sm font-medium">Pour confirmer, tapez EFFACER</label>
            <input id="confirmation" name="confirmation" autoComplete="off" className={`${inputClass} max-w-xs`} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
