"use server";

import { redirect } from "next/navigation";
import {
  cancelByClient,
  modifyByClient,
  updateContactByClient,
  withdrawMarketingByClient,
  type ActionResult,
} from "@/lib/booking/manage";
import { clientIp, consumeRateLimit, rateKey } from "@/lib/security/rate-limit";

export type ManageState = ActionResult | null;

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");

async function limited(): Promise<boolean> {
  // 20 actions par tranche de 10 minutes depuis une même connexion
  return !(await consumeRateLimit(rateKey("manage", await clientIp()), 20, 600));
}
const TOO_MANY: ManageState = { ok: false, error: "Trop de tentatives. Merci de réessayer dans quelques minutes." };

/** Après une action réussie, on recharge la page avec un message de confirmation. */
function done(token: string, result: ActionResult, code: string): ManageState {
  if (result.ok) redirect(`/reservation/${token}?ok=${code}`);
  return result;
}

export async function cancelAction(token: string, _prev: ManageState, fd: FormData): Promise<ManageState> {
  if (await limited()) return TOO_MANY;
  if (fd.get("confirm") !== "oui") return { ok: false, error: "Merci de confirmer l'annulation." };
  return done(token, await cancelByClient(token), "annulee");
}

export async function modifyAction(token: string, _prev: ManageState, fd: FormData): Promise<ManageState> {
  if (await limited()) return TOO_MANY;
  const result = await modifyByClient(token, {
    date: text(fd, "date"),
    startMin: text(fd, "debut"),
    endMin: text(fd, "fin"),
    attendees: text(fd, "personnes"),
  });
  return done(token, result, "modifiee");
}

export async function contactAction(token: string, _prev: ManageState, fd: FormData): Promise<ManageState> {
  if (await limited()) return TOO_MANY;
  const result = await updateContactByClient(token, {
    lastName: text(fd, "lastName"),
    firstName: text(fd, "firstName"),
    phone: text(fd, "phone"),
    company: text(fd, "company"),
  });
  return done(token, result, "coordonnees");
}

export async function marketingAction(token: string): Promise<ManageState> {
  if (await limited()) return TOO_MANY;
  return done(token, await withdrawMarketingByClient(token), "desinscription");
}
