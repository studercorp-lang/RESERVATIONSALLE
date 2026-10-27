/**
 * Enregistrement d'une réservation sur un créneau, avec TOUTES les vérifications
 * faites côté serveur. La base de données a le dernier mot : si deux demandes
 * arrivent au même instant, la contrainte `bookings_no_overlap` n'en accepte qu'une.
 */
import { addDays } from "date-fns";
import { BookingSource, BookingStatus, Prisma, type Booking } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { estimatePriceCents } from "@/lib/availability/pricing";
import { expireStalePending, getBusyByRoom, getClosuresByRoom, isOverlapViolation } from "@/lib/availability/queries";
import { blockedInterval, checkSlotRules, conflictsWith, type RejectionReason } from "@/lib/availability/rules";
import { generateReference } from "./reference";

export class BookingRejectedError extends Error {
  constructor(public readonly reasons: RejectionReason[]) {
    super(`Réservation refusée : ${reasons.join(", ")}`);
    this.name = "BookingRejectedError";
  }
}

type Tx = Prisma.TransactionClient;

export type ReserveInput = {
  roomId: string;
  /**
   * Client : identifiant existant, ou fonction qui crée/met à jour la fiche client
   * DANS la transaction — ainsi, si le créneau est refusé, aucune donnée
   * personnelle n'est enregistrée inutilement.
   */
  customer: string | ((tx: Tx) => Promise<string>);
  /** Opérations complémentaires dans la même transaction (consentements, lien de gestion…). */
  afterCreate?: (tx: Tx, booking: Booking) => Promise<void>;
  startsAt: Date;
  endsAt: Date;
  attendees: number;
  comment?: string | null;
  source?: BookingSource;
  /**
   * Saisie par l'équipe (back-office) : les délais minimum et maximum de
   * réservation ne s'appliquent pas. Toutes les autres règles restent vérifiées.
   */
  byTeam?: boolean;
};

const TEAM_OVERRIDES: RejectionReason[] = ["TOO_SOON", "TOO_FAR"];

export async function reserveSlot(input: ReserveInput, now = new Date(), settings?: Settings): Promise<Booking> {
  const cfg = settings ?? (await getSettings());

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Libère d'abord les demandes en attente expirées de cette salle
        await expireStalePending(now, tx, input.roomId);

        const room = await tx.room.findUnique({
          where: { id: input.roomId },
          include: { openingHours: true, priceRules: true },
        });
        if (!room) throw new BookingRejectedError(["ROOM_INACTIVE"]);

        const window = { from: addDays(input.startsAt, -1), to: addDays(input.endsAt, 1) };
        const closures = await getClosuresByRoom([room.id], window.from, window.to, tx);
        let reasons = checkSlotRules({
          room,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          attendees: input.attendees,
          closures: closures.get(room.id) ?? [],
          settings: cfg,
          now,
        });
        if (input.byTeam) reasons = reasons.filter((r) => !TEAM_OVERRIDES.includes(r));
        if (reasons.length) throw new BookingRejectedError(reasons);

        // Vérification « amicale » (message clair) ; la contrainte en base reste la garantie finale.
        const busy = await getBusyByRoom([room.id], window.from, window.to, now, tx);
        if (conflictsWith(input.startsAt, input.endsAt, room.bufferMin, busy.get(room.id) ?? [])) {
          throw new BookingRejectedError(["SLOT_TAKEN"]);
        }

        const customerId = typeof input.customer === "string" ? input.customer : await input.customer(tx);
        const status = cfg.autoConfirm ? BookingStatus.CONFIRMED : BookingStatus.PENDING;
        const booking = await tx.booking.create({
          data: {
            reference: generateReference(),
            roomId: room.id,
            customerId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            blockedUntil: blockedInterval(input.startsAt, input.endsAt, room.bufferMin).end,
            attendees: input.attendees,
            comment: input.comment?.trim() || null,
            source: input.source ?? BookingSource.ONLINE,
            status,
            estimatedCents: estimatePriceCents(room.priceRules, input.startsAt, input.endsAt),
            pendingExpiresAt: status === BookingStatus.PENDING ? addDays(now, cfg.pendingHoldDays) : null,
            decidedAt: status === BookingStatus.CONFIRMED ? now : null,
          },
        });
        await input.afterCreate?.(tx, booking);
        return booking;
      });
    } catch (error) {
      if (error instanceof BookingRejectedError) throw error;
      if (isOverlapViolation(error)) throw new BookingRejectedError(["SLOT_TAKEN"]);
      // Collision (très improbable) sur la référence aléatoire : on réessaie
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("Impossible de générer une référence unique");
}
