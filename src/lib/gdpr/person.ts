/**
 * Droits des personnes (RGPD) : accès, portabilité, rectification, effacement,
 * retrait du consentement. Réservé aux administrateurs ; chaque action est
 * tracée dans le journal d'audit (sans y recopier les données).
 */
import { BookingStatus, ConsentType, Prisma } from "@prisma/client";
import { SITE } from "@/config/site";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/log";
import { toCsv } from "@/lib/admin/csv";
import type { Actor } from "@/lib/admin/bookings";
import { formatDate, formatTime } from "@/lib/format";
import { contactSchema } from "@/lib/validation/booking";

export type GdprResult = { ok: true } | { ok: false; error: string };

const personInclude = {
  bookings: { include: { room: { select: { name: true } } }, orderBy: { startsAt: "desc" } },
  consents: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.CustomerInclude;

export type Person = Prisma.CustomerGetPayload<{ include: typeof personInclude }>;

/** Recherche par e-mail exact (insensible à la casse) ou partiel. */
export async function searchPeople(query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  return prisma.customer.findMany({
    where: { anonymizedAt: null, OR: [{ email: { contains: q } }, { lastName: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\s/g, "") } }] },
    orderBy: { email: "asc" },
    take: 20,
    select: { id: true, email: true, firstName: true, lastName: true, company: true },
  });
}

export async function getPerson(customerId: string, actor: Actor): Promise<Person | null> {
  const person = await prisma.customer.findUnique({ where: { id: customerId }, include: personInclude });
  if (person) await audit({ actorId: actor.id, actorLabel: actor.label, action: "customer.view", entityType: "Customer", entityId: customerId });
  return person;
}

/** Export lisible et réutilisable (droit d'accès et de portabilité). */
export async function exportPerson(customerId: string, actor: Actor, format: "json" | "csv"): Promise<{ filename: string; contentType: string; body: string } | null> {
  const p = await prisma.customer.findUnique({ where: { id: customerId }, include: personInclude });
  if (!p) return null;
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "customer.export", entityType: "Customer", entityId: customerId, details: { format } });
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const data = {
      responsableDeTraitement: { nom: SITE.name, adresse: SITE.address, contactRgpd: SITE.privacyEmail },
      dateExport: new Date().toISOString(),
      coordonnees: { nom: p.lastName, prenom: p.firstName, email: p.email, telephone: p.phone, societe: p.company, premiereDemande: p.createdAt, dernierContact: p.lastContactAt },
      prospectionCommerciale: { consentementActuel: p.marketingOptIn },
      reservations: p.bookings.map((b) => ({
        reference: b.reference, salle: b.room.name, debut: b.startsAt, fin: b.endsAt, personnes: b.attendees,
        statut: b.status, commentaire: b.comment, estimationTTCEuros: b.estimatedCents != null ? b.estimatedCents / 100 : null, creeeLe: b.createdAt,
      })),
      historiqueDesConsentements: p.consents.map((c) => ({ type: c.type === "TERMS" ? "conditions de réservation" : "prospection commerciale", accorde: c.granted, versionDuTexte: c.textVersion, origine: c.source, date: c.createdAt })),
    };
    return { filename: `donnees-${stamp}.json`, contentType: "application/json; charset=utf-8", body: JSON.stringify(data, null, 2) };
  }

  const rows: unknown[][] = [
    ["Coordonnées", "Nom", p.lastName], ["Coordonnées", "Prénom", p.firstName], ["Coordonnées", "E-mail", p.email],
    ["Coordonnées", "Téléphone", p.phone], ["Coordonnées", "Société", p.company ?? ""],
    ["Prospection", "Consentement actuel", p.marketingOptIn ? "oui" : "non"],
    ...p.bookings.map((b) => ["Réservation", b.reference, `${b.room.name} — ${formatDate(b.startsAt)} ${formatTime(b.startsAt)}-${formatTime(b.endsAt)} — ${b.attendees} pers. — ${b.status}${b.comment ? ` — ${b.comment}` : ""}`]),
    ...p.consents.map((c) => ["Consentement", c.type === "TERMS" ? "Conditions de réservation" : "Prospection", `${c.granted ? "accordé" : "retiré"} le ${formatDate(c.createdAt)} (${c.textVersion}, ${c.source})`]),
  ];
  return { filename: `donnees-${stamp}.csv`, contentType: "text/csv; charset=utf-8", body: toCsv(["Catégorie", "Élément", "Valeur"], rows) };
}

const rectifySchema = contactSchema.pick({ lastName: true, firstName: true, email: true, phone: true, company: true });

/** Correction des données (droit de rectification), y compris l'adresse e-mail. */
export async function rectifyPerson(customerId: string, actor: Actor, raw: unknown): Promise<GdprResult> {
  const parsed = rectifySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  const before = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  if (before.anonymizedAt) return { ok: false, error: "Les données de cette personne ont été effacées." };
  const d = parsed.data;
  if (d.email !== before.email && (await prisma.customer.findUnique({ where: { email: d.email } }))) {
    return { ok: false, error: "Cette adresse e-mail est déjà utilisée par une autre fiche." };
  }
  const changed = (["lastName", "firstName", "email", "phone", "company"] as const).filter((k) => (before[k] ?? null) !== (d[k] ?? null));
  await prisma.customer.update({ where: { id: customerId }, data: { lastName: d.lastName, firstName: d.firstName, email: d.email, phone: d.phone, company: d.company ?? null } });
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "customer.rectify", entityType: "Customer", entityId: customerId, details: { fields: changed } });
  return { ok: true };
}

/** Retrait du consentement à la prospection (sur demande reçue par e-mail, téléphone…). */
export async function withdrawMarketing(customerId: string, actor: Actor, now = new Date()): Promise<GdprResult> {
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id: customerId }, data: { marketingOptIn: false } });
    await tx.consent.create({ data: { customerId, type: ConsentType.MARKETING, granted: false, textVersion: SITE.marketingVersion, source: "back-office (demande de la personne)", createdAt: now } });
    await audit({ actorId: actor.id, actorLabel: actor.label, action: "consent.withdraw", entityType: "Customer", entityId: customerId, details: { type: "MARKETING" } }, tx);
  });
  return { ok: true };
}

/**
 * Effacement (droit à l'effacement) par ANONYMISATION : la personne n'est plus
 * identifiable, mais les créneaux restent dans l'historique (statistiques,
 * cohérence du planning). Le texte libre est supprimé, le lien de gestion désactivé.
 * Utilisée aussi par la purge automatique à l'échéance de la durée de conservation.
 */
export async function anonymizeCustomer(tx: Prisma.TransactionClient, customerId: string, now = new Date()) {
  await tx.customer.update({
    where: { id: customerId },
    data: {
      email: `efface-${customerId}@anonyme.invalid`,
      firstName: "Personne",
      lastName: "effacée",
      phone: "",
      company: null,
      marketingOptIn: false,
      anonymizedAt: now,
    },
  });
  await tx.booking.updateMany({ where: { customerId }, data: { comment: null, internalNote: null, manageTokenHash: null, manageTokenExpiry: null } });
  // Les preuves de consentement n'ont plus d'objet une fois la personne effacée
  await tx.consent.deleteMany({ where: { customerId } });
}

/** Effacement à la demande de la personne. Refusé s'il reste une réservation à venir active. */
export async function erasePerson(customerId: string, actor: Actor, now = new Date()): Promise<GdprResult> {
  const upcoming = await prisma.booking.count({
    where: { customerId, endsAt: { gt: now }, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
  });
  if (upcoming > 0) {
    return { ok: false, error: `Cette personne a ${upcoming} réservation(s) à venir : annulez-la(les) d'abord (ou attendez la date), puis effacez les données.` };
  }
  await prisma.$transaction(async (tx) => {
    await anonymizeCustomer(tx, customerId, now);
    await audit({ actorId: actor.id, actorLabel: actor.label, action: "customer.erase", entityType: "Customer", entityId: customerId, details: { reason: "demande de la personne" } }, tx);
  });
  return { ok: true };
}
