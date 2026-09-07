import { expect, test } from "@playwright/test";

test.describe("surface publique déployée", () => {
  test("affiche la barrière d'accès sans exposer l'expérience", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Où est Ava ?" })).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: "Entrer dans l’expérience" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Commencer" })).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("rend la page de confidentialité accessible sans authentification", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto("/confidentialite", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Confidentialité et données" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à l’expérience" })).toHaveAttribute("href", "/");
    expect(pageErrors).toEqual([]);
  });
});
