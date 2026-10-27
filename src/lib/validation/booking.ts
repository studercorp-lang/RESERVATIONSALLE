/**
 * Schémas de validation partagés entre le navigateur (confort de saisie) et
 * le serveur (seule vérification qui fait foi).
 */
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";

// Messages d'erreur génériques en français (filet de sécurité : les messages
// importants sont personnalisés ci-dessous).
z.config(z.locales.fr());

export const COMMENT_MAX = 1000;
export const MAX_ATTENDEES = 500;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const minutes = z.coerce.number().int().min(0).max(1440);

/** Créneau recherché : date (Paris), heure de début/fin en minutes, nombre de personnes. */
export const slotSchema = z
  .object({
    date: isoDate,
    startMin: minutes,
    endMin: minutes,
    attendees: z.coerce
      .number({ error: "Indiquez le nombre de personnes." })
      .int("Indiquez un nombre entier.")
      .min(1, "Au moins 1 personne.")
      .max(MAX_ATTENDEES, `Au maximum ${MAX_ATTENDEES} personnes.`),
  })
  .refine((s) => s.endMin > s.startMin, { message: "L'heure de fin doit être après l'heure de début.", path: ["endMin"] });

export type SlotInput = z.infer<typeof slotSchema>;

const name = (label: string) =>
  z.string().trim().min(1, `${label} est obligatoire.`).max(80, `${label} : 80 caractères maximum.`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères maximum.`)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Coordonnées du client — uniquement les champs prévus (minimisation RGPD). */
export const contactSchema = z.object({
  lastName: name("Le nom"),
  firstName: name("Le prénom"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Adresse e-mail trop longue.")
    .pipe(z.email("Adresse e-mail invalide (exemple : nom@domaine.fr).")),
  phone: z
    .string()
    .trim()
    .min(1, "Le numéro de téléphone est obligatoire.")
    .transform((v, ctx) => {
      const parsed = parsePhoneNumberFromString(v, "FR"); // +33 par défaut
      if (!parsed?.isValid()) {
        ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide (exemple : 06 12 34 56 78 ou +41 …)." });
        return z.NEVER;
      }
      return parsed.number; // format international E.164 : +33612345678
    }),
  company: optionalText(120, "Société"),
  comment: optionalText(COMMENT_MAX, "Commentaire"),
});

/** Formulaire complet de demande de réservation. */
export const bookingRequestSchema = z.object({
  roomSlug: z.string().min(1).max(100),
  slot: slotSchema,
  contact: contactSchema,
  acceptTerms: z.literal(true, { error: "Vous devez accepter les conditions de réservation." }),
  marketingOptIn: z.boolean(),
});

export type BookingRequestInput = z.input<typeof bookingRequestSchema>;
export type BookingRequest = z.output<typeof bookingRequestSchema>;

/** Transforme les erreurs Zod en { "contact.email": "message" } pour l'affichage à côté des champs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
