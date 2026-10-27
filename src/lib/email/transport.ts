/**
 * Envoi des e-mails.
 * - Production : SMTP du prestataire configuré (Brevo par défaut) via les variables SMTP_*.
 * - Développement (pas de SMTP_HOST) : les e-mails ne partent pas, ils sont
 *   enregistrés dans le dossier local `.outbox/` (exclu de Git) pour être relus.
 * - Tests (EMAIL_TRANSPORT=memory) : gardés en mémoire.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

export type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string };

/** Boîte d'envoi en mémoire, utilisée par les tests automatisés. */
export const memoryOutbox: Mail[] = [];

let smtp: Transporter | null = null;

export async function deliver(mail: Mail): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "QUAI 19 <no-reply@localhost>";

  if (process.env.EMAIL_TRANSPORT === "memory") {
    memoryOutbox.push(mail);
    return;
  }

  if (!process.env.SMTP_HOST) {
    const dir = path.join(process.cwd(), ".outbox");
    await mkdir(dir, { recursive: true });
    const file = `${new Date().toISOString().replace(/[:.]/g, "-")}-${mail.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.html`;
    await writeFile(path.join(dir, file), `<!-- À : ${mail.to} | Objet : ${mail.subject} -->\n${mail.html}`);
    return;
  }

  smtp ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    requireTLS: Number(process.env.SMTP_PORT ?? 587) !== 465, // chiffrement obligatoire
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await smtp.sendMail({ from, ...mail });
}
