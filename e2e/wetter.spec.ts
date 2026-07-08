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

  test("[REQ-WET-002] Risiko-Regler ↑ erhöht (oder hält) die Warnungszahl (Monotonie)", async ({ page }) => {
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

test.describe("/wetter — Abfahrts-Empfehlung & Boot", () => {
  test("Abfahrts-Scan liefert Slots mit einer Empfehlung", async ({ page }) => {
    await openWithMap(page);
    await addTwoWaypoints(page);
    const resp = page.waitForResponse((r) => r.url().includes("/api/weather/departure"));
    await page.getByTestId("departure-scan-button").click();
    await resp;
    await expect(page.getByTestId("departure-result")).toBeVisible();
    // genau ein empfohlener + weitere Slots (3-h-Raster über ~2 Tage)
    await expect(page.getByTestId("departure-recommended")).toHaveCount(1);
    expect(await page.getByTestId("departure-slot").count()).toBeGreaterThanOrEqual(3);
  });

  test("Boots-Preset Jolle übernimmt Parameter (ohne Motor, min/max Wind)", async ({ page }) => {
    await page.goto("/wetter");
    await page.locator(".wetter-details summary").click();
    await page.getByTestId("boat-preset-jolle").click();
    await expect(page.getByTestId("boat-derived")).toContainText(/ohne Motor/);
    await expect(page.getByTestId("boat-derived")).toContainText(/min 4 kn/);
    await expect(page.getByTestId("boat-noengine")).toBeChecked();
    await expect(page.getByTestId("boat-minwind")).toHaveValue("4");
    await expect(page.getByTestId("boat-maxwind")).toHaveValue("16");
  });

  test("Bootsdaten ändern die abgeleiteten Geschwindigkeiten", async ({ page }) => {
    await page.goto("/wetter");
    await page.locator(".wetter-details summary").click();
    const derived = page.getByTestId("boat-derived");
    const before = await derived.textContent();
    await page.getByTestId("boat-lwl").fill("12");
    await page.getByTestId("boat-disp").fill("10");
    await page.getByTestId("boat-hp").fill("15");
    const after = await derived.textContent();
    expect(after).not.toBe(before);
  });
});

test.describe("/wetter — Playback & Feedback", () => {
  test("Nach der Berechnung erscheint das Playback und der Slider bewegt die Zeit", async ({ page }) => {
    await openWithMap(page);
    await addTwoWaypoints(page);
    const timeline = page.waitForResponse((r) => r.url().includes("/api/weather/timeline"));
    await calculate(page);
    await timeline;
    await expect(page.getByTestId("playback-panel")).toBeVisible();
    const t0 = await page.getByTestId("playback-time").textContent();
    const slider = page.getByTestId("playback-slider");
    await slider.fill((await slider.getAttribute("max"))!); // letzter Zeitschritt
    const t1 = await page.getByTestId("playback-time").textContent();
    expect(t1).not.toBe(t0);
    // Wetter-Symbole liegen auf der Karte
    expect(await page.locator(".wx-marker").count()).toBeGreaterThanOrEqual(2);
  });

  test("[REQ-WET-012] Feedback lässt sich absenden (API gemockt) → Danke-Zustand", async ({ page }) => {
    await page.route("**/api/weather/feedback", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
    );
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calculate(page);
    await expect(page.getByTestId("feedback-card")).toBeVisible();
    // 👎 öffnet strukturierte Abweichungs-Chips
    await page.getByTestId("feedback-not-ok").click();
    await expect(page.getByTestId("feedback-issues")).toBeVisible();
    await page.getByTestId("feedback-issues").getByText("Wind stärker als vorhergesagt").click();
    await page.getByTestId("feedback-ok").click(); // zurück auf 👍 (Chips verschwinden)
    await expect(page.getByTestId("feedback-issues")).toHaveCount(0);
    await page.getByTestId("feedback-star-4").click();
    await page.getByTestId("feedback-text").fill("Passt — gerne noch Strömung dazu.");
    await page.getByTestId("feedback-name").fill("Kai Testskipper");
    await page.getByTestId("feedback-email").fill("kai@example.com");
    await page.getByTestId("feedback-submit").click();
    await expect(page.getByTestId("feedback-thanks")).toBeVisible();
  });

  test("Brombachsee ist als Revier wählbar und zeigt Häfen", async ({ page }) => {
    await openWithMap(page);
    await page.getByTestId("revier-select").selectOption("brombachsee");
    // Hafen-Marker des Sees erscheinen auf der Karte
    await expect(page.locator(".hafen-marker").first()).toBeVisible();
    expect(await page.locator(".hafen-marker").count()).toBeGreaterThanOrEqual(3);
  });

  test("[REQ-WET-011] Modell-Wahl zeigt eine Begründung", async ({ page }) => {
    await page.goto("/wetter");
    await page.getByTestId("model-select").selectOption("icon_seamless");
    await expect(page.getByTestId("model-reason")).toContainText(/ICON|Ostsee/);
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
