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
