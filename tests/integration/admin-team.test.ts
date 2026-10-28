/** Gestion de l'équipe : création, garde-fous, réinitialisations. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createStaff, resetPassword, resetTotp, setActive, setRole } from "@/lib/admin/team";
import { checkPassword } from "@/lib/auth/login";

const admin = { id: "", label: "équipe:admin" };

beforeEach(async () => {
  await prisma.rateLimit.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.adminSession.deleteMany();
  await prisma.adminUser.deleteMany();
  admin.id = (await prisma.adminUser.create({ data: { email: "admin@example.com", name: "Admin", passwordHash: "x", role: "ADMIN" } })).id;
});

afterAll(() => prisma.$disconnect());

describe("équipe", () => {
  it("crée un gestionnaire avec mot de passe provisoire utilisable et à changer", async () => {
    const r = await createStaff(admin, { email: "Gestion@Example.com", name: "Gestion", role: "MANAGER" });
    expect(r.ok && r.temporaryPassword).toBeTruthy();
    const u = await prisma.adminUser.findUniqueOrThrow({ where: { email: "gestion@example.com" } });
    expect([u.role, u.mustChangePassword, u.totpEnabled]).toEqual(["MANAGER", true, false]);
    expect((await checkPassword("gestion@example.com", r.ok ? r.temporaryPassword! : "", "10.1.1.1")).ok).toBe(true);
  });

  it("refuse un doublon d'e-mail", async () => {
    expect((await createStaff(admin, { email: "admin@example.com", name: "X", role: "MANAGER" })).ok).toBe(false);
  });

  it("garde-fous : pas d'auto-désactivation, toujours un administrateur", async () => {
    expect((await setActive(admin, admin.id, false)).ok).toBe(false);
    expect((await setRole(admin, admin.id, "MANAGER")).ok).toBe(false);
    const other = await prisma.adminUser.create({ data: { email: "b@example.com", name: "B", passwordHash: "x", role: "ADMIN" } });
    expect((await setRole(admin, admin.id, "MANAGER")).ok).toBe(true);
    expect((await setActive({ id: other.id, label: "x" }, admin.id, false)).ok).toBe(true);
  });

  it("désactiver ou réinitialiser déconnecte immédiatement", async () => {
    const u = await prisma.adminUser.create({ data: { email: "c@example.com", name: "C", passwordHash: "x", totpEnabled: true, totpSecret: "s" } });
    const session = () => prisma.adminSession.create({ data: { tokenHash: Math.random().toString(), userId: u.id, expiresAt: new Date(Date.now() + 3_600_000) } });
    await session();
    await resetTotp(admin, u.id);
    expect(await prisma.adminSession.count({ where: { userId: u.id } })).toBe(0);
    expect((await prisma.adminUser.findUniqueOrThrow({ where: { id: u.id } })).totpEnabled).toBe(false);
    await session();
    const r = await resetPassword(admin, u.id);
    expect(r.ok && r.temporaryPassword).toBeTruthy();
    expect(await prisma.adminSession.count({ where: { userId: u.id } })).toBe(0);
    await session();
    await setActive(admin, u.id, false);
    expect(await prisma.adminSession.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: u.id } })).toBe(3);
  });
});
