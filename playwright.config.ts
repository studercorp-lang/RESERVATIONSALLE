/**
 * Tests de bout en bout : un vrai navigateur parcourt l'application comme un
 * client et comme un membre de l'équipe. Lancement : npm run test:e2e
 *
 * Ils utilisent une base de données dédiée (DATABASE_URL_E2E), remise à zéro et
 * remplie avec les données de démonstration à chaque lancement (tests/e2e/prepare.ts).
 */
import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = 3100;
export const E2E_OUTBOX = path.join(__dirname, ".outbox-e2e");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // une seule base de données partagée
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, locale: "fr-FR", timezoneId: "Europe/Paris", trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /client\.spec\.ts/ },
    { name: "ordinateur", use: { ...devices["Desktop Chrome"] }, testMatch: /admin\.spec\.ts/ },
  ],
  webServer: {
    // 1. prépare la base de test, 2. compile, 3. démarre le serveur
    command: `npx tsx tests/e2e/prepare.ts && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_E2E ?? "",
      APP_URL: `http://localhost:${PORT}`,
      OUTBOX_DIR: E2E_OUTBOX,
      SMTP_HOST: "",
      EMAIL_TEAM: "equipe@example.com",
    },
  },
});
