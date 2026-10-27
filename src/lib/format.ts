/** Mise en forme des dates/heures en français, à l'heure de Paris. */
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
/** « lundi 11 janvier 2027, de 09h00 à 11h00 » */
export const formatSlot = (start: Date, end: Date) => `${formatDate(start)}, de ${formatTime(start)} à ${formatTime(end)}`;

/** 540 → « 09h00 », 1440 → « 24h00 » */
export function minutesLabel(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}h${String(min % 60).padStart(2, "0")}`;
}

/** « 09h00 » ou « 9:00 » → 540 ; null si invalide */
export function parseTimeLabel(label: string): number | null {
  const m = /^(\d{1,2})[h:](\d{2})$/.exec(label.trim());
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= 1440 ? v : null;
}
