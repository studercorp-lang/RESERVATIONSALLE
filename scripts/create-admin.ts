/**
 * Création d'un compte de l'équipe (à utiliser pour le PREMIER administrateur ;
 * les suivants se créent ensuite depuis le back-office, rubrique « Équipe »).
 *
 * Utilisation :
 *   npm run admin:create -- --email prenom@quai19.fr --nom "Prénom Nom" --role admin
 *
 * Un mot de passe provisoire est affiché UNE SEULE FOIS : il devra être changé à
 * la première connexion, en même temps que l'activation de la double authentification.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const { values } = parseArgs({
  options: { email: { type: "string" }, nom: { type: "string" }, role: { type: "string", default: "admin" } },
});

async function main() {
  const email = values.email?.trim().toLowerCase();
  const name = values.nom?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    console.error('Usage : npm run admin:create -- --email prenom@quai19.fr --nom "Prénom Nom" [--role admin|gestionnaire]');
    process.exit(1);
  }
  const role = values.role === "gestionnaire" ? "MANAGER" : "ADMIN";
  const prisma = new PrismaClient();
  if (await prisma.adminUser.findUnique({ where: { email } })) {
    console.error(`Un compte existe déjà pour ${email}.`);
    process.exit(1);
  }
  const temporary = `${randomBytes(12).toString("base64url")}-7`;
  await prisma.adminUser.create({ data: { email, name, role, passwordHash: await hash(temporary), mustChangePassword: true } });
  await prisma.auditLog.create({ data: { actorLabel: "script admin:create", action: "admin.create", entityType: "AdminUser", details: { role } } });
  console.log(`\n✔ Compte ${role === "ADMIN" ? "administrateur" : "gestionnaire"} créé pour ${email}`);
  console.log(`  Mot de passe provisoire (à noter, il ne sera plus affiché) : ${temporary}`);
  console.log("  Connectez-vous sur /admin : vous activerez la double authentification puis choisirez votre mot de passe.\n");
  await prisma.$disconnect();
}

main();
