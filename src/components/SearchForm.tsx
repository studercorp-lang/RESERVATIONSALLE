/**
 * Formulaire de recherche de créneau.
 * Simple formulaire HTML (méthode GET) : fonctionne même sans JavaScript.
 */
import { defaultTimes, type TimeOptions } from "@/lib/availability/time-options";
import { minutesLabel } from "@/lib/format";
import { inputClass } from "./ui";

/** Champs date / début / fin / personnes, réutilisés par la recherche et la modification. */
export function SlotFields({
  defaults = {},
  minDate,
  maxDate,
  idPrefix = "",
  times,
}: {
  defaults?: SearchDefaults;
  minDate: string;
  maxDate: string;
  idPrefix?: string;
  /** Heures proposées, calculées depuis les horaires d'ouverture. */
  times: TimeOptions;
}) {
  const id = (k: string) => `${idPrefix}${k}`;
  const fallback = defaultTimes(times);
  return (
    <>
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor={id("date")} className="mb-1 block text-sm font-medium">
          Date
        </label>
        <input
          id={id("date")}
          name="date"
          type="date"
          required
          min={minDate}
          max={maxDate}
          defaultValue={defaults.date}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={id("debut")} className="mb-1 block text-sm font-medium">
          Heure de début
        </label>
        <select id={id("debut")} name="debut" required defaultValue={defaults.startMin ?? fallback.startMin} className={inputClass}>
          {times.starts.map((t) => (
            <option key={t} value={t}>
              {minutesLabel(t)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={id("fin")} className="mb-1 block text-sm font-medium">
          Heure de fin
        </label>
        <select id={id("fin")} name="fin" required defaultValue={defaults.endMin ?? fallback.endMin} className={inputClass}>
          {times.ends.map((t) => (
            <option key={t} value={t}>
              {minutesLabel(t)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={id("personnes")} className="mb-1 block text-sm font-medium">
          Nombre de personnes
        </label>
        <input
          id={id("personnes")}
          name="personnes"
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={500}
          defaultValue={defaults.attendees ?? 10}
          className={inputClass}
        />
      </div>
    </>
  );
}

export type SearchDefaults = { date?: string; startMin?: number; endMin?: number; attendees?: number };

export function SearchForm({
  action = "/recherche",
  defaults = {},
  minDate,
  maxDate,
  roomSlug,
  times,
  submitLabel = "Voir les salles disponibles",
}: {
  times: TimeOptions;
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
      <SlotFields defaults={defaults} minDate={minDate} maxDate={maxDate} times={times} />
      <button
        type="submit"
        className="rounded-md bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark sm:col-span-2 lg:col-span-1"
      >
        {submitLabel}
      </button>
    </form>
  );
}
