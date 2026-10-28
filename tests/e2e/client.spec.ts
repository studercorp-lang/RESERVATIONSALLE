/**
 * Parcours client sur téléphone : choisir → renseigner → confirmer,
 * puis gérer sa réservation avec le lien reçu par e-mail.
 */
import { expect, test } from "@playwright/test";
import { lastMail, manageLink, openDate } from "./helpers";

test.describe.configure({ mode: "serial" });

const date = openDate(14);

test("recherche, demande de réservation, confirmation et e-mail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Réservez votre salle");

  // 1. Choisir
  await page.getByLabel("Date").fill(date);
  await page.getByLabel("Heure de début").selectOption({ label: "20h00" });
  await page.getByLabel("Heure de fin").selectOption({ label: "02h00 (lendemain)" });
  await page.getByLabel("Nombre de personnes").fill("10");
  await page.getByRole("button", { name: "Voir les salles disponibles" }).click();
  await expect(page.locator("#resultats")).toContainText("3 salles disponibles");
  await page.getByRole("link", { name: "Choisir L'Atelier" }).click();

  // 2. Renseigner : erreurs claires à côté des champs
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();
  await expect(page.getByText("Le nom est obligatoire.")).toBeVisible();
  await expect(page.getByText("Vous devez accepter les conditions de réservation.")).toBeVisible();
  await expect(page.getByLabel(/^Nom/)).toBeFocused();

  await page.getByLabel(/^Nom/).fill("Durand");
  await page.getByLabel(/^Prénom/).fill("Sam");
  await page.getByLabel(/^Adresse e-mail/).fill("sam.durand@example.com");
  await page.getByLabel(/^Téléphone/).fill("06 12 34 56 78");
  await page.getByLabel(/Commentaire/).fill("Soirée d'équipe");
  await page.getByLabel(/J'accepte les conditions/).check();
  await expect(page.getByLabel(/informations commerciales/)).not.toBeChecked(); // jamais pré-cochée
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();

  // 3. Confirmer
  await expect(page.getByRole("heading", { name: "Votre demande a bien été envoyée" })).toBeFocused();
  await expect(page.locator("dl")).toContainText("de 20h00 à 02h00 le lendemain");

  const mail = lastMail(/Nous avons bien reçu votre demande/);
  expect(mail).toContain("sam.durand@example.com");
  expect(manageLink(mail)).toBeTruthy();
});

test("le même créneau n'est plus proposé à un autre client", async ({ page }) => {
  await page.goto(`/recherche?date=${date}&debut=1260&fin=1440&personnes=5`);
  await expect(page.locator("#resultats")).toContainText("2 salles disponibles");
  await page.goto(`/reserver?salle=l-atelier&date=${date}&debut=1260&fin=1440&personnes=5`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("n'est pas disponible");
});

test("un début après 22h est refusé avec une explication", async ({ page }) => {
  await page.goto(`/recherche?date=${date}&debut=1350&fin=1560&personnes=5`);
  await expect(page.getByText("Nos salles peuvent être réservées avec un début entre")).toBeVisible();
});

test("lien de gestion : modifier puis annuler sans frais", async ({ page }) => {
  const link = manageLink(lastMail(/Nous avons bien reçu votre demande/))!;
  await page.goto(link);
  await expect(page.getByText("Demande en cours d'étude")).toBeVisible();

  await page.locator("#mod-debut").selectOption({ label: "19h00" });
  await page.getByRole("button", { name: "Modifier ma demande" }).click();
  await expect(page.getByRole("status")).toContainText("Votre demande a été modifiée");
  await expect(page.locator("dl")).toContainText("de 19h00 à 02h00 le lendemain");

  await page.getByRole("button", { name: "Annuler ma réservation" }).click();
  await expect(page.getByText("sans frais", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Oui, annuler" }).click();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();
  expect(lastMail(/Annulation de votre réservation/)).toContain("sans frais");
});

test("un lien inventé ne donne accès à rien", async ({ page }) => {
  await page.goto(`/reservation/${"A".repeat(43)}`);
  await expect(page.getByRole("heading", { name: "Lien invalide ou expiré" })).toBeVisible();
});

test("pages légales accessibles depuis le pied de page", async ({ page }) => {
  for (const [name, url, title] of [
    ["Mentions légales", "/mentions-legales", "Mentions légales"],
    ["Politique de confidentialité", "/confidentialite", "Politique de confidentialité"],
    ["Conditions de réservation", "/conditions-reservation", "Conditions de réservation"],
  ]) {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  }
});
