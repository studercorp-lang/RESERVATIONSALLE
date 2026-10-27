import { addMonths } from "date-fns";
import type { Settings } from "@/lib/settings";
import { utcToParis } from "@/lib/time";
import { fieldErrors, slotSchema, type SlotInput } from "./booking";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Lit le créneau depuis l'adresse de la page (?date=…&debut=…&fin=…&personnes=…). */
export function slotFromParams(sp: Params): { slot?: SlotInput; errors?: Record<string, string>; empty: boolean } {
  const raw = { date: one(sp.date), startMin: one(sp.debut), endMin: one(sp.fin), attendees: one(sp.personnes) };
  if (!raw.date) return { empty: true };
  const parsed = slotSchema.safeParse(raw);
  return parsed.success ? { slot: parsed.data, empty: false } : { errors: fieldErrors(parsed.error), empty: false };
}

export function slotToQuery(slot: SlotInput, extra: Record<string, string> = {}): string {
  return new URLSearchParams({
    ...extra,
    date: slot.date,
    debut: String(slot.startMin),
    fin: String(slot.endMin),
    personnes: String(slot.attendees),
  }).toString();
}

/** Bornes du sélecteur de date : aujourd'hui → aujourd'hui + N mois (heure de Paris). */
export function dateBounds(settings: Settings, now = new Date()) {
  return { minDate: utcToParis(now).isoDate, maxDate: utcToParis(addMonths(now, settings.maxAdvanceMonths)).isoDate };
}
