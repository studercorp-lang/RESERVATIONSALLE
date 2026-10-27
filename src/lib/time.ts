import { TZDate } from "@date-fns/tz";

/** Fuseau horaire de référence de l'application. */
export const TIMEZONE = "Europe/Paris";

/**
 * Convertit une date + une heure exprimées en heure de Paris en instant UTC.
 * Gère automatiquement l'heure d'été / l'heure d'hiver.
 * @param isoDate "AAAA-MM-JJ"
 * @param minutes minutes depuis minuit (ex. 14h30 = 870)
 */
export function parisToUtc(isoDate: string, minutes: number): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  // TZDate interprète l'heure « sur l'horloge murale » de Paris (1440 = minuit le lendemain).
  return new Date(new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, TIMEZONE).getTime());
}

/** Décompose un instant UTC en date, jour de semaine ISO et minutes, à l'heure de Paris. */
export function utcToParis(date: Date): { isoDate: string; weekday: number; minutes: number } {
  const z = new TZDate(date.getTime(), TIMEZONE);
  const isoDate = `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
  const weekday = z.getDay() === 0 ? 7 : z.getDay(); // 1 = lundi … 7 = dimanche
  return { isoDate, weekday, minutes: z.getHours() * 60 + z.getMinutes() };
}
