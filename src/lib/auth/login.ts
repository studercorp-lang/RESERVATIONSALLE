/**
 * Connexion de l'équipe : mot de passe puis code de double authentification.
 * Protections : limitation par adresse IP, verrouillage du compte après
 * 5 échecs (15 min), message d'erreur identique que l'e-mail existe ou non.
 */
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/log";
import { consumeRateLimit, rateKey } from "@/lib/security/rate-limit";
import { decrypt } from "./crypto";
import { dummyVerify, verifyPassword } from "./password";
import { verifyTotp } from "./totp";

export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;
export const LOGIN_ERROR = "E-mail ou mot de passe incorrect.";

export type LoginResult = { ok: true; userId: string } | { ok: false; error: string };

export async function checkPassword(emailRaw: string, password: string, ip: string, now = new Date()): Promise<LoginResult> {
  if (!(await consumeRateLimit(rateKey("login", ip), 10, 900, now))) {
    return { ok: false, error: "Trop de tentatives depuis cette connexion. Réessayez dans 15 minutes." };
  }
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !user.active) {
    await dummyVerify(password);
    return { ok: false, error: LOGIN_ERROR };
  }
  if (user.lockedUntil && user.lockedUntil > now) {
    return { ok: false, error: `Compte temporairement verrouillé après plusieurs échecs. Réessayez dans ${LOCK_MINUTES} minutes.` };
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    await registerFailure(user.id, user.failedLogins, now);
    return { ok: false, error: LOGIN_ERROR };
  }
  await prisma.adminUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  return { ok: true, userId: user.id };
}

async function registerFailure(userId: string, failedLogins: number, now: Date) {
  const failures = failedLogins + 1;
  await prisma.adminUser.update({
    where: { id: userId },
    data: failures >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) } : { failedLogins: failures },
  });
  if (failures >= MAX_FAILED) {
    await audit({ actorLabel: "système", action: "admin.locked", entityType: "AdminUser", entityId: userId });
  }
}

/** Vérifie le code à 6 chiffres ; les échecs comptent dans le verrouillage. */
export async function checkTotp(userId: string, code: string, ip: string, now = new Date()): Promise<boolean> {
  if (!(await consumeRateLimit(rateKey("totp", ip), 10, 900, now))) return false;
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpSecret || (user.lockedUntil && user.lockedUntil > now)) return false;
  if (verifyTotp(decrypt(user.totpSecret), code)) {
    await prisma.adminUser.update({ where: { id: userId }, data: { failedLogins: 0, lastLoginAt: now } });
    return true;
  }
  await registerFailure(userId, user.failedLogins, now);
  return false;
}
