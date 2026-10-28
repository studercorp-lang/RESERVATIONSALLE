/**
 * Gestion des comptes de l'équipe (réservée aux administrateurs).
 * Garde-fous : on ne peut ni se désactiver soi-même, ni retirer le dernier administrateur.
 */
import { randomBytes } from "node:crypto";
import { AdminRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/log";
import { hashPassword } from "@/lib/auth/password";
import type { Actor } from "./bookings";

export type TeamResult = { ok: true; temporaryPassword?: string } | { ok: false; error: string };

/** Mot de passe provisoire robuste, à changer à la première connexion. */
export const temporaryPassword = () => `${randomBytes(12).toString("base64url")}-7`;

const newMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide.")),
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
  role: z.enum(AdminRole),
});

export async function createStaff(actor: Actor, raw: unknown): Promise<TeamResult> {
  const parsed = newMemberSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (await prisma.adminUser.findUnique({ where: { email: parsed.data.email } })) return { ok: false, error: "Un compte existe déjà avec cette adresse." };
  const password = temporaryPassword();
  const user = await prisma.adminUser.create({ data: { ...parsed.data, passwordHash: await hashPassword(password), mustChangePassword: true } });
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "admin.create", entityType: "AdminUser", entityId: user.id, details: { role: user.role } });
  return { ok: true, temporaryPassword: password };
}

async function activeAdminsExcept(userId: string) {
  return prisma.adminUser.count({ where: { role: AdminRole.ADMIN, active: true, id: { not: userId } } });
}

export async function setActive(actor: Actor, userId: string, active: boolean): Promise<TeamResult> {
  if (userId === actor.id && !active) return { ok: false, error: "Vous ne pouvez pas désactiver votre propre compte." };
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: userId } });
  if (!active && user.role === AdminRole.ADMIN && (await activeAdminsExcept(userId)) === 0) return { ok: false, error: "Impossible : c'est le dernier administrateur actif." };
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: userId }, data: { active } }),
    ...(active ? [] : [prisma.adminSession.deleteMany({ where: { userId } })]), // déconnexion immédiate
  ]);
  await audit({ actorId: actor.id, actorLabel: actor.label, action: active ? "admin.activate" : "admin.deactivate", entityType: "AdminUser", entityId: userId });
  return { ok: true };
}

export async function setRole(actor: Actor, userId: string, role: AdminRole): Promise<TeamResult> {
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === AdminRole.ADMIN && role !== AdminRole.ADMIN && (await activeAdminsExcept(userId)) === 0) {
    return { ok: false, error: "Impossible : il doit rester au moins un administrateur." };
  }
  await prisma.adminUser.update({ where: { id: userId }, data: { role } });
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "admin.role", entityType: "AdminUser", entityId: userId, details: { role } });
  return { ok: true };
}

/** Nouveau mot de passe provisoire (ex. mot de passe oublié) ; ferme les sessions ouvertes. */
export async function resetPassword(actor: Actor, userId: string): Promise<TeamResult> {
  const password = temporaryPassword();
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), mustChangePassword: true, failedLogins: 0, lockedUntil: null } }),
    prisma.adminSession.deleteMany({ where: { userId } }),
  ]);
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "admin.password.reset", entityType: "AdminUser", entityId: userId });
  return { ok: true, temporaryPassword: password };
}

/** Réinitialise la double authentification (ex. téléphone perdu) : à reconfigurer à la prochaine connexion. */
export async function resetTotp(actor: Actor, userId: string): Promise<TeamResult> {
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null } }),
    prisma.adminSession.deleteMany({ where: { userId } }),
  ]);
  await audit({ actorId: actor.id, actorLabel: actor.label, action: "admin.2fa.reset", entityType: "AdminUser", entityId: userId });
  return { ok: true };
}
