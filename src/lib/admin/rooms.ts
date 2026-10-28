/**
 * Gestion des salles par l'équipe : informations, horaires, blocages, tarifs, photos.
 * Toutes les saisies sont validées côté serveur et tracées dans le journal d'audit.
 */
import { PriceUnit, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/log";
import { activeBookingWhere } from "@/lib/availability/queries";
import { openingHoursCheck } from "@/lib/availability/rules";
import { parisToUtc, utcToParis } from "@/lib/time";
import { fieldErrors } from "@/lib/validation/booking";
import type { Actor, AdminResult } from "./bookings";

// ---------------------------------------------------------------------------
// Informations générales
// ---------------------------------------------------------------------------

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const int = (label: string, min: number, max: number) =>
  z.coerce.number({ error: `${label} : nombre attendu.` }).int(`${label} : nombre entier attendu.`).min(min, `${label} : minimum ${min}.`).max(max, `${label} : maximum ${max}.`);

export const roomSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
    description: z.string().trim().max(2000, "Description : 2000 caractères maximum."),
    capacity: int("Capacité", 1, 2000),
    equipment: z.string().max(1000).transform((s) => s.split(/[\n,]/).map((e) => e.trim()).filter(Boolean).slice(0, 30)),
    accessiblePmr: z.boolean(),
    minDurationMin: int("Durée minimale", 15, 1440),
    maxDurationMin: int("Durée maximale", 15, 1440),
    bufferMin: int("Temps tampon", 0, 480),
    active: z.boolean(),
    sortOrder: int("Ordre d'affichage", 0, 999),
  })
  .refine((r) => r.maxDurationMin >= r.minDurationMin, { message: "La durée maximale doit être supérieure ou égale à la durée minimale.", path: ["maxDurationMin"] });

export async function saveRoom(actor: Actor, id: string | null, raw: unknown): Promise<AdminResult> {
  const parsed = roomSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Merci de corriger les champs signalés.", fieldErrors: fieldErrors(parsed.error) };
  const data = parsed.data;
  if (id) {
    await prisma.room.update({ where: { id }, data });
    await audit({ actorId: actor.id, actorLabel: actor.label, action: "room.update", entityType: "Room", entityId: id });
    return { ok: true, id };
  }
  let slug = slugify(data.name) || "salle";
  if (await prisma.room.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const room = await prisma.room.create({ data: { ...data, slug } });
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "room.create", entityType: "Room", entityId: room.id });
  return { ok: true, id: room.id };
}

// ---------------------------------------------------------------------------
// Horaires d'ouverture (une plage par jour, pouvant finir après minuit)
// ---------------------------------------------------------------------------

export type DayHours = { weekday: number; open: boolean; openMin: number; closeMin: number; lastStartMin: number | null };

export function validateHours(days: DayHours[]): string | null {
  for (const d of days.filter((x) => x.open)) {
    const name = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][d.weekday];
    if (!(d.openMin >= 0 && d.openMin < 1440)) return `Heure d'ouverture invalide le ${name}.`;
    if (!(d.closeMin > d.openMin && d.closeMin <= 2880)) return `Le ${name}, la fermeture doit être après l'ouverture.`;
    if (d.closeMin - d.openMin > 24 * 60) return `Le ${name}, l'amplitude ne peut pas dépasser 24 h.`;
    if (d.lastStartMin != null && !(d.lastStartMin >= d.openMin && d.lastStartMin < d.closeMin)) {
      return `Le ${name}, l'heure de dernier début doit être comprise entre l'ouverture et la fermeture.`;
    }
  }
  return null;
}

/** Remplace les horaires d'une salle. Les réservations existantes ne sont jamais modifiées. */
export async function saveOpeningHours(actor: Actor, roomId: string, days: DayHours[]): Promise<AdminResult> {
  const error = validateHours(days);
  if (error) return { ok: false, error };
  await prisma.$transaction(async (tx) => {
    await tx.openingHours.deleteMany({ where: { roomId } });
    await tx.openingHours.createMany({
      data: days.filter((d) => d.open).map((d) => ({ roomId, weekday: d.weekday, openMin: d.openMin, closeMin: d.closeMin, lastStartMin: d.lastStartMin })),
    });
    await audit({ actorId: actor.id, actorLabel: actor.label, action: "room.hours", entityType: "Room", entityId: roomId, details: { openDays: days.filter((d) => d.open).map((d) => d.weekday) } }, tx);
  });
  return { ok: true, id: roomId };
}

/** Réservations à venir qui ne respectent plus les horaires actuels (à traiter à la main). */
export async function bookingsOutsideHours(roomId: string, now = new Date()) {
  const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId }, include: { openingHours: true } });
  const upcoming = await prisma.booking.findMany({
    where: { roomId, startsAt: { gt: now }, ...activeBookingWhere(now) },
    select: { id: true, reference: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: "asc" },
  });
  return upcoming.filter((b) => openingHoursCheck(room.openingHours, b.startsAt, b.endsAt) !== "OK");
}

// ---------------------------------------------------------------------------
// Blocages et fermetures exceptionnelles
// ---------------------------------------------------------------------------

/** « Journée entière » : de 6h00 à 6h00 le lendemain, pour ne pas toucher la nuit de la veille. */
export const FULL_DAY_FROM_MIN = 6 * 60;

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Date et heure invalides.");

export const closureSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("jours"), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début invalide."), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide."), reason: z.string().trim().max(200) }),
  z.object({ mode: z.literal("creneau"), start: localDateTime, end: localDateTime, reason: z.string().trim().max(200) }),
]);

const fromLocal = (v: string) => parisToUtc(v.slice(0, 10), Number(v.slice(11, 13)) * 60 + Number(v.slice(14, 16)));

/**
 * Bloque un créneau ou des journées entières, pour une salle ou tout l'établissement (roomId null).
 * Renvoie les réservations actives qui chevauchent le blocage (elles ne sont PAS annulées automatiquement).
 */
export async function addClosure(actor: Actor, roomId: string | null, raw: unknown, now = new Date()): Promise<AdminResult & { overlapping?: string[] }> {
  const parsed = closureSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const c = parsed.data;
  const startsAt = c.mode === "jours" ? parisToUtc(c.from, FULL_DAY_FROM_MIN) : fromLocal(c.start);
  const endsAt = c.mode === "jours" ? parisToUtc(c.to, 1440 + FULL_DAY_FROM_MIN) : fromLocal(c.end);
  if (endsAt <= startsAt) return { ok: false, error: "La fin du blocage doit être après son début." };

  const closure = await prisma.closure.create({ data: { roomId, startsAt, endsAt, reason: c.reason || null } });
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "closure.create", entityType: "Closure", entityId: closure.id, details: { roomId } });
  const overlapping = await prisma.booking.findMany({
    where: { ...(roomId ? { roomId } : {}), startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...activeBookingWhere(now) },
    select: { reference: true },
  });
  return { ok: true, id: closure.id, overlapping: overlapping.map((o) => o.reference) };
}

/** Supprime un blocage ; renvoie la salle concernée (vide si tout l'établissement). */
export async function deleteClosure(actor: Actor, id: string): Promise<AdminResult> {
  const c = await prisma.closure.delete({ where: { id }, select: { roomId: true } });
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "closure.delete", entityType: "Closure", entityId: id });
  return { ok: true, id: c.roomId ?? undefined };
}

/** Libellé lisible d'un blocage : « mardi 3 novembre 2026 (journée entière) » ou « mar. 3 nov., 18:00 → mer. 4 nov., 02:00 ». */
export function closureLabel(c: { startsAt: Date; endsAt: Date }): string {
  const s = utcToParis(c.startsAt);
  const e = utcToParis(c.endsAt);
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { dateStyle: "full", timeZone: "UTC" });
  if (s.minutes === FULL_DAY_FROM_MIN && e.minutes === FULL_DAY_FROM_MIN) {
    const lastDay = utcToParis(parisToUtc(e.isoDate, -12 * 60)).isoDate; // la veille de la date de fin
    return lastDay === s.isoDate ? `${day(s.isoDate)} (journée entière)` : `du ${day(s.isoDate)} au ${day(lastDay)} (journées entières)`;
  }
  const fmt = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${fmt(c.startsAt)} → ${fmt(c.endsAt)}`;
}

// ---------------------------------------------------------------------------
// Tarifs par jour
// ---------------------------------------------------------------------------

/** Montant saisi « 150 », « 150,50 » ou vide → centimes ou null. */
export function parseEuros(v: string): number | null | "invalid" {
  const s = v.trim().replace(/\s/g, "").replace("€", "").replace(",", ".");
  if (!s) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return "invalid";
  return Math.round(Number(s) * 100);
}

export async function savePrices(actor: Actor, roomId: string, grid: Record<string, string>): Promise<AdminResult> {
  const rows: Prisma.PriceRuleCreateManyInput[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    for (const unit of Object.values(PriceUnit)) {
      const v = parseEuros(grid[`${weekday}-${unit}`] ?? "");
      if (v === "invalid") return { ok: false, error: `Montant invalide : « ${grid[`${weekday}-${unit}`]} ». Exemple : 150 ou 150,50.` };
      if (v !== null) rows.push({ roomId, weekday, unit, amountCents: v });
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.priceRule.deleteMany({ where: { roomId } });
    await tx.priceRule.createMany({ data: rows });
    await audit({ actorId: actor.id, actorLabel: actor.label, action: "room.prices", entityType: "Room", entityId: roomId }, tx);
  });
  return { ok: true, id: roomId };
}

// ---------------------------------------------------------------------------
// Photos (stockées en base)
// ---------------------------------------------------------------------------

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/** Type réel du fichier d'après ses premiers octets (on ne fait pas confiance à l'extension). */
export function detectImageType(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function addPhoto(actor: Actor, roomId: string, file: File | null, alt: string): Promise<AdminResult> {
  if (!file || file.size === 0) return { ok: false, error: "Choisissez une image." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "Image trop lourde (3 Mo maximum). Réduisez-la avant de l'envoyer." };
  const altText = alt.trim();
  if (altText.length < 3) return { ok: false, error: "Décrivez la photo en quelques mots (texte alternatif pour les personnes malvoyantes)." };
  const buf = Buffer.from(await file.arrayBuffer());
  const mimeType = detectImageType(buf);
  if (!mimeType) return { ok: false, error: "Format non accepté : utilisez une image JPEG, PNG ou WebP." };
  const count = await prisma.roomPhoto.count({ where: { roomId } });
  if (count >= 12) return { ok: false, error: "12 photos maximum par salle." };
  const photo = await prisma.roomPhoto.create({ data: { roomId, data: buf, mimeType, alt: altText.slice(0, 200), sortOrder: count } });
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "photo.add", entityType: "Room", entityId: roomId, details: { photoId: photo.id } });
  return { ok: true, id: roomId };
}

export async function deletePhoto(actor: Actor, photoId: string): Promise<AdminResult> {
  const p = await prisma.roomPhoto.delete({ where: { id: photoId }, select: { roomId: true } });
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "photo.delete", entityType: "Room", entityId: p.roomId, details: { photoId } });
  return { ok: true, id: p.roomId };
}

/** Déplace une photo d'un cran (la première est la photo principale). */
export async function movePhoto(actor: Actor, photoId: string, direction: -1 | 1): Promise<AdminResult> {
  const photo = await prisma.roomPhoto.findUniqueOrThrow({ where: { id: photoId }, select: { roomId: true } });
  const list = await prisma.roomPhoto.findMany({ where: { roomId: photo.roomId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const i = list.findIndex((p) => p.id === photoId);
  const j = i + direction;
  if (j < 0 || j >= list.length) return { ok: true, id: photo.roomId };
  [list[i], list[j]] = [list[j], list[i]];
  await prisma.$transaction(list.map((p, idx) => prisma.roomPhoto.update({ where: { id: p.id }, data: { sortOrder: idx } })));
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "photo.reorder", entityType: "Room", entityId: photo.roomId });
  return { ok: true, id: photo.roomId };
}
