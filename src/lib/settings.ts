import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Réglages modifiables depuis le back-office.
 * Les valeurs ci-dessous sont les valeurs par défaut, utilisées tant que
 * l'équipe ne les a pas changées.
 */
export const settingsSchema = z.object({
  /** true : la demande est confirmée immédiatement ; false : l'équipe la valide. */
  autoConfirm: z.boolean(),
  /** Nombre de jours pendant lesquels une demande en attente bloque le créneau. */
  pendingHoldDays: z.number().int().min(1).max(60),
  /** Réservation possible jusqu'à N mois à l'avance. */
  maxAdvanceMonths: z.number().int().min(1).max(36),
  /** Délai minimum (en heures) entre la demande et le début du créneau. */
  minNoticeHours: z.number().int().min(0).max(24 * 60),
  /** Envoi du rappel N heures avant le créneau. */
  reminderHoursBefore: z.number().int().min(1).max(24 * 14),
  /** Le client peut annuler/modifier via son lien jusqu'à N heures avant le créneau. */
  clientChangeDeadlineHours: z.number().int().min(0).max(24 * 60),
  /**
   * Barème des frais d'annulation (sur le montant TTC du devis).
   * Chaque palier s'applique si l'annulation intervient au moins `minDaysBefore`
   * jours calendaires avant le jour du créneau. Le palier le plus favorable au
   * client parmi ceux qui s'appliquent est retenu.
   */
  cancellationTiers: z
    .array(z.object({ minDaysBefore: z.number().int().min(0), feePercent: z.number().int().min(0).max(100) }))
    .min(1),
  /** Frais en cas d'absence sans annulation (en % du devis). */
  noShowFeePercent: z.number().int().min(0).max(100),
  /** Conservation des données de réservation : N années après la date du créneau. */
  retentionBookingYears: z.number().int().min(1).max(10),
  /** Conservation des données de prospection : N années après le dernier contact. */
  retentionProspectYears: z.number().int().min(1).max(3),
  /** Conservation du journal d'audit : N mois. */
  retentionAuditMonths: z.number().int().min(1).max(60),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  autoConfirm: false,
  pendingHoldDays: 7,
  maxAdvanceMonths: 6,
  minNoticeHours: 24,
  reminderHoursBefore: 48,
  clientChangeDeadlineHours: 48,
  cancellationTiers: [
    { minDaysBefore: 30, feePercent: 0 }, // 30 jours ou plus avant : aucun frais
    { minDaysBefore: 16, feePercent: 25 }, // de 29 à 16 jours avant : 25 %
    { minDaysBefore: 8, feePercent: 50 }, // de 15 à 8 jours avant : 50 %
    { minDaysBefore: 0, feePercent: 90 }, // 7 jours ou moins : 90 %
  ],
  noShowFeePercent: 100,
  retentionBookingYears: 3,
  retentionProspectYears: 3,
  retentionAuditMonths: 12,
};

/** Lit les réglages en base et complète avec les valeurs par défaut. */
export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  // Une valeur invalide en base est ignorée au profit de la valeur par défaut.
  const merged = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const parsed = settingsSchema.shape[key].safeParse(stored[key]);
    if (parsed.success) (merged as Record<string, unknown>)[key] = parsed.data;
  }
  return merged;
}

/** Enregistre un ou plusieurs réglages (après validation). */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const valid = settingsSchema.partial().parse(patch);
  await prisma.$transaction(
    Object.entries(valid).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  );
  return getSettings();
}
