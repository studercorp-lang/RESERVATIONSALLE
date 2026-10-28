/** Connexion de l'équipe : mot de passe, verrouillage, double authentification. */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { authenticator } from "otplib";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/auth/crypto";
import { checkPassword, checkTotp, LOGIN_ERROR } from "@/lib/auth/login";
import { hashPassword, passwordSchema } from "@/lib/auth/password";

process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
let userId: string;
const secret = authenticator.generateSecret();
let ipCounter = 0;
const ip = () => `10.0.0.${++ipCounter}`; // une IP différente par essai : on teste le verrouillage du compte, pas la limite par IP

beforeEach(async () => {
  await prisma.rateLimit.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.adminSession.deleteMany();
  await prisma.adminUser.deleteMany();
  userId = (
    await prisma.adminUser.create({
      data: { email: "equipe@example.com", name: "Équipe", passwordHash: await hashPassword("phrase de passe 2026"), totpSecret: encrypt(secret), totpEnabled: true },
    })
  ).id;
});

afterAll(() => prisma.$disconnect());

describe("mot de passe", () => {
  it("accepte le bon mot de passe (e-mail insensible à la casse)", async () => {
    expect(await checkPassword(" Equipe@Example.com ", "phrase de passe 2026", ip())).toEqual({ ok: true, userId });
  });

  it("même message d'erreur pour un e-mail inconnu ou un mauvais mot de passe", async () => {
    expect(await checkPassword("inconnu@example.com", "x", ip())).toEqual({ ok: false, error: LOGIN_ERROR });
    expect(await checkPassword("equipe@example.com", "mauvais", ip())).toEqual({ ok: false, error: LOGIN_ERROR });
  });

  it("verrouille le compte 15 min après 5 échecs, même avec ensuite le bon mot de passe", async () => {
    for (let i = 0; i < 5; i++) await checkPassword("equipe@example.com", "mauvais", ip());
    const res = await checkPassword("equipe@example.com", "phrase de passe 2026", ip());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/verrouillé/);
    const later = new Date(Date.now() + 16 * 60_000);
    expect((await checkPassword("equipe@example.com", "phrase de passe 2026", ip(), later)).ok).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "admin.locked" } })).toBe(1);
  });

  it("limite à 10 tentatives par adresse IP sur 15 minutes", async () => {
    for (let i = 0; i < 10; i++) await checkPassword("inconnu@example.com", "x", "192.0.2.1");
    const res = await checkPassword("equipe@example.com", "phrase de passe 2026", "192.0.2.1");
    expect(res.ok).toBe(false);
  });

  it("refuse un compte désactivé", async () => {
    await prisma.adminUser.update({ where: { id: userId }, data: { active: false } });
    expect((await checkPassword("equipe@example.com", "phrase de passe 2026", ip())).ok).toBe(false);
  });

  it("politique de mot de passe : 12 caractères, lettres + autre chose", () => {
    expect(passwordSchema.safeParse("court1").success).toBe(false);
    expect(passwordSchema.safeParse("seulementdeslettres").success).toBe(false);
    expect(passwordSchema.safeParse("ma phrase de passe 19").success).toBe(true);
  });
});

describe("double authentification", () => {
  it("accepte le code courant, refuse un code faux", async () => {
    expect(await checkTotp(userId, authenticator.generate(secret), ip())).toBe(true);
    expect(await checkTotp(userId, "000000", ip())).toBe(false);
    expect(await checkTotp(userId, "abc", ip())).toBe(false);
  });

  it("le secret est chiffré en base et déchiffrable avec la clé", async () => {
    const stored = (await prisma.adminUser.findUniqueOrThrow({ where: { id: userId } })).totpSecret!;
    expect(stored).not.toContain(secret);
    expect(decrypt(stored)).toBe(secret);
  });
});
