import { expect, test, type Page, type Route } from "@playwright/test";

const PROJECT_ID = "iralfqlslqndgvexixis";
const SUPABASE_ORIGIN = `https://${PROJECT_ID}.supabase.co`;
const INVITATION_ID = "44444444-4444-4444-8444-444444444444";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  });
}

async function installInvitationFakes(page: Page) {
  let activated = false;
  let statusCalls = 0;
  await page.route(`${SUPABASE_ORIGIN}/auth/v1/signup`, (route) => json(route, {
    access_token: "external-test-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "external-test-refresh-token",
    user: {
      id: "33333333-3333-4333-8333-333333333333",
      aud: "authenticated",
      role: "authenticated",
      is_anonymous: true,
      app_metadata: { provider: "anonymous", providers: ["anonymous"] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  }));
  await page.route(`${SUPABASE_ORIGIN}/functions/v1/redeem-test-invitation`, (route) => {
    const body = route.request().postDataJSON() as { action?: string; code?: string };
    const access = {
      invitationId: INVITATION_ID,
      environmentId: "sandbox-benoit",
      testerLabel: "Camille",
      creatorDisplayName: "Benoît",
      accessExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    };
    if (body.action === "status") {
      statusCalls += 1;
      return json(route, activated ? { ok: true, access } : { ok: false });
    }
    if (body.code?.toUpperCase() === "AVA-ABCD-EFGH-2345-JKMN") {
      activated = true;
      return json(route, { ok: true, access });
    }
    return json(route, { ok: false });
  });
  await page.route(`${SUPABASE_ORIGIN}/rest/v1/**`, (route) => json(route, []));
  return { getStatusCalls: () => statusCalls };
}

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

  test("active une invitation sandbox puis la retrouve après rechargement", async ({ page }) => {
    const fake = await installInvitationFakes(page);
    await page.goto(`/test/${INVITATION_ID}`, { waitUntil: "domcontentloaded" });

    const codeInput = page.getByLabel("Mot de passe unique");
    await expect(codeInput).toBeVisible();
    await codeInput.fill("AVA-ABCD-EFGH-2345-JKMN");
    await page.getByRole("button", { name: "Entrer dans l’expérience" }).click();
    await expect(page.getByRole("button", { name: "Commencer" })).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Commencer" })).toBeVisible();
    await expect(codeInput).toHaveCount(0);
    expect(fake.getStatusCalls()).toBeGreaterThanOrEqual(2);
  });
});
