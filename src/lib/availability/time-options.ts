/**
 * Heures proposées dans les listes déroulantes, calculées à partir des horaires
 * d'ouverture (ex. QUAI 19 : début de 15h00 à 22h00, fin jusqu'à 03h00 le lendemain).
 */
import { SLOT_STEP_MIN, type RoomRules } from "./rules";

export type TimeOptions = { starts: number[]; ends: number[] };

const range = (from: number, to: number) => Array.from({ length: Math.max(0, Math.floor((to - from) / SLOT_STEP_MIN) + 1) }, (_, i) => from + i * SLOT_STEP_MIN);

export function timeOptions(hours: RoomRules["openingHours"]): TimeOptions {
  if (hours.length === 0) return { starts: range(7 * 60, 24 * 60 - SLOT_STEP_MIN), ends: range(7 * 60 + SLOT_STEP_MIN, 24 * 60) };
  const open = Math.min(...hours.map((h) => h.openMin));
  const lastStart = Math.max(...hours.map((h) => h.lastStartMin ?? h.closeMin - SLOT_STEP_MIN));
  const close = Math.max(...hours.map((h) => h.closeMin));
  return { starts: range(open, lastStart), ends: range(open + SLOT_STEP_MIN, close) };
}

/** Valeurs proposées par défaut : début 18h00 (ou la première heure), fin 3 h plus tard si possible. */
export function defaultTimes(opts: TimeOptions): { startMin: number; endMin: number } {
  const startMin = opts.starts.includes(18 * 60) ? 18 * 60 : opts.starts[0];
  const wanted = startMin + 3 * 60;
  const endMin = opts.ends.includes(wanted) ? wanted : (opts.ends.find((e) => e > startMin) ?? opts.ends[opts.ends.length - 1]);
  return { startMin, endMin };
}
