/**
 * Estimation INDICATIVE du prix d'un créneau (le devis final est établi par l'équipe).
 *
 * Règle : on prend le tarif le plus avantageux pour le client parmi
 *  - le tarif horaire × nombre d'heures (toute heure entamée est due) ;
 *  - le forfait demi-journée, si la durée ne dépasse pas HALF_DAY_MAX_MIN ;
 *  - le forfait journée.
 * Le tarif utilisé est celui du jour de la semaine où commence le créneau.
 */
import type { PriceUnit } from "@prisma/client";
import { utcToParis } from "@/lib/time";

export const HALF_DAY_MAX_MIN = 5 * 60;

export type PriceRuleInput = { weekday: number; unit: PriceUnit; amountCents: number };

export function estimatePriceCents(rules: PriceRuleInput[], startsAt: Date, endsAt: Date): number | null {
  const { weekday } = utcToParis(startsAt);
  const durationMin = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  const price = (unit: PriceUnit) => rules.find((r) => r.weekday === weekday && r.unit === unit)?.amountCents;

  const candidates: number[] = [];
  const hourly = price("HOUR");
  if (hourly !== undefined) candidates.push(hourly * Math.ceil(durationMin / 60));
  const halfDay = price("HALF_DAY");
  if (halfDay !== undefined && durationMin <= HALF_DAY_MAX_MIN) candidates.push(halfDay);
  const day = price("DAY");
  if (day !== undefined) candidates.push(day);

  return candidates.length ? Math.min(...candidates) : null;
}

/** Formate un montant en centimes : 95000 → « 950,00 € ». */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
