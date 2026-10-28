"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/audit/log";
import { actorLabel, requireStaff } from "@/lib/auth/session";
import { fieldErrors } from "@/lib/validation/booking";
import { settingsSchema, updateSettings } from "@/lib/settings";
import type { ActionState } from "@/components/ActionForm";

const n = (fd: FormData, k: string) => Number(fd.get(k));

export async function saveSettingsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireStaff("ADMIN");
  const tiers = [0, 1, 2, 3, 4]
    .map((i) => ({ minDaysBefore: String(fd.get(`tierDays-${i}`) ?? ""), feePercent: String(fd.get(`tierFee-${i}`) ?? "") }))
    .filter((t) => t.minDaysBefore !== "" && t.feePercent !== "")
    .map((t) => ({ minDaysBefore: Number(t.minDaysBefore), feePercent: Number(t.feePercent) }));
  if (new Set(tiers.map((t) => t.minDaysBefore)).size !== tiers.length) return { error: "Deux paliers d'annulation ont le même nombre de jours." };

  const parsed = settingsSchema.safeParse({
    autoConfirm: fd.get("autoConfirm") === "on",
    pendingHoldDays: n(fd, "pendingHoldDays"),
    maxAdvanceMonths: n(fd, "maxAdvanceMonths"),
    minNoticeHours: n(fd, "minNoticeHours"),
    reminderHoursBefore: n(fd, "reminderHoursBefore"),
    clientChangeDeadlineHours: n(fd, "clientChangeDeadlineHours"),
    cancellationTiers: tiers,
    noShowFeePercent: n(fd, "noShowFeePercent"),
    retentionBookingYears: n(fd, "retentionBookingYears"),
    retentionProspectYears: n(fd, "retentionProspectYears"),
    retentionAuditMonths: n(fd, "retentionAuditMonths"),
  });
  if (!parsed.success) return { error: "Certaines valeurs sont hors limites.", fieldErrors: fieldErrors(parsed.error) };
  await updateSettings(parsed.data);
  await audit({ actorId: session.userId, actorLabel: actorLabel(session), action: "settings.update", entityType: "Setting", details: parsed.data });
  redirect("/admin/reglages?ok=1");
}
