// E2E-Browsertests für /wetter (Playwright).
//
// VERTRAG an die UI-Session: die /wetter-Seite muss die hier referenzierten
// data-testid-Attribute setzen, damit diese Tests stabil greifen:
//   [data-testid="revier-select"]      Revier-Dropdown (<select>)
//   [data-testid="wetter-map"]         Karten-Container (klickbar → Wegpunkt)
//   [data-testid="waypoint-item"]      je gesetztem Wegpunkt ein Listeneintrag
//   [data-testid="risk-slider"]        Risiko-Schieberegler (<input type=range 0..1>)
//   [data-testid="calc-button"]        "Route berechnen"
//   [data-testid="result-panel"]       Ergebnis-Container
//   [data-testid="leg-card"]           je Leg eine Karte
//   [data-testid="warning-item"]       je Warnung eine Zeile
//   [data-testid="attribution"]        "Wetterdaten: Open-Meteo"
//
// Bis die UI existiert, schlägt der Smoke-Test bewusst fehl (roter Faden für die
// Fertigstellung). Danach greifen alle Fälle ohne Änderung.
import { test, expect } from "@playwright/test";

test.describe("/wetter — Seite & Route", () => {
  test("Seite lädt mit Karte, Regler und Attribution", async ({ page }) => {
    await page.goto("/wetter");
    await expect(page.getByTestId("wetter-map")).toBeVisible();
    await expect(page.getByTestId("risk-slider")).toBeVisible();
    await expect(page.getByTestId("attribution")).toContainText(/open-meteo/i);
  });

  test("Revier wählen, zwei Wegpunkte setzen, Route berechnen → Legs erscheinen", async ({ page }) => {
    await page.goto("/wetter");
    await page.getByTestId("revier-select").selectOption({ index: 0 });
    const map = page.getByTestId("wetter-map");
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.35, y: box.height * 0.4 } });
    await map.click({ position: { x: box.width * 0.6, y: box.height * 0.65 } });
    await expect(page.getByTestId("waypoint-item")).toHaveCount(2);
    await page.getByTestId("calc-button").click();
    await expect(page.getByTestId("result-panel")).toBeVisible();
    await expect(page.getByTestId("leg-card").first()).toBeVisible();
  });

  test("Risiko-Regler ↑ erhöht (oder hält) die Warnungszahl (Monotonie)", async ({ page }) => {
    await page.goto("/wetter");
    await page.getByTestId("revier-select").selectOption({ index: 0 });
    const map = page.getByTestId("wetter-map");
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.3, y: box.height * 0.3 } });
    await map.click({ position: { x: box.width * 0.7, y: box.height * 0.7 } });

    const slider = page.getByTestId("risk-slider");
    await slider.fill("0");
    await page.getByTestId("calc-button").click();
    await expect(page.getByTestId("result-panel")).toBeVisible();
    const low = await page.getByTestId("warning-item").count();

    await slider.fill("1");
    await page.getByTestId("calc-button").click();
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
    await page.goto("/wetter");
    await page.getByTestId("revier-select").selectOption({ index: 0 });
    const map = page.getByTestId("wetter-map");
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.4, y: box.height * 0.4 } });
    await map.click({ position: { x: box.width * 0.6, y: box.height * 0.6 } });
    await page.getByTestId("calc-button").click();
    await expect(page.getByText(/nicht verfügbar|später|Fehler/i)).toBeVisible();
  });
});
