/**
 * Prépare la base de test de bout en bout, juste avant le démarrage du serveur :
 * migrations, base vidée, données de démonstration, compte administrateur.
 * Lancé par la commande `webServer` de playwright.config.ts (DATABASE_URL = base e2e).
 */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ADMIN_FILE = path.join(__dirname, "..", "..", ".outbox-e2e", "admin.txt");

function main() {
  const run = (cmd: string) => execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString();
  run("npx prisma migrate deploy");
  run("npx tsx tests/e2e/reset-db.ts"); // refuse toute base qui n'est pas « …e2e »
  run("npx prisma db seed");
  const out = run('npx tsx scripts/create-admin.ts --email e2e-admin@example.com --nom "Admin E2E"');
  const password = /provisoire[^:]*: (\S+)/.exec(out)?.[1];
  if (!password) throw new Error("Création du compte administrateur de test impossible");
  rmSync(path.dirname(ADMIN_FILE), { recursive: true, force: true });
  mkdirSync(path.dirname(ADMIN_FILE), { recursive: true });
  writeFileSync(ADMIN_FILE, password);
}

if (require.main === module) main();
