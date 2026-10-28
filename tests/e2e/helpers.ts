import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const OUTBOX = path.join(__dirname, "..", "..", ".outbox-e2e");

/** Date d'ouverture (pas un lundi) dans au moins `days` jours, au format AAAA-MM-JJ. */
export function openDate(days: number): string {
  for (let i = days; ; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    const iso = d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
    if (new Date(`${iso}T12:00:00Z`).getUTCDay() !== 1) return iso;
  }
}

/** Contenu du dernier e-mail « envoyé » dont l'objet contient `subject`. */
export function lastMail(subject: RegExp): string {
  const files = readdirSync(OUTBOX).filter((f) => f.endsWith(".html")).sort();
  for (const f of files.reverse()) {
    const content = readFileSync(path.join(OUTBOX, f), "utf8");
    if (subject.test(content.split("\n")[0])) return content;
  }
  throw new Error(`Aucun e-mail correspondant à ${subject}`);
}

export const manageLink = (html: string) => /href="(http:\/\/localhost:3100\/reservation\/[A-Za-z0-9_-]{43})"/.exec(html)?.[1];
