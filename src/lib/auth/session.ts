/**
 * Sessions du back-office.
 * - Cookie httpOnly, Secure (en production), SameSite=Lax : inaccessible au JavaScript.
 * - Seule l'empreinte du jeton est en base ; une session peut être révoquée.
 * - Expiration : 30 min d'inactivité ou 12 h au maximum.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminRole, AdminSession, AdminUser } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createManageToken, hashToken } from "@/lib/security/tokens";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-q19_admin" : "q19_admin";
const IDLE_MS = 30 * 60_000;
const MAX_MS = 12 * 3_600_000;

export type StaffSession = AdminSession & { user: AdminUser };

export async function createSession(userId: string, now = new Date()): Promise<void> {
  const { token, hash } = createManageToken();
  await prisma.adminSession.create({ data: { tokenHash: hash, userId, expiresAt: new Date(now.getTime() + MAX_MS) } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_MS / 1000,
  });
}

/** Session valide (ou null). Prolonge la période d'inactivité. */
export async function currentSession(now = new Date()): Promise<StaffSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session) return null;
  const expired = session.expiresAt <= now || now.getTime() - session.lastSeenAt.getTime() > IDLE_MS || !session.user.active;
  if (expired) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
    await prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  return session;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/**
 * À appeler en tête de chaque page et action du back-office.
 * Redirige vers la connexion, la saisie du code ou l'activation de la double
 * authentification selon l'état de la session.
 */
export async function requireStaff(role?: AdminRole): Promise<StaffSession> {
  const session = await currentSession();
  if (!session) redirect("/admin/connexion");
  if (!session.user.totpEnabled) redirect("/admin/securite/activer-2fa");
  if (!session.totpPassed) redirect("/admin/connexion/code");
  if (session.user.mustChangePassword) redirect("/admin/securite/mot-de-passe");
  if (role === "ADMIN" && session.user.role !== "ADMIN") redirect("/admin?refus=droits");
  return session;
}

/** Libellé de l'auteur pour le journal d'audit (identifiant technique, pas de nom). */
export const actorLabel = (s: StaffSession) => `équipe:${s.user.id}`;
