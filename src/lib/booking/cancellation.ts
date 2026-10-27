/**
 * Calcul des frais d'annulation selon le barème configuré dans les réglages.
 * Ces frais s'appliquent au montant TTC du devis accepté ; une simple demande
 * en attente (pas encore de devis) peut toujours être annulée sans frais.
 */
import { differenceInCalendarDays } from "date-fns";
import type { Settings } from "@/lib/settings";
import { utcToParis } from "@/lib/time";

/** Nombre de jours calendaires (à Paris) entre la date d'annulation et le jour du créneau. */
export function daysBefore(startsAt: Date, cancelledAt: Date): number {
  return differenceInCalendarDays(
    new Date(utcToParis(startsAt).isoDate),
    new Date(utcToParis(cancelledAt).isoDate),
  );
}

/** Pourcentage de frais dû pour une annulation à la date `cancelledAt`. */
export function cancellationFeePercent(
  startsAt: Date,
  cancelledAt: Date,
  settings: Pick<Settings, "cancellationTiers" | "noShowFeePercent">,
): number {
  if (cancelledAt >= startsAt) return settings.noShowFeePercent;
  const days = daysBefore(startsAt, cancelledAt);
  const applicable = settings.cancellationTiers.filter((t) => days >= t.minDaysBefore);
  if (applicable.length === 0) return settings.noShowFeePercent;
  return Math.min(...applicable.map((t) => t.feePercent));
}

/** Barème en toutes lettres, ex. « aucun frais à 30 jours ou plus, 25 % de 29 à 16 jours, … ». */
export function describeCancellationPolicy(settings: Pick<Settings, "cancellationTiers" | "noShowFeePercent">): string {
  const tiers = [...settings.cancellationTiers].sort((a, b) => b.minDaysBefore - a.minDaysBefore);
  const fee = (p: number) => (p === 0 ? "aucun frais" : `${p} %`);
  const parts = tiers.map((t, i) => {
    const upper = i === 0 ? null : tiers[i - 1].minDaysBefore - 1;
    if (upper === null) return `${fee(t.feePercent)} à ${t.minDaysBefore} jours ou plus`;
    if (t.minDaysBefore === 0) return `${fee(t.feePercent)} à ${upper} jours ou moins`;
    return `${fee(t.feePercent)} de ${upper} à ${t.minDaysBefore} jours`;
  });
  return `${parts.join(", ")} avant le jour réservé ; ${fee(settings.noShowFeePercent)} en cas d'absence`;
}
