/**
 * Sections de la fiche salle du back-office (formulaires serveur).
 */
import type { Closure, OpeningHours, PriceRule, Room } from "@prisma/client";
import { PriceUnit } from "@prisma/client";
import { closureLabel } from "@/lib/admin/rooms";
import { minutesLabel } from "@/lib/format";
import { utcToParis } from "@/lib/time";
import { ActionForm } from "@/components/ActionForm";
import { dangerSmall, primarySmall, smallButton } from "@/components/admin";
import { inputClass } from "@/components/ui";
import { addClosureAction, addPhotoAction, deleteClosureAction, deletePhotoAction, movePhotoAction, saveHoursAction, savePricesAction, saveRoomAction } from "./actions";

const DAYS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const steps = (from: number, to: number) => Array.from({ length: (to - from) / 15 + 1 }, (_, i) => from + i * 15);
const OPEN_TIMES = steps(0, 1425);
const CLOSE_TIMES = steps(15, 2880);

function Field({ label, name, hint, children }: { label: string; name: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      {hint && <p className="mb-1 text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}

/** Informations générales (création ou modification). */
export function RoomInfoForm({ room }: { room?: Room }) {
  return (
    <ActionForm action={saveRoomAction.bind(null, room?.id ?? null)} submit={room ? "Enregistrer les informations" : "Créer la salle"} submitClassName={primarySmall}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" name="name"><input id="name" name="name" required maxLength={80} defaultValue={room?.name} className={inputClass} /></Field>
        <Field label="Capacité (personnes)" name="capacity"><input id="capacity" name="capacity" type="number" min={1} required defaultValue={room?.capacity ?? 20} className={inputClass} /></Field>
        <div className="sm:col-span-2">
          <Field label="Description" name="description"><textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={room?.description} className={inputClass} /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Équipements" name="equipment" hint="Un par ligne ou séparés par des virgules.">
            <textarea id="equipment" name="equipment" rows={3} defaultValue={room?.equipment.join("\n")} className={inputClass} />
          </Field>
        </div>
        <Field label="Durée minimale (minutes)" name="minDurationMin"><input id="minDurationMin" name="minDurationMin" type="number" min={15} step={15} required defaultValue={room?.minDurationMin ?? 60} className={inputClass} /></Field>
        <Field label="Durée maximale (minutes)" name="maxDurationMin"><input id="maxDurationMin" name="maxDurationMin" type="number" min={15} step={15} required defaultValue={room?.maxDurationMin ?? 720} className={inputClass} /></Field>
        <Field label="Temps tampon entre deux réservations (minutes)" name="bufferMin" hint="Ménage, installation : la salle reste bloquée après chaque réservation.">
          <input id="bufferMin" name="bufferMin" type="number" min={0} step={15} required defaultValue={room?.bufferMin ?? 30} className={inputClass} />
        </Field>
        <Field label="Ordre d'affichage" name="sortOrder"><input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={room?.sortOrder ?? 0} className={inputClass} /></Field>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2"><input type="checkbox" name="accessiblePmr" defaultChecked={room?.accessiblePmr} className="h-4 w-4 accent-brand" /> Accessible PMR</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={room?.active ?? true} className="h-4 w-4 accent-brand" /> Réservable en ligne (salle active)</label>
      </div>
    </ActionForm>
  );
}

/** Horaires par jour : fermé, ouverture, fermeture (éventuellement le lendemain), dernier début. */
export function HoursForm({ roomId, hours }: { roomId: string; hours: OpeningHours[] }) {
  return (
    <ActionForm action={saveHoursAction.bind(null, roomId)} submit="Enregistrer les horaires" submitClassName={primarySmall}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-2">Jour</th>
              <th scope="col" className="py-2 pr-2">Ouvert</th>
              <th scope="col" className="py-2 pr-2">Ouverture</th>
              <th scope="col" className="py-2 pr-2">Fermeture</th>
              <th scope="col" className="py-2">Dernier début possible</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const h = hours.find((x) => x.weekday === d);
              return (
                <tr key={d} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2 pr-2 font-medium">{DAYS[d]}</th>
                  <td className="py-2 pr-2">
                    <input type="checkbox" name={`open-${d}`} defaultChecked={!!h} aria-label={`${DAYS[d]} : ouvert`} className="h-5 w-5 accent-brand" />
                  </td>
                  <td className="py-2 pr-2">
                    <select name={`openMin-${d}`} defaultValue={h?.openMin ?? 900} aria-label={`${DAYS[d]} : ouverture`} className={inputClass}>
                      {OPEN_TIMES.map((t) => <option key={t} value={t}>{minutesLabel(t)}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select name={`closeMin-${d}`} defaultValue={h?.closeMin ?? 1620} aria-label={`${DAYS[d]} : fermeture`} className={inputClass}>
                      {CLOSE_TIMES.map((t) => <option key={t} value={t}>{minutesLabel(t)}</option>)}
                    </select>
                  </td>
                  <td className="py-2">
                    <select name={`lastStartMin-${d}`} defaultValue={h?.lastStartMin ?? ""} aria-label={`${DAYS[d]} : dernier début`} className={inputClass}>
                      <option value="">Pas de limite</option>
                      {OPEN_TIMES.map((t) => <option key={t} value={t}>{minutesLabel(t)}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Décochez « Ouvert » pour fermer la salle ce jour-là. Les réservations déjà enregistrées ne sont jamais modifiées automatiquement.</p>
    </ActionForm>
  );
}

/** Blocages : liste à venir + ajout (journées entières ou créneau précis). */
export function ClosuresSection({ roomId, closures }: { roomId: string | null; closures: Closure[] }) {
  const today = utcToParis(new Date()).isoDate;
  return (
    <div className="space-y-4">
      {closures.length === 0 ? (
        <p className="text-sm text-muted">Aucun blocage à venir.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {closures.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span><span className="first-letter:uppercase">{closureLabel(c)}</span>{c.reason && <span className="text-muted"> — {c.reason}</span>}</span>
              <ActionForm action={deleteClosureAction.bind(null, c.id)} submit="Débloquer" submitClassName={smallButton} className="" />
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-line p-3">
          <h3 className="mb-2 font-semibold">Bloquer une ou plusieurs journées</h3>
          <ActionForm action={addClosureAction.bind(null, roomId)} submit="Bloquer ces journées" submitClassName={dangerSmall}>
            <input type="hidden" name="mode" value="jours" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Du" name={`from-${roomId}`}><input id={`from-${roomId}`} name="from" type="date" min={today} required className={inputClass} /></Field>
              <Field label="Au (inclus)" name={`to-${roomId}`}><input id={`to-${roomId}`} name="to" type="date" min={today} className={inputClass} /></Field>
            </div>
            <Field label="Motif (interne, facultatif)" name={`reason-j-${roomId}`}><input id={`reason-j-${roomId}`} name="reason" maxLength={200} className={inputClass} /></Field>
            <p className="text-xs text-muted">Une journée bloquée va de 6h00 à 6h00 le lendemain : la soirée de la veille (jusqu&apos;à 3h) reste réservable.</p>
          </ActionForm>
        </div>
        <div className="rounded-md border border-line p-3">
          <h3 className="mb-2 font-semibold">Bloquer un créneau précis</h3>
          <ActionForm action={addClosureAction.bind(null, roomId)} submit="Bloquer ce créneau" submitClassName={dangerSmall}>
            <input type="hidden" name="mode" value="creneau" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Début" name={`start-${roomId}`}><input id={`start-${roomId}`} name="start" type="datetime-local" step={900} required className={inputClass} /></Field>
              <Field label="Fin" name={`end-${roomId}`}><input id={`end-${roomId}`} name="end" type="datetime-local" step={900} required className={inputClass} /></Field>
            </div>
            <Field label="Motif (interne, facultatif)" name={`reason-c-${roomId}`}><input id={`reason-c-${roomId}`} name="reason" maxLength={200} className={inputClass} /></Field>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}

/** Grille des tarifs indicatifs TTC par jour et par formule. */
export function PricesForm({ roomId, prices }: { roomId: string; prices: PriceRule[] }) {
  const UNITS: [PriceUnit, string][] = [["HOUR", "Heure"], ["HALF_DAY", "Demi-journée (≤ 5 h)"], ["DAY", "Journée"]];
  const value = (d: number, u: PriceUnit) => {
    const p = prices.find((x) => x.weekday === d && x.unit === u);
    return p ? (p.amountCents / 100).toFixed(2).replace(".", ",").replace(",00", "") : "";
  };
  return (
    <ActionForm action={savePricesAction.bind(null, roomId)} submit="Enregistrer les tarifs" submitClassName={primarySmall}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead><tr className="border-b border-line"><th scope="col" className="py-2 pr-2">Jour</th>{UNITS.map(([u, l]) => <th key={u} scope="col" className="py-2 pr-2">{l}</th>)}</tr></thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <tr key={d} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 pr-2 font-medium">{DAYS[d]}</th>
                {UNITS.map(([u, l]) => (
                  <td key={u} className="py-2 pr-2">
                    <div className="flex items-center gap-1">
                      <input name={`price-${d}-${u}`} defaultValue={value(d, u)} inputMode="decimal" aria-label={`${DAYS[d]} — ${l} (€ TTC)`} className={`${inputClass} w-28`} />
                      <span aria-hidden="true">€</span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Montants TTC, indicatifs (le devis fait foi). Laissez vide une formule non proposée ce jour-là.</p>
    </ActionForm>
  );
}

/** Photos : ajout (JPEG/PNG/WebP, 3 Mo max, texte alternatif obligatoire), ordre, suppression. */
export function PhotosSection({ roomId, photos }: { roomId: string; photos: { id: string; alt: string }[] }) {
  return (
    <div className="space-y-4">
      {photos.length === 0 ? <p className="text-sm text-muted">Aucune photo : un visuel neutre est affiché sur le site.</p> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="rounded-md border border-line p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/photos/${p.id}`} alt={p.alt} className="aspect-[16/9] w-full rounded object-cover" loading="lazy" />
              <p className="mt-1 text-xs text-muted">{i === 0 ? "Photo principale — " : ""}{p.alt}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {i > 0 && <ActionForm action={movePhotoAction.bind(null, p.id, -1)} submit="← Avant" submitClassName={smallButton} className="" />}
                {i < photos.length - 1 && <ActionForm action={movePhotoAction.bind(null, p.id, 1)} submit="Après →" submitClassName={smallButton} className="" />}
                <ActionForm action={deletePhotoAction.bind(null, p.id)} submit="Supprimer" submitClassName={dangerSmall} className="" />
              </div>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={addPhotoAction.bind(null, roomId)} submit="Ajouter la photo" submitClassName={primarySmall}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Image (JPEG, PNG ou WebP, 3 Mo maximum)" name="photo">
            <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm" />
          </Field>
          <Field label="Description de la photo" name="alt" hint="Lue par les personnes malvoyantes, ex. « Salle en configuration théâtre, vue sur la Saône ».">
            <input id="alt" name="alt" required minLength={3} maxLength={200} className={inputClass} />
          </Field>
        </div>
      </ActionForm>
    </div>
  );
}
