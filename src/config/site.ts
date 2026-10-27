/**
 * Informations générales affichées sur le site et dans les e-mails.
 * ✏️ À compléter / vérifier par QUAI 19.
 */
export const SITE = {
  name: "QUAI 19",
  address: "19 quai Saint-Antoine, 69002 Lyon",
  /** Adresse de contact affichée aux clients. */
  contactEmail: "contact@exemple.fr", // [À COMPLÉTER]
  /** Adresse dédiée aux demandes RGPD (accès, effacement…). */
  privacyEmail: "rgpd@exemple.fr", // [À COMPLÉTER]
  phone: "+33 4 00 00 00 00", // [À COMPLÉTER]
  /** Version des conditions de réservation : à changer à chaque modification du texte (preuve du consentement). */
  termsVersion: "cgr-2026-10",
  /** Version du texte de consentement à la prospection. */
  marketingVersion: "mkt-2026-10",
};

/** Adresse publique du site (pour les liens dans les e-mails). */
export function appUrl(path = ""): string {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}
