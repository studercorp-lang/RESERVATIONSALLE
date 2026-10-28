/**
 * Parcours de l'équipe : première connexion (double authentification + mot de passe),
 * confirmation d'une demande, blocage d'une journée, protections d'accès.
 */
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { authenticator } from "otplib";
import { ADMIN_FILE } from "./prepare";
import { lastMail, openDate } from "./helpers";

test.describe.configure({ mode: "serial" });

const EMAIL = "e2e-admin@example.com";
const NEW_PASSWORD = "Une phrase de passe solide 19";
let totpSecret = "";

async function login(page: Page) {
  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(EMAIL);
  await page.getByLabel("Mot de passe").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/admin\/connexion\/code$/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Code à 6 chiffres").fill(authenticator.generate(totpSecret));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("le back-office est inaccessible sans connexion", async ({ page }) => {
  await page.goto("/admin/reservations");
  await expect(page).toHaveURL(/\/admin\/connexion$/);
  const res = await page.request.post("/api/taches");
  expect(res.status()).toBe(401);
});

test("première connexion : double authentification puis choix du mot de passe", async ({ page }) => {
  const temporary = readFileSync(ADMIN_FILE, "utf8").trim();
  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(EMAIL);
  await page.getByLabel("Mot de passe").fill("mauvais mot de passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("E-mail ou mot de passe incorrect.");
  await expect(page.getByLabel("Adresse e-mail")).toHaveValue(EMAIL); // saisie conservée

  await page.getByLabel("Mot de passe").fill(temporary);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Activer la double authentification" })).toBeVisible();
  totpSecret = (await page.locator("code").innerText()).replace(/\s/g, "");
  await page.getByLabel("Code à 6 chiffres").fill(authenticator.generate(totpSecret));
  await page.getByRole("button", { name: "Activer" }).click();

  await expect(page.getByRole("heading", { name: "Choisissez votre mot de passe" })).toBeVisible();
  await page.getByLabel("Mot de passe actuel").fill(temporary);
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Confirmez le nouveau mot de passe").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Votre mot de passe a été modifié.")).toBeVisible();
});

test("confirmer une demande en attente prévient le client", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Réservations", exact: true }).click();
  await page.waitForURL(/\/admin\/reservations$/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Statut").selectOption({ label: "En attente" });
  await page.getByRole("button", { name: "Filtrer" }).click();
  await page.waitForURL(/statut=PENDING/);
  await page.locator("tbody a").first().click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Message au client (facultatif)").first().fill("Votre devis suit par e-mail.");
  await page.getByRole("button", { name: "Confirmer la réservation" }).click();
  await expect(page.getByRole("status")).toContainText("Réservation confirmée.");
  await expect(page.getByText("Confirmée par Admin E2E")).toBeVisible();
  expect(lastMail(/est confirmée/)).toContain("Votre devis suit par e-mail.");
});

test("bloquer une journée la retire du site public", async ({ page }) => {
  const day = openDate(30);
  await login(page);
  await page.getByRole("link", { name: "Salles et horaires" }).click();
  await page.getByRole("link", { name: "Modifier La Verrière" }).click();
  await page.waitForLoadState("networkidle"); // page entièrement chargée (formulaires actifs)
  await page.getByLabel("Du", { exact: true }).first().fill(day);
  await page.getByRole("button", { name: "Bloquer ces journées" }).click();
  await expect(page.getByRole("status")).toContainText("Blocage enregistré.");

  await page.goto(`/salles/la-verriere?date=${day}`);
  await expect(page.getByRole("region", { name: "Disponibilités" }).getByRole("listitem").first()).toContainText("Complet ou fermé");
});

test("l'export CSV des contacts fonctionne et ne se déclenche que sur clic", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Contacts" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exporter (CSV)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^contacts-quai19-.*\.csv$/);
});
