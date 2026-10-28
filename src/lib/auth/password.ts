/** Mots de passe de l'équipe : hachage argon2id (recommandation ANSSI / OWASP). */
import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Le mot de passe doit contenir au moins 12 caractères.")
  .max(200, "Mot de passe trop long.")
  .refine((p) => /[a-zA-Z]/.test(p) && /[^a-zA-Z]/.test(p), "Mélangez des lettres et des chiffres ou symboles.");

export const hashPassword = (password: string) => hash(password);

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hachage factice pour garder un temps de réponse identique quand l'e-mail est inconnu. */
let dummy: string | undefined;
export async function dummyVerify(password: string) {
  dummy ??= await hash("mot-de-passe-factice-0");
  await verifyPassword(dummy, password);
}
