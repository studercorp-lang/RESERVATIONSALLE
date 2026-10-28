"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/log";
import { decrypt } from "@/lib/auth/crypto";
import { checkPassword, checkTotp } from "@/lib/auth/login";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { actorLabel, createSession, currentSession, destroySession } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { clientIp } from "@/lib/security/rate-limit";

export type FormState = { error?: string } | null;

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const result = await checkPassword(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""), await clientIp());
  if (!result.ok) return { error: result.error };
  await createSession(result.userId);
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: result.userId } });
  redirect(user.totpEnabled ? "/admin/connexion/code" : "/admin/securite/activer-2fa");
}

export async function totpAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await currentSession();
  if (!session) redirect("/admin/connexion");
  if (!(await checkTotp(session.userId, String(fd.get("code") ?? ""), await clientIp()))) {
    return { error: "Code incorrect ou expiré. Vérifiez l'heure de votre téléphone et réessayez." };
  }
  await prisma.adminSession.update({ where: { id: session.id }, data: { totpPassed: true } });
  await audit({ actorId: session.userId, actorLabel: actorLabel(session), action: "admin.login", entityType: "AdminUser", entityId: session.userId });
  redirect("/admin");
}

/** Active la double authentification : le code saisi prouve que l'application est bien configurée. */
export async function enableTotpAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await currentSession();
  if (!session) redirect("/admin/connexion");
  const user = session.user;
  if (user.totpEnabled || !user.totpSecret) redirect("/admin");
  if (!verifyTotp(decrypt(user.totpSecret), String(fd.get("code") ?? ""))) {
    return { error: "Code incorrect. Scannez à nouveau le QR code et saisissez le code affiché." };
  }
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: user.id }, data: { totpEnabled: true, lastLoginAt: new Date() } }),
    prisma.adminSession.update({ where: { id: session.id }, data: { totpPassed: true } }),
  ]);
  await audit({ actorId: user.id, actorLabel: actorLabel(session), action: "admin.2fa.enable", entityType: "AdminUser", entityId: user.id });
  redirect(user.mustChangePassword ? "/admin/securite/mot-de-passe" : "/admin");
}

export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await currentSession();
  if (!session || !session.totpPassed) redirect("/admin/connexion");
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (!(await verifyPassword(session.user.passwordHash, current))) return { error: "Le mot de passe actuel est incorrect." };
  if (next !== String(fd.get("confirm") ?? "")) return { error: "Les deux nouveaux mots de passe ne correspondent pas." };
  if (next === current) return { error: "Choisissez un mot de passe différent de l'actuel." };
  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: session.userId }, data: { passwordHash: await hashPassword(next), mustChangePassword: false } }),
    // Toutes les autres sessions de ce compte sont fermées
    prisma.adminSession.deleteMany({ where: { userId: session.userId, id: { not: session.id } } }),
  ]);
  await audit({ actorId: session.userId, actorLabel: actorLabel(session), action: "admin.password.change", entityType: "AdminUser", entityId: session.userId });
  redirect("/admin?ok=mot-de-passe");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/connexion");
}
