// E2E-Browsertests für /navigation (Playwright).
//
// Alle Backend- und Karten-Anfragen sind GEMOCKT — die Tests laufen offline,
// deterministisch und decken auch Fehlerpfade (422/502, GPS verweigert) ab.
// Die Geolocation kommt aus dem Playwright-Context (setGeolocation).
//
// VERTRAG an die UI (data-testid): nav-revier-select, nav-revier-search,
// nav-search-hits, nav-map, nav-depth-toggle, nav-waypoint-item, nav-calc,
// nav-result, nav-eta, nav-routing-hinweis, nav-error, nav-gps-start,
// nav-gps-status, nav-start-at-gps, nav-live-badge, nav-depth-check,
// nav-depth-warning, nav-playback-panel, nav-playback-slider, nav-attribution.

import { test, expect, type Page } from "@playwright/test";

// ── Mocks ────────────────────────────────────────────────────────────────────

/** Externe Karten-Tiles blocken: offline-stabil und schnell. */
async function blockTiles(page: Page) {
  await page.route(/openstreetmap|openseamap|emodnet|opentopodata/, (r) => r.abort());
}

interface MockOpts {
  luftlinie?: boolean;
  warnings?: string[];
}

/** Antwort von POST /api/navigation/route mit einem Zwischenpunkt (Umweg). */
function routeResponse(opts: MockOpts = {}) {
  const depart = new Date(Date.now() + 3600e3).toISOString();
  const eta1 = new Date(Date.now() + 4 * 3600e3).toISOString();
  const eta2 = new Date(Date.now() + 7 * 3600e3).toISOString();
  const leg = (n: number, from: string, to: string, eta: string, dep: string) => ({
    leg: n,
    from,
    to,
    distance_nm: 12.4,
    course_deg: 90,
    mode: "sail",
    speed_kn: 5.2,
    sog_kn: 5.6,
    current_kn: 0.4,
    current_to_deg: 80,
    wind_kn: 12,
    gust_kn: 18,
    wind_from_deg: 250,
    wave_m: 0.6,
    depart: dep,
    layover_h: null,
    eta,
    duration_h: 3.1,
    warnings: opts.warnings ?? [],
  });
  const points = [
    { lat: 54.512, lon: 13.643, name: "Start" },
    { lat: 54.7, lon: 13.2, name: null }, // eingefügter Umweg-Punkt
    { lat: 54.952, lon: 12.464, name: "Ziel" },
  ];
  return {
    plan: {
      legs: [leg(1, "Start", "54.700,13.200", eta1, depart), leg(2, "54.700,13.200", "Ziel", eta2, eta1)],
      total_nm: 24.8,
      eta: eta2,
      warnings: opts.warnings ?? [],
    },
    routing: {
      engine: "wassermaske",
      points,
      segments: [
        { from: 0, to: 1, routing: opts.luftlinie ? "luftlinie" : "wasserweg" },
        { from: 1, to: 2, routing: "wasserweg" },
      ],
      hinweis: "Wasserweg aus OSM-Küstenlinien (~1 km) — Planungshilfe, keine amtliche Seekarte.",
    },
    sensitivity: 0.5,
    model: "best_match",
    source: "open-meteo",
  };
}

/** Timeline (Wolken/Wind) für das Playback-Overlay. */
function timelineResponse() {
  const t0 = Date.now() + 3600e3;
  const times = [0, 1, 2, 3].map((h) => new Date(t0 + h * 3600e3).toISOString());
  const step = (i: number, cloud: number) => ({
    t: times[i],
    wind_kn: 10 + i,
    gust_kn: 15 + i,
    wind_from_deg: 240,
    cloud_pct: cloud,
    wave_m: 0.5,
    gale: false,
    thunderstorm: false,
    high_wave: false,
  });
  const point = (lat: number, lon: number, clouds: number[]) => ({
    lat,
    lon,
    steps: clouds.map((c, i) => step(i, c)),
  });
  return {
    times,
    points: [
      point(54.512, 13.643, [80, 90, 70, 60]),
      point(54.7, 13.2, [40, 55, 65, 30]),
      point(54.952, 12.464, [20, 25, 45, 90]),
    ],
  };
}

async function mockApis(page: Page, opts: MockOpts & { routeStatus?: number; routeError?: string } = {}) {
  await page.route("**/api/navigation/route", (r) => {
    if (opts.routeStatus && opts.routeStatus !== 200) {
      return r.fulfill({
        status: opts.routeStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: opts.routeError ?? "Fehler" }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(routeResponse(opts)),
    });
  });
  await page.route("**/api/weather/timeline", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(timelineResponse()) }),
  );
  await page.route("**/api/navigation/depth**", (r) => {
    const url = new URL(r.request().url());
    const lat = Number(url.searchParams.get("lat"));
    // Ein Punkt (der Umweg-Punkt bei ~54.7) ist kritisch flach.
    const gefahr = Math.abs(lat - 54.7) < 0.05;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        depth_m: gefahr ? 1.2 : 14.8,
        source: "emodnet",
        check: gefahr ? "gefahr" : "ok",
        hinweis: "Planungsdaten (EMODnet/GEBCO) — keine amtliche Seekarte.",
      }),
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function openWithMap(page: Page) {
  await blockTiles(page);
  // Erstnutzungs-Disclaimer vorab bestätigen — ein eigener Test prüft ihn.
  await page.addInitScript(() => localStorage.setItem("jtc-nav-disclaimer-v1", "1"));
  await page.goto("/navigation");
  await expect(page.getByTestId("nav-map").locator(".leaflet-container")).toBeVisible();
}

test.describe("/navigation — Erstnutzungs-Disclaimer", () => {
  test("[REQ-SAFE-001] erscheint beim ersten Besuch, blockiert bis bestätigt, bleibt danach weg", async ({ page }) => {
    await blockTiles(page);
    await page.goto("/navigation");
    const modal = page.getByTestId("nav-disclaimer");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/nicht als Navigationsmittel zugelassen/i);
    await expect(modal).toContainText(/amtliche Seekarten/i);
    await page.getByTestId("nav-disclaimer-ok").click();
    await expect(modal).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("nav-map").locator(".leaflet-container")).toBeVisible();
    await expect(page.getByTestId("nav-disclaimer")).toHaveCount(0);
  });
});

async function addTwoWaypoints(page: Page) {
  const map = page.getByTestId("nav-map");
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * 0.35, y: box.height * 0.4 } });
  await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(1);
  await map.click({ position: { x: box.width * 0.65, y: box.height * 0.6 } });
  await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(2);
}

async function calculate(page: Page) {
  const resp = page.waitForResponse((r) => r.url().includes("/api/navigation/route"));
  await page.getByTestId("nav-calc").click();
  await resp;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("/navigation — Grundgerüst", () => {
  test("[REQ-SAFE-002] Seite lädt: Gruppen-Dropdown, Suche, Karte, Tiefen-Toggle, Attribution", async ({ page }) => {
    await openWithMap(page);
    // Reviere als GRUPPEN (optgroup Nordsee/Ostsee/Mittelmeer/Binnen).
    const groups = page.getByTestId("nav-revier-select").locator("optgroup");
    await expect(groups).toHaveCount(4);
    await expect(groups.nth(0)).toHaveAttribute("label", "Nordsee");
    await expect(page.getByTestId("nav-revier-search")).toBeVisible();
    await expect(page.getByTestId("nav-depth-toggle")).toBeChecked();
    await expect(page.getByTestId("nav-attribution")).toContainText(/EMODnet/i);
    await expect(page.getByTestId("nav-attribution")).toContainText(/nicht als Navigationsmittel zugelassen/i);
  });

  test("Tidenrevier zeigt Gezeiten-Warnband, Ostsee-Revier nicht", async ({ page }) => {
    await openWithMap(page);
    await page.getByTestId("nav-revier-select").selectOption("deutsche-bucht");
    await expect(page.getByTestId("nav-revier-warnhinweis")).toContainText(/Tide/i);
    await page.getByTestId("nav-revier-select").selectOption("ruegen");
    await expect(page.getByTestId("nav-revier-warnhinweis")).toHaveCount(0);
  });

  test("[REQ-NAV-004] Revier-Suche: 'palma' findet die Balearen und wechselt das Revier", async ({ page }) => {
    await openWithMap(page);
    await page.getByTestId("nav-revier-search").fill("palma");
    const hit = page.getByTestId("nav-search-hits").getByRole("button", { name: /Balearen/ });
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page.getByTestId("nav-revier-select")).toHaveValue("balearen");
  });
});

test.describe("/navigation — Route & Landvermeidung", () => {
  test("[REQ-NAV-001] zwei Wegpunkte → Wasserweg-Route mit Umweg-Punkt, ETA und Legs", async ({ page }) => {
    await mockApis(page);
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calculate(page);
    await expect(page.getByTestId("nav-result")).toBeVisible();
    await expect(page.getByTestId("nav-eta")).toContainText(/Ankunft/);
    await expect(page.getByTestId("nav-leg")).toHaveCount(2);
    await expect(page.getByTestId("nav-routing-hinweis")).toContainText(/Wasserweg/);
    // Strömung ist sichtbar (Strom … kn → … kn über Grund).
    await expect(page.getByTestId("nav-leg").first()).toContainText(/Strom 0.4 kn/);
  });

  test("[REQ-NAV-006] Luftlinien-Segment wird ehrlich ausgewiesen", async ({ page }) => {
    await mockApis(page, { luftlinie: true });
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calculate(page);
    await expect(page.getByTestId("nav-routing-hinweis")).toContainText(/1 Teilstrecke\(n\) als Luftlinie/);
  });

  test("kein Wasserweg (422) → verständliche Fehlermeldung", async ({ page }) => {
    await mockApis(page, {
      routeStatus: 422,
      routeError: "Kein Wasserweg von Start nach Ziel gefunden — liegt ein Wegpunkt an Land?",
    });
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calculate(page);
    await expect(page.getByTestId("nav-error")).toContainText(/Kein Wasserweg/);
  });

  test("[REQ-SAFE-003] Wetterdienst down (502) → freundliche Meldung statt Absturz", async ({ page }) => {
    await mockApis(page, { routeStatus: 502 });
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calculate(page);
    await expect(page.getByTestId("nav-error")).toContainText(/nicht verfügbar/);
  });

  test("Warnungen aus dem Plan erscheinen im Warnband", async ({ page }) => {
    await mockApis(page, { warnings: ["Sturm (9 Bft) ⚠ gefährlich auf Leg 1 (→ Ziel)"] });
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calculate(page);
    await expect(page.getByTestId("nav-warning-item").first()).toContainText(/Sturm/);
  });
});

test.describe("/navigation — Tiefen & Wolken-Playback", () => {
  test("[REQ-NAV-003] Flachwasser-Check läuft AUTOMATISCH nach der Berechnung und markiert die kritische Stelle", async ({
    page,
  }) => {
    await mockApis(page);
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calculate(page);
    // Kein Klick nötig — Sicherheits-Default: Check startet mit der Route.
    await expect(page.getByTestId("nav-depth-result")).toBeVisible();
    await expect(page.getByTestId("nav-depth-warning").first()).toContainText(/GEFAHR/);
    // Manueller Re-Check (z. B. nach Tiefgang-Änderung) funktioniert weiter.
    const resp = page.waitForResponse((r) => r.url().includes("/api/navigation/depth"));
    await page.getByTestId("nav-depth-check").click();
    await resp;
    await expect(page.getByTestId("nav-depth-result")).toBeVisible();
  });

  test("[REQ-NAV-007] Playback: Zeit-Slider bewegt die Zeit, Wolkenfelder liegen auf der Karte", async ({ page }) => {
    await mockApis(page);
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calculate(page);
    await expect(page.getByTestId("nav-playback-panel")).toBeVisible();
    const before = await page.getByTestId("nav-playback-time").innerText();
    await page.getByTestId("nav-playback-slider").fill("3");
    await expect(page.getByTestId("nav-playback-time")).not.toHaveText(before);
    // Wolkenfelder: Leaflet-Circles mit unserer Klasse (Opazität = Bedeckung).
    const clouds = page.locator("path.nav-cloud-patch");
    expect(await clouds.count()).toBeGreaterThan(0);
  });
});

test.describe("/navigation — GPS", () => {
  test.use({
    permissions: ["geolocation"],
    geolocation: { latitude: 54.42, longitude: 13.39, accuracy: 12 },
  });

  test("[REQ-NAV-005] GPS aktivieren → Position sichtbar, Route ab Position mit Live-Badge", async ({ page }) => {
    await mockApis(page);
    await openWithMap(page);
    await page.getByTestId("nav-gps-start").click();
    await expect(page.getByTestId("nav-gps-status")).toContainText(/aktiv/);
    // Positions-Marker + Genauigkeitskreis auf der Karte.
    await expect(page.locator(".nav-gps-marker")).toBeVisible();

    // Route ab eigener Position: EIN geklickter Wegpunkt genügt dann.
    await page.getByTestId("nav-start-at-gps").check();
    const map = page.getByTestId("nav-map");
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.6, y: box.height * 0.5 } });
    await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(1);
    await expect(page.getByTestId("nav-gps-startpoint")).toContainText(/Meine Position/);

    await calculate(page);
    await expect(page.getByTestId("nav-result")).toBeVisible();
    await expect(page.getByTestId("nav-live-badge")).toContainText(/ab eigener Position/);
  });
});

test.describe("/navigation — GPS verweigert", () => {
  test.use({ permissions: [] });

  test("verweigerte Berechtigung → klarer Hinweis statt Endlos-Suche", async ({ page }) => {
    await openWithMap(page);
    await page.getByTestId("nav-gps-start").click();
    await expect(page.getByTestId("nav-gps-status")).toContainText(/verweigert|nicht verfügbar/);
  });
});
