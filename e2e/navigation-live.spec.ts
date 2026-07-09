// LIVE-E2E für /navigation — bewusst UNGEMOCKTE APIs (echtes Open-Meteo/EMODnet):
// der End-to-End-Vertrag der konsolidierten App (Navigation & Wetter, REQ-NAV-016).
// Nur externe Karten-Tiles werden geblockt (Stabilität). Ersetzt e2e/wetter.spec.ts.
import { test, expect, type Page } from "@playwright/test";

async function openLive(page: Page) {
  await page.route(/openstreetmap|openseamap|emodnet|opentopodata/, (r) => r.abort());
  await page.addInitScript(() => localStorage.setItem("jtc-nav-disclaimer-v1", "1"));
  await page.goto("/navigation");
  await expect(page.getByTestId("nav-map").locator(".leaflet-container")).toBeVisible();
}

async function addTwoWaypoints(page: Page) {
  const map = page.getByTestId("nav-map");
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * 0.35, y: box.height * 0.4 } });
  await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(1);
  await map.click({ position: { x: box.width * 0.65, y: box.height * 0.6 } });
  await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(2);
}

async function calcLive(page: Page) {
  const resp = page.waitForResponse((r) => r.url().includes("/api/navigation/route"), { timeout: 45000 });
  await page.getByTestId("nav-calc").click();
  await resp;
  await expect(page.getByTestId("nav-result")).toBeVisible({ timeout: 20000 });
}

test.describe("/navigation — Live-Verträge (eine App)", () => {
  test("[REQ-SAFE-002] Seite lädt mit Karte, Regler und Attribution", async ({ page }) => {
    await openLive(page);
    await expect(page.getByTestId("risk-slider")).toBeVisible();
    await expect(page.getByTestId("nav-attribution")).toContainText(/open-meteo/i);
  });

  test("[REQ-WET-001] [REQ-NAV-001] Route live berechnen → Legs erscheinen", async ({ page }) => {
    await openLive(page);
    await addTwoWaypoints(page);
    await calcLive(page);
    await expect(page.getByTestId("nav-leg").first()).toBeVisible();
  });

  test("[REQ-WET-002] [REQ-NAV-015] Regler ↑ erhöht (oder hält) die Warnungszahl", async ({ page }) => {
    await openLive(page);
    await addTwoWaypoints(page);
    const slider = page.getByTestId("risk-slider");
    await slider.fill("0");
    await calcLive(page);
    const low = await page.getByTestId("nav-warning-item").count();
    await slider.fill("1");
    await calcLive(page);
    const high = await page.getByTestId("nav-warning-item").count();
    expect(high).toBeGreaterThanOrEqual(low);
  });

  test("[REQ-WET-011] Modell-Wahl zeigt eine Begründung", async ({ page }) => {
    await openLive(page);
    await page.getByTestId("model-select").selectOption("icon_seamless");
    await expect(page.getByTestId("model-reason")).toContainText(/ICON|Ostsee/);
  });

  test("[REQ-WET-012] Feedback-Flow inkl. Abweichungs-Chips und Kontakt (API gemockt)", async ({ page }) => {
    await page.route("**/api/weather/feedback", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
    );
    await openLive(page);
    await addTwoWaypoints(page);
    await calcLive(page);
    await expect(page.getByTestId("feedback-card")).toBeVisible();
    await page.getByTestId("feedback-not-ok").click();
    await expect(page.getByTestId("feedback-issues")).toBeVisible();
    await page.getByTestId("feedback-issues").getByText("Wind stärker als vorhergesagt").click();
    await page.getByTestId("feedback-star-4").click();
    await page.getByTestId("feedback-text").fill("Live-Vertragstest.");
    await page.getByTestId("feedback-name").fill("Kai");
    await page.getByTestId("feedback-email").fill("kai@example.com");
    await page.getByTestId("feedback-submit").click();
    await expect(page.getByTestId("feedback-thanks")).toBeVisible();
  });

  test("[REQ-NAV-016] /wetter leitet dauerhaft auf /navigation um", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("jtc-nav-disclaimer-v1", "1"));
    await page.goto("/wetter");
    await expect(page).toHaveURL(/\/navigation$/);
  });
});
