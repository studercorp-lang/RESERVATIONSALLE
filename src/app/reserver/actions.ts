"use server";

import { submitBookingRequest, type BookingRequestResult } from "@/lib/booking/request";
import { clientIp, consumeRateLimit, rateKey } from "@/lib/security/rate-limit";

export type RequestState = BookingRequestResult | null;

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/**
 * Action serveur appelée par le formulaire de demande.
 * (Next.js vérifie automatiquement l'origine de la requête : protection CSRF.)
 */
export async function requestBooking(_prev: RequestState, fd: FormData): Promise<RequestState> {
  // Pot de miel : champ invisible pour les humains, rempli par les robots.
  if (text(fd, "site_web")) return { ok: false, formError: "Votre demande n'a pas pu être envoyée." };

  // Au maximum 5 demandes par tranche de 10 minutes depuis une même connexion.
  if (!(await consumeRateLimit(rateKey("booking", await clientIp()), 5, 600))) {
    return { ok: false, formError: "Trop de demandes envoyées. Merci de réessayer dans quelques minutes." };
  }

  return submitBookingRequest({
    roomSlug: text(fd, "salle"),
    slot: { date: text(fd, "date"), startMin: text(fd, "debut"), endMin: text(fd, "fin"), attendees: text(fd, "personnes") },
    contact: {
      lastName: text(fd, "lastName"),
      firstName: text(fd, "firstName"),
      email: text(fd, "email"),
      phone: text(fd, "phone"),
      company: text(fd, "company"),
      comment: text(fd, "comment"),
    },
    acceptTerms: fd.get("acceptTerms") === "on",
    marketingOptIn: fd.get("marketingOptIn") === "on",
  });
}
