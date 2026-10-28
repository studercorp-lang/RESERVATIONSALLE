"use server";

import { revalidatePath } from "next/cache";
import { AdminRole } from "@prisma/client";
import { createStaff, resetPassword, resetTotp, setActive, setRole, type TeamResult } from "@/lib/admin/team";
import { actorLabel, requireStaff } from "@/lib/auth/session";

export type TeamState = { error?: string; password?: string; done?: string } | null;

async function admin() {
  const s = await requireStaff("ADMIN");
  return { id: s.userId, label: actorLabel(s) };
}

function result(r: TeamResult, done: string): TeamState {
  revalidatePath("/admin/equipe");
  return r.ok ? { done, password: r.temporaryPassword } : { error: r.error };
}

export async function createStaffAction(_p: TeamState, fd: FormData): Promise<TeamState> {
  return result(await createStaff(await admin(), { email: fd.get("email"), name: fd.get("name"), role: fd.get("role") }), "Compte créé.");
}
export async function toggleActiveAction(userId: string, active: boolean): Promise<TeamState> {
  return result(await setActive(await admin(), userId, active), active ? "Compte réactivé." : "Compte désactivé.");
}
export async function setRoleAction(userId: string, _p: TeamState, fd: FormData): Promise<TeamState> {
  const role = fd.get("role") === "ADMIN" ? AdminRole.ADMIN : AdminRole.MANAGER;
  return result(await setRole(await admin(), userId, role), "Rôle modifié.");
}
export async function resetPasswordAction(userId: string): Promise<TeamState> {
  return result(await resetPassword(await admin(), userId), "Nouveau mot de passe provisoire créé.");
}
export async function resetTotpAction(userId: string): Promise<TeamState> {
  return result(await resetTotp(await admin(), userId), "Double authentification réinitialisée.");
}
