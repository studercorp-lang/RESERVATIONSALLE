import { requireStaff } from "@/lib/auth/session";
import { describeCancellationPolicy } from "@/lib/booking/cancellation";
import { getSettings } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";
import { Flash, PageTitle, primarySmall } from "@/components/admin";
import { Card, inputClass } from "@/components/ui";
import { saveSettingsAction } from "./actions";

export const metadata = { title: "Réglages" };

function NumberField({ name, label, value, min, max, unit, hint }: { name: string; label: string; value: number; min: number; max: number; unit: string; hint?: string }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      {hint && <p className="mb-1 text-xs text-muted">{hint}</p>}
      <div className="flex items-center gap-2">
        <input id={name} name={name} type="number" min={min} max={max} required defaultValue={value} className={`${inputClass} w-28`} />
        <span className="text-sm">{unit}</span>
      </div>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireStaff("ADMIN");
  const [s, sp] = await Promise.all([getSettings(), searchParams]);
  const tiers = [...s.cancellationTiers].sort((a, b) => b.minDaysBefore - a.minDaysBefore);

  return (
    <div>
      <PageTitle>Réglages</PageTitle>
      <Flash messages={{ "1": "Réglages enregistrés." }} code={sp.ok} />
      <ActionForm action={saveSettingsAction} submit="Enregistrer les réglages" submitClassName={primarySmall} className="space-y-6">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Traitement des demandes</h2>
          <label className="mb-4 flex items-start gap-2">
            <input type="checkbox" name="autoConfirm" defaultChecked={s.autoConfirm} className="mt-1 h-4 w-4 accent-brand" />
            <span>Confirmer automatiquement les demandes reçues sur le site <span className="block text-sm text-muted">Décoché (recommandé) : chaque demande attend la validation de l&apos;équipe, qui envoie le devis.</span></span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField name="pendingHoldDays" label="Une demande en attente bloque le créneau pendant" value={s.pendingHoldDays} min={1} max={60} unit="jours" hint="Sans réponse de l'équipe passé ce délai, le créneau est libéré." />
            <NumberField name="minNoticeHours" label="Délai minimum avant le créneau" value={s.minNoticeHours} min={0} max={1440} unit="heures" />
            <NumberField name="maxAdvanceMonths" label="Réservation possible jusqu'à" value={s.maxAdvanceMonths} min={1} max={36} unit="mois à l'avance" />
            <NumberField name="clientChangeDeadlineHours" label="Le client peut modifier sa demande jusqu'à" value={s.clientChangeDeadlineHours} min={0} max={1440} unit="heures avant" />
            <NumberField name="reminderHoursBefore" label="E-mail de rappel envoyé" value={s.reminderHoursBefore} min={1} max={336} unit="heures avant" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-semibold">Barème des frais d&apos;annulation</h2>
          <p className="mb-3 text-sm text-muted">Actuellement : {describeCancellationPolicy(s)}. Les frais s&apos;appliquent aux réservations confirmées, sur le montant du devis. Laissez une ligne vide pour la supprimer.</p>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span>Annulation au moins</span>
                <input name={`tierDays-${i}`} type="number" min={0} max={365} defaultValue={tiers[i]?.minDaysBefore ?? ""} aria-label={`Palier ${i + 1} : jours avant`} className={`${inputClass} w-20`} />
                <span>jours avant :</span>
                <input name={`tierFee-${i}`} type="number" min={0} max={100} defaultValue={tiers[i]?.feePercent ?? ""} aria-label={`Palier ${i + 1} : frais en %`} className={`${inputClass} w-20`} />
                <span>% de frais</span>
              </div>
            ))}
          </div>
          <div className="mt-3"><NumberField name="noShowFeePercent" label="Absence sans annulation" value={s.noShowFeePercent} min={0} max={100} unit="% de frais" /></div>
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-semibold">Conservation des données (RGPD)</h2>
          <p className="mb-3 text-sm text-muted">À l&apos;échéance, les données sont anonymisées automatiquement. Ces durées doivent correspondre à votre politique de confidentialité.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField name="retentionBookingYears" label="Données de réservation" value={s.retentionBookingYears} min={1} max={10} unit="ans après le créneau" />
            <NumberField name="retentionProspectYears" label="Prospection commerciale" value={s.retentionProspectYears} min={1} max={3} unit="ans après le dernier contact" hint="Maximum 3 ans (recommandation CNIL)." />
            <NumberField name="retentionAuditMonths" label="Journal d'audit" value={s.retentionAuditMonths} min={1} max={60} unit="mois" />
          </div>
        </Card>
      </ActionForm>
    </div>
  );
}
