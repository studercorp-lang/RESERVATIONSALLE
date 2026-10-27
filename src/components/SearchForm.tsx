/**
 * Formulaire de recherche de créneau.
 * Simple formulaire HTML (méthode GET) : fonctionne même sans JavaScript.
 */
import { minutesLabel } from "@/lib/format";
import { inputClass } from "./ui";

const TIMES = Array.from({ length: (24 - 7) * 4 + 1 }, (_, i) => 7 * 60 + i * 15); // 07h00 → 24h00

export type SearchDefaults = { date?: string; startMin?: number; endMin?: number; attendees?: number };

export function SearchForm({
  action = "/recherche",
  defaults = {},
  minDate,
  maxDate,
  roomSlug,
  submitLabel = "Voir les salles disponibles",
}: {
  action?: string;
  defaults?: SearchDefaults;
  minDate: string;
  maxDate: string;
  roomSlug?: string;
  submitLabel?: string;
}) {
  return (
    <form action={action} method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      {roomSlug && <input type="hidden" name="salle" value={roomSlug} />}
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor="date" className="mb-1 block text-sm font-medium">Date</label>
        <input id="date" name="date" type="date" required min={minDate} max={maxDate} defaultValue={defaults.date} className={inputClass} />
      </div>
      <div>
        <label htmlFor="debut" className="mb-1 block text-sm font-medium">Heure de début</label>
        <select id="debut" name="debut" required defaultValue={defaults.startMin ?? 9 * 60} className={inputClass}>
          {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{minutesLabel(t)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="fin" className="mb-1 block text-sm font-medium">Heure de fin</label>
        <select id="fin" name="fin" required defaultValue={defaults.endMin ?? 12 * 60} className={inputClass}>
          {TIMES.slice(1).map((t) => <option key={t} value={t}>{minutesLabel(t)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="personnes" className="mb-1 block text-sm font-medium">Nombre de personnes</label>
        <input id="personnes" name="personnes" type="number" inputMode="numeric" required min={1} max={500} defaultValue={defaults.attendees ?? 10} className={inputClass} />
      </div>
      <button type="submit" className="rounded-md bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark sm:col-span-2 lg:col-span-1">
        {submitLabel}
      </button>
    </form>
  );
}
