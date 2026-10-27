import { createHash, randomBytes } from "node:crypto";

/**
 * Jeton du lien de gestion envoyé au client :
 * 32 octets aléatoires (256 bits) → impossible à deviner.
 * Seule son empreinte SHA-256 est stockée en base : une fuite de la base
 * ne permet pas de reconstituer les liens.
 */
export function createManageToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
