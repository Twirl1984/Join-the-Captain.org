// E2E-Browsertests für /wetter (Playwright).
//
// VERTRAG an die UI: die /wetter-Seite setzt diese data-testid-Attribute:
//   [data-testid="revier-select"]      Revier-Dropdown (<select>)
//   [data-testid="wetter-map"]         Karten-Container (Klick → Wegpunkt)
//   [data-testid="waypoint-item"]      je gesetztem Wegpunkt ein Listeneintrag
//   [data-testid="risk-slider"]        Risiko-Schieberegler (<input type=range 0..1>)
//   [data-testid="calc-button"]        "Route berechnen"
//   [data-testid="result-panel"]       Ergebnis-Container
//   [data-testid="leg-card"]           je Leg eine Karte
//   [data-testid="warning-item"]       je Warnung eine Zeile
//   [data-testid="attribution"]        "Wetterdaten: Open-Meteo"
import { test, expect, type Page } from "@playwright/test";

// Leaflet lädt clientseitig (dynamic import) — erst klicken, wenn die Karte
// wirklich initialisiert ist, sonst treffen Klicks nur den Lade-Skeleton.
async function openWithMap(page: Page) {
  await page.goto("/wetter");
  await expect(page.getByTestId("wetter-map").locator(".leaflet-container")).toBeVisible();
}

// Zwei Wegpunkte über Kartenklicks setzen und warten, bis sie in der Liste sind.
async function addTwoWaypoints(page: Page) {
  const map = page.getByTestId("wetter-map");
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * 0.35, y: box.height * 0.35 } });
  await expect(page.getByTestId("waypoint-item")).toHaveCount(1);
  await map.click({ position: { x: box.width * 0.65, y: box.height * 0.65 } });
  await expect(page.getByTestId("waypoint-item")).toHaveCount(2);
}

// Berechnen und auf die API-Antwort warten (verhindert Race mit altem Ergebnis).
async function calculate(page: Page) {
  const resp = page.waitForResponse((r) => r.url().includes("/api/weather/route"));
  await page.getByTestId("calc-button").click();
  await resp;
}

test.describe("/wetter — Seite & Route", () => {
  test("Seite lädt mit Karte, Regler und Attribution", async ({ page }) => {
    await openWithMap(page);
    await expect(page.getByTestId("risk-slider")).toBeVisible();
    await expect(page.getByTestId("attribution")).toContainText(/open-meteo/i);
  });

  test("Revier wählen, zwei Wegpunkte setzen, Route berechnen → Legs erscheinen", async ({ page }) => {
    await openWithMap(page);
    await page.getByTestId("revier-select").selectOption({ index: 0 });
    await addTwoWaypoints(page);
    await calculate(page);
    await expect(page.getByTestId("result-panel")).toBeVisible();
    await expect(page.getByTestId("leg-card").first()).toBeVisible();
  });

  test("Risiko-Regler ↑ erhöht (oder hält) die Warnungszahl (Monotonie)", async ({ page }) => {
    await openWithMap(page);
    await addTwoWaypoints(page);

    const slider = page.getByTestId("risk-slider");
    await slider.fill("0");
    await calculate(page);
    await expect(page.getByTestId("result-panel")).toBeVisible();
    const low = await page.getByTestId("warning-item").count();

    await slider.fill("1");
    await calculate(page);
    await expect(page.getByTestId("result-panel")).toBeVisible();
    const high = await page.getByTestId("warning-item").count();

    expect(high).toBeGreaterThanOrEqual(low);
  });
});

test.describe("/wetter — Robustheit", () => {
  test("API-502 zeigt freundliche Fehlermeldung statt Absturz", async ({ page }) => {
    await page.route("**/api/weather/route", (r) =>
      r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "down" }) }),
    );
    await openWithMap(page);
    await addTwoWaypoints(page);
    await page.getByTestId("calc-button").click();
    await expect(page.getByText(/nicht verfügbar|später|Fehler/i)).toBeVisible();
  });
});
