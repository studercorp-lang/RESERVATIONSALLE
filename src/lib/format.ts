/** Mise en forme des dates/heures en français, à l'heure de Paris. */
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { TIMEZONE } from "@/lib/time";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TIMEZONE, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" });

/** « lundi 11 janvier 2027 » */
export const formatDate = (d: Date) => dateFmt.format(d);
/** « lun. 11 janv. » */
export const formatShortDate = (d: Date) => shortDateFmt.format(d);
/** « 09h00 » */
export const formatTime = (d: Date) => timeFmt.format(d).replace(":", "h");
/** « lundi 11 janvier 2027, de 09h00 à 11h00 » ; « …, de 22h00 à 03h00 le lendemain » si la fin tombe le jour suivant. */
export function formatSlot(start: Date, end: Date): string {
  const nextDay = formatDate(start) !== formatDate(end);
  return `${formatDate(start)}, de ${formatTime(start)} à ${formatTime(end)}${nextDay && formatTime(end) !== "00h00" ? " le lendemain" : ""}`;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}h${String(min % 60).padStart(2, "0")}`;

/**
 * Minutes depuis minuit du jour de début → libellé.
 * 540 → « 09h00 » ; 1440 → « minuit » ; 1620 → « 03h00 (lendemain) ».
 */
export function minutesLabel(min: number): string {
  if (min < 1440) return hhmm(min);
  if (min === 1440) return "minuit";
  return `${hhmm(min - 1440)} (lendemain)`;
}

/** « 09h00 » ou « 9:00 » → 540 ; null si invalide */
export function parseTimeLabel(label: string): number | null {
  const m = /^(\d{1,2})[h:](\d{2})$/.exec(label.trim());
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= 1440 ? v : null;
}

/** « +33612345678 » → « 06 12 34 56 78 » (numéros français) ou format international lisible. */
export function formatPhone(e164: string): string {
  const p = parsePhoneNumberFromString(e164);
  if (!p) return e164;
  return p.country === "FR" ? p.formatNational() : p.formatInternational();
}
