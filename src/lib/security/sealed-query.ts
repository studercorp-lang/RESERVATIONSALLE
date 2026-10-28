/**
 * Recherches du back-office sans donnée personnelle en clair dans l'adresse :
 * le texte recherché (nom, e-mail…) est chiffré avant d'être placé dans l'URL,
 * qui peut apparaître dans les journaux de l'hébergeur ou l'historique du navigateur.
 */
import { decrypt, encrypt } from "@/lib/auth/crypto";

export const sealQuery = (q: string) => encrypt(q.slice(0, 200));

/** Texte recherché, ou chaîne vide si le paramètre est absent ou invalide. */
export function openQuery(sealed: string | null | undefined): string {
  if (!sealed) return "";
  try {
    return decrypt(sealed);
  } catch {
    return "";
  }
}
