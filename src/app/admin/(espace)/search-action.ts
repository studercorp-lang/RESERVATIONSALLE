"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { sealQuery } from "@/lib/security/sealed-query";

const TARGETS = ["/admin/reservations", "/admin/contacts", "/admin/donnees-personnelles"] as const;

/** Reçoit un formulaire de recherche (POST) et redirige avec le texte recherché chiffré. */
export async function searchAction(target: (typeof TARGETS)[number], fd: FormData) {
  await requireStaff();
  if (!TARGETS.includes(target)) redirect("/admin");
  const params = new URLSearchParams();
  for (const [key, value] of fd.entries()) {
    if (key.startsWith("$") || typeof value !== "string" || !value.trim()) continue;
    params.set(key, key === "q" ? sealQuery(value.trim()) : value);
  }
  redirect(`${target}${params.size ? `?${params}` : ""}`);
}
