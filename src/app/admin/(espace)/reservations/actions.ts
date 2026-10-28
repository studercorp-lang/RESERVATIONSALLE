"use server";

import { redirect } from "next/navigation";
import {
  cancelBookingByTeam,
  completeBooking,
  confirmBooking,
  createBookingByTeam,
  refuseBooking,
  rescheduleByTeam,
  updateInternalNote,
  type AdminResult,
} from "@/lib/admin/bookings";
import { actorLabel, requireStaff } from "@/lib/auth/session";
import type { ActionState } from "@/components/ActionForm";

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const notifyOpts = (fd: FormData) => ({ notify: fd.get("notify") === "on", message: text(fd, "message").trim().slice(0, 2000) || undefined });

async function actor() {
  const s = await requireStaff();
  return { id: s.userId, label: actorLabel(s) };
}

function finish(id: string, result: AdminResult, code: string): ActionState {
  if (result.ok) redirect(`/admin/reservations/${result.id ?? id}?ok=${code}`);
  return { error: result.error, fieldErrors: result.fieldErrors };
}

export async function confirmAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return finish(id, await confirmBooking(id, await actor(), notifyOpts(fd)), "confirmee");
}

export async function refuseAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return finish(id, await refuseBooking(id, await actor(), notifyOpts(fd)), "refusee");
}

export async function cancelAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  if (fd.get("sure") !== "on") return { error: "Cochez la case pour confirmer l'annulation." };
  return finish(id, await cancelBookingByTeam(id, await actor(), notifyOpts(fd)), "annulee");
}

export async function completeAction(id: string): Promise<ActionState> {
  return finish(id, await completeBooking(id, await actor()), "terminee");
}

export async function noteAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  return finish(id, await updateInternalNote(id, await actor(), text(fd, "note")), "note");
}

export async function rescheduleAction(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const result = await rescheduleByTeam(
    id,
    await actor(),
    { roomId: text(fd, "roomId"), date: text(fd, "date"), startMin: text(fd, "debut"), endMin: text(fd, "fin"), attendees: text(fd, "personnes") },
    notifyOpts(fd),
  );
  return finish(id, result, "modifiee");
}

export async function createAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const result = await createBookingByTeam(await actor(), {
    roomId: text(fd, "roomId"),
    slot: { date: text(fd, "date"), startMin: text(fd, "debut"), endMin: text(fd, "fin"), attendees: text(fd, "personnes") },
    contact: {
      lastName: text(fd, "lastName"), firstName: text(fd, "firstName"), email: text(fd, "email"),
      phone: text(fd, "phone"), company: text(fd, "company"), comment: text(fd, "comment"),
    },
    status: fd.get("status") === "CONFIRMED" ? "CONFIRMED" : "PENDING",
    sendEmail: fd.get("sendEmail") === "on",
    termsInformed: fd.get("termsInformed") === "on",
  });
  return finish("", result, "creee");
}
