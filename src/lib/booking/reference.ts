import { randomInt } from "node:crypto";

// Alphabet sans caractères ambigus (pas de 0/O, 1/I/L) pour être dicté au téléphone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Référence lisible et aléatoire, ex. « Q19-7K3F9X ». */
export function generateReference(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `Q19-${code}`;
}
