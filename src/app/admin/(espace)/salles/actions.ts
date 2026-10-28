"use server";

import { redirect } from "next/navigation";
import { PriceUnit } from "@prisma/client";
import {
  addClosure,
  addPhoto,
  deleteClosure,
  deletePhoto,
  movePhoto,
  saveOpeningHours,
  savePrices,
  saveRoom,
  type DayHours,
} from "@/lib/admin/rooms";
import type { AdminResult } from "@/lib/admin/bookings";
import { actorLabel, requireStaff } from "@/lib/auth/session";
import type { ActionState } from "@/components/ActionForm";

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const num = (fd: FormData, k: string) => Number(fd.get(k));

async function actor() {
  const s = await requireStaff();
  return { id: s.userId, label: actorLabel(s) };
}

function finish(result: AdminResult, target: (id?: string) => string, code: string): ActionState {
  if (result.ok) redirect(`${target(result.id)}?ok=${code}`);
  return { error: result.error, fieldErrors: result.fieldErrors };
}
const roomPage = (id?: string) => `/admin/salles/${id}`;

export async function saveRoomAction(id: string | null, _p: ActionState, fd: FormData): Promise<ActionState> {
  const result = await saveRoom(await actor(), id, {
    name: text(fd, "name"),
    description: text(fd, "description"),
    capacity: text(fd, "capacity"),
    equipment: text(fd, "equipment"),
    accessiblePmr: fd.get("accessiblePmr") === "on",
    minDurationMin: text(fd, "minDurationMin"),
    maxDurationMin: text(fd, "maxDurationMin"),
    bufferMin: text(fd, "bufferMin"),
    active: fd.get("active") === "on",
    sortOrder: text(fd, "sortOrder") || "0",
  });
  return finish(result, roomPage, id ? "infos" : "creee");
}

export async function saveHoursAction(roomId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const days: DayHours[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    open: fd.get(`open-${weekday}`) === "on",
    openMin: num(fd, `openMin-${weekday}`),
    closeMin: num(fd, `closeMin-${weekday}`),
    lastStartMin: text(fd, `lastStartMin-${weekday}`) === "" ? null : num(fd, `lastStartMin-${weekday}`),
  }));
  return finish(await saveOpeningHours(await actor(), roomId, days), roomPage, "horaires");
}

export async function addClosureAction(roomId: string | null, _p: ActionState, fd: FormData): Promise<ActionState> {
  const mode = text(fd, "mode") === "creneau" ? "creneau" : "jours";
  const result = await addClosure(
    await actor(),
    roomId,
    mode === "jours"
      ? { mode, from: text(fd, "from"), to: text(fd, "to") || text(fd, "from"), reason: text(fd, "reason") }
      : { mode, start: text(fd, "start"), end: text(fd, "end"), reason: text(fd, "reason") },
  );
  if (result.ok) {
    const back = roomId ? `/admin/salles/${roomId}` : "/admin/salles";
    const warn = result.overlapping?.length ? `&chevauche=${encodeURIComponent(result.overlapping.join(","))}` : "";
    redirect(`${back}?ok=blocage${warn}`);
  }
  return { error: result.error };
}

export async function deleteClosureAction(id: string): Promise<ActionState> {
  const result = await deleteClosure(await actor(), id);
  redirect(`${result.ok && result.id ? `/admin/salles/${result.id}` : "/admin/salles"}?ok=blocage-supprime`);
}

export async function savePricesAction(roomId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const grid: Record<string, string> = {};
  for (let d = 1; d <= 7; d++) for (const u of Object.values(PriceUnit)) grid[`${d}-${u}`] = text(fd, `price-${d}-${u}`);
  return finish(await savePrices(await actor(), roomId, grid), roomPage, "tarifs");
}

export async function addPhotoAction(roomId: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const file = fd.get("photo");
  return finish(await addPhoto(await actor(), roomId, file instanceof File ? file : null, text(fd, "alt")), roomPage, "photo");
}

export async function deletePhotoAction(photoId: string): Promise<ActionState> {
  return finish(await deletePhoto(await actor(), photoId), roomPage, "photo-supprimee");
}

export async function movePhotoAction(photoId: string, direction: -1 | 1): Promise<ActionState> {
  return finish(await movePhoto(await actor(), photoId, direction), roomPage, "photo-deplacee");
}
