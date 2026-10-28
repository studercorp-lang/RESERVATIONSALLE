"use server";

import { redirect } from "next/navigation";
import { erasePerson, rectifyPerson, withdrawMarketing, type GdprResult } from "@/lib/gdpr/person";
import { actorLabel, requireStaff } from "@/lib/auth/session";
import type { ActionState } from "@/components/ActionForm";

async function admin() {
  const s = await requireStaff("ADMIN");
  return { id: s.userId, label: actorLabel(s) };
}

function finish(id: string, r: GdprResult, code: string): ActionState {
  if (r.ok) redirect(`/admin/donnees-personnelles/${id}?ok=${code}`);
  return { error: r.error };
}

export async function rectifyAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const t = (k: string) => String(fd.get(k) ?? "");
  return finish(id, await rectifyPerson(id, await admin(), { lastName: t("lastName"), firstName: t("firstName"), email: t("email"), phone: t("phone"), company: t("company") }), "rectifiee");
}

export async function withdrawAction(id: string): Promise<ActionState> {
  return finish(id, await withdrawMarketing(id, await admin()), "retrait");
}

export async function eraseAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  if (String(fd.get("confirmation") ?? "").trim().toUpperCase() !== "EFFACER") return { error: "Tapez EFFACER pour confirmer." };
  return finish(id, await erasePerson(id, await admin()), "effacee");
}
