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
  /** Leg 1 als Motor-primär mit Kreuz-Alternative + Gesamt-Alternative (REQ-NAV-011). */
  kreuzen?: boolean;
  /** Abfahrts-Scan-Slots in der Route-Antwort (REQ-NAV-009). */
  scan?: boolean;
  /** Timeline liefert Tide (NW −0,9 m) für den Flachwasser-Check (REQ-NAV-012). */
  tide?: boolean;
  /** Timeline-Schritte als Nacht markieren (is_day=0) → Mond-Icon (REQ-WET-014). */
  night?: boolean;
}

/** Fester Zeitanker für ALLE Mock-Antworten eines Laufs: Date.now() je
 *  Request ließ die Ankunftszeiten zwischen zwei Berechnungen driften —
 *  die Dauer⇄Uhrzeit-Rückrechnung (REQ-NAV-017) kippte dann um 1 Minute. */
const MOCK_T0 = Date.now();

/** Antwort von POST /api/navigation/route mit einem Zwischenpunkt (Umweg). */
function routeResponse(opts: MockOpts = {}) {
  const depart = new Date(MOCK_T0 + 3600e3).toISOString();
  const eta1 = new Date(MOCK_T0 + 4 * 3600e3).toISOString();
  const eta2 = new Date(MOCK_T0 + 7 * 3600e3).toISOString();
  const leg = (n: number, from: string, to: string, eta: string, dep: string): Record<string, unknown> => ({
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
  const legs = [leg(1, "Start", "54.700,13.200", eta1, depart), leg(2, "54.700,13.200", "Ziel", eta2, eta1)];
  if (opts.kreuzen) {
    legs[0] = {
      ...legs[0],
      mode: "motor",
      alternative: { mode: "kreuzen", speed_kn: 3.1, duration_h: 5.4, eta: eta2 },
    };
  }
  const scan = opts.scan
    ? {
        slots: [0, 3, 6].map((h) => ({
          departure: new Date(MOCK_T0 + (2 + h) * 3600e3).toISOString(),
          eta: eta2,
          duration_h: 6.2,
          warnings: h === 0 ? ["Gewitter auf Leg 1"] : [],
          max_gust_kn: h === 0 ? 35 : 16,
          max_wave_m: 0.8,
          min_wind_kn: 8,
          max_wind_kn: 14,
          motor_share: 0.2,
          score: h === 0 ? 1040 : 40 - h,
          avoid: h === 0,
        })),
        recommended: null as unknown,
        all_windy: false,
      }
    : null;
  if (scan) scan.recommended = scan.slots[2];
  return {
    scan,
    plan: {
      legs,
      total_nm: 24.8,
      eta: eta2,
      eta_alternative: opts.kreuzen ? new Date(MOCK_T0 + 9 * 3600e3).toISOString() : undefined,
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
function timelineResponse(tide = false, night = false) {
  const t0 = MOCK_T0 + 3600e3;
  const times = [0, 1, 2, 3].map((h) => new Date(t0 + h * 3600e3).toISOString());
  const step = (i: number, cloud: number) => ({
    t: times[i],
    wind_kn: 10 + i,
    gust_kn: 15 + i,
    wind_from_deg: 240,
    cloud_pct: cloud,
    is_day: night ? false : true,
    wave_m: 0.5,
    tide_m: tide ? -0.9 : null,
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
      // Nacht-Szenario (REQ-WET-014): ein wolkenloser Punkt (5 %) → Mond-Icon.
      point(54.512, 13.643, night ? [5, 8, 10, 12] : [80, 90, 70, 60]),
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
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(timelineResponse(opts.tide, opts.night)),
    }),
  );
  // Snap (REQ-NAV-010): freie Klicks landen sichtbar an der Küste.
  await page.route("**/api/navigation/snap**", (r) => {
    const u = new URL(r.request().url());
    const lat = Number(u.searchParams.get("lat"));
    if (lat > 54.9) {
      return r.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: "Der Punkt liegt zu weit im Land — bitte näher ans Wasser klicken." }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ lat: 54.6, lon: 13.6, snapped: true }),
    });
  });
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

/** Berechnen-Klick + auf Route-Antwort und Ergebnis warten. */
async function calcAndWait(page: Page) {
  const resp = page.waitForResponse((r) => r.url().includes("/api/navigation/route"));
  await page.getByTestId("nav-calc").click();
  await resp;
  await expect(page.getByTestId("nav-result")).toBeVisible();
}

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

  test("[REQ-NAV-012] Tidenrevier zeigt Gezeiten-Warnband, Ostsee-Revier nicht", async ({ page }) => {
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

  test("[REQ-NAV-002] kein Wasserweg (422) → verständliche Fehlermeldung", async ({ page }) => {
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

  test("[REQ-WET-004] Warnungen aus dem Plan erscheinen im Warnband", async ({ page }) => {
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

  test("[REQ-WET-014] Zeitreise zeigt Himmels-Icons; wolkenlose Nacht ergibt einen Mond", async ({ page }) => {
    await mockApis(page, { night: true });
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calculate(page);
    await expect(page.getByTestId("nav-playback-panel")).toBeVisible();
    // Jeder Overlay-Punkt trägt ein Himmels-Icon — auch ohne Wolken ist etwas zu sehen.
    const sky = page.locator(".wx-sky");
    expect(await sky.count()).toBeGreaterThan(0);
    // Der wolkenlose Punkt (5 %) bei Nacht zeigt einen Mond statt leer zu wirken.
    await expect(page.locator(".wx-sky", { hasText: "🌙" }).first()).toBeVisible();
  });
});

test.describe("/navigation — Karte im Vollbild (REQ-NAV-018)", () => {
  test("[REQ-NAV-018] Vollbild-Schalter vergrößert die Karte und schließt wieder (Klick & Escape)", async ({ page }) => {
    await mockApis(page);
    await openWithMap(page);
    const frame = page.getByTestId("nav-map");
    const toggle = page.getByTestId("nav-map-fullscreen");
    await expect(frame).toHaveAttribute("data-fullscreen", "false");

    // Vollbild an: Frame-Klasse greift, Karte bleibt sichtbar/interaktiv.
    await toggle.click();
    await expect(frame).toHaveAttribute("data-fullscreen", "true");
    await expect(frame).toHaveClass(/wetter-map-frame--full/);
    await expect(frame.locator(".leaflet-container")).toBeVisible();
    // Karten-Interaktion im Vollbild: Klick setzt weiterhin einen Wegpunkt.
    const box = (await frame.boundingBox())!;
    await frame.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
    await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(1);

    // Zweiter Klick auf den Schalter verkleinert wieder.
    await toggle.click();
    await expect(frame).toHaveAttribute("data-fullscreen", "false");

    // Escape schließt das Vollbild ebenfalls.
    await toggle.click();
    await expect(frame).toHaveAttribute("data-fullscreen", "true");
    await page.keyboard.press("Escape");
    await expect(frame).toHaveAttribute("data-fullscreen", "false");
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
    await page.getByTestId("nav-tool-gps").click();
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

  test("[REQ-NAV-024] Jetzt & hier: aktuelle Bedingungen + nächste Häfen an der Position", async ({ page }) => {
    await mockApis(page);
    await page.route("**/api/weather/now**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          at: new Date().toISOString(),
          wind_kn: 14, gust_kn: 20, wind_from_deg: 270, wave_m: 0.6,
          current_kn: 0.3, current_to_deg: 90, tide_m: -0.4,
          gale: false, thunderstorm: false, high_wave: false,
        }),
      }),
    );
    await page.route("**/api/navigation/depth**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ depth_m: 12.4, source: "emodnet", check: "ok" }),
      }),
    );
    await openWithMap(page);
    await page.getByTestId("nav-tool-gps").click();
    await page.getByTestId("nav-gps-start").click();
    await expect(page.getByTestId("nav-gps-status")).toContainText(/aktiv/);
    // Sub-Tool "Jetzt & hier" aufklappen — nächste Häfen erscheinen sofort (clientseitig).
    await page.getByTestId("nav-tool-jetzt").click();
    await expect(page.getByTestId("nav-jetzt-haefen")).toBeVisible();
    // Position (54.42/13.39 = Rügen) liegt NICHT im Default-Revier (Deutsche
    // Bucht) → Vorschlag, zum tatsächlich nächsten Revier zu wechseln.
    const vorschlag = page.getByTestId("nav-jetzt-revier-vorschlag");
    await expect(vorschlag).toBeVisible();
    await expect(vorschlag).not.toContainText(/Deutsche Bucht/);
    await page.getByTestId("nav-jetzt-revier-switch").click();
    // Nach dem Wechsel ist der Vorschlag weg (wir sind jetzt im nächsten Revier).
    await expect(page.getByTestId("nav-jetzt-revier-vorschlag")).toHaveCount(0);
    // Bedingungen laden → Wetter + Tiefe.
    await page.getByTestId("nav-jetzt-load").click();
    await expect(page.getByTestId("nav-jetzt-result")).toContainText(/14 kn aus W/);
    await expect(page.getByTestId("nav-jetzt-depth")).toContainText(/12.4 m/);
  });
});

test.describe("/navigation — GPS verweigert", () => {
  test.use({ permissions: [] });

  test("[REQ-NAV-005] verweigerte Berechtigung → klarer Hinweis statt Endlos-Suche", async ({ page }) => {
    await openWithMap(page);
    await page.getByTestId("nav-tool-gps").click();
    await page.getByTestId("nav-gps-start").click();
    await expect(page.getByTestId("nav-gps-status")).toContainText(/verweigert|nicht verfügbar/);
  });
});


// ── Feature-Parität & neue Sicherheits-Features (2026-07-06) ────────────────

test.describe("/navigation — Boot, Abfahrt, Snap, Kreuzen, Tide", () => {
  test("[REQ-NAV-008] Boots-Preset Jolle übernimmt Parameter und setzt den Tiefgang", async ({ page }) => {
    await mockApis(page);
    await openWithMap(page);
    await page.getByTestId("nav-tool-boot").click();
    await page.getByTestId("nav-boat-preset-jolle").click();
    await expect(page.getByTestId("nav-boat-derived")).toContainText(/ohne Motor/);
    await expect(page.getByTestId("nav-boat-derived")).toContainText(/min 4 kn/);
    await expect(page.getByTestId("nav-tiefgang")).toHaveValue("1");
  });

  test("[REQ-NAV-009] Abfahrts-Scan über den Wasserweg liefert Slots mit Empfehlung", async ({ page }) => {
    await mockApis(page, { scan: true });
    await openWithMap(page);
    await addTwoWaypoints(page);
    await page.getByTestId("nav-tool-scan").click(); // Sub-Tool aufklappen (REQ-NAV-024)
    const resp = page.waitForResponse((r) => r.url().includes("/api/navigation/route"));
    await page.getByTestId("nav-departure-scan").click();
    await resp;
    await expect(page.getByTestId("nav-departure-result")).toBeVisible();
    await expect(page.getByTestId("nav-departure-recommended")).toHaveCount(1);
    expect(await page.getByTestId("nav-departure-slot").count()).toBeGreaterThanOrEqual(2);
  });

  test("[REQ-NAV-010] Land-Klick snappt den Marker sichtbar an die Küste", async ({ page }) => {
    await mockApis(page);
    await openWithMap(page);
    const map = page.getByTestId("nav-map");
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
    await expect(page.getByTestId("nav-snap-hinweis")).toContainText(/Wasserstelle/);
    // Der Listen-Eintrag zeigt die GESNAPPTE Koordinate (Mock: 54.600, 13.600)
    await expect(page.getByTestId("nav-waypoint-item").first()).toContainText("54.600");
  });

  test("[REQ-NAV-010] Klick zu weit im Land wird abgelehnt (Punkt verschwindet)", async ({ page }) => {
    await mockApis(page);
    // Für diesen Fall: Snap lehnt JEDEN Punkt ab (letzte route() gewinnt).
    await page.route("**/api/navigation/snap**", (r) =>
      r.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: "Der Punkt liegt zu weit im Land — bitte näher ans Wasser klicken." }),
      }),
    );
    await openWithMap(page);
    const map = page.getByTestId("nav-map");
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
    await expect(page.getByTestId("nav-snap-hinweis")).toContainText(/zu weit im Land/);
    await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(0);
  });

  test("[REQ-NAV-011] Am-Wind-Leg zeigt Kreuz-Alternative und Gesamt-Alternative", async ({ page }) => {
    await mockApis(page, { kreuzen: true });
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calcAndWait(page);
    await expect(page.getByTestId("leg-alternative").first()).toContainText(/kreuzen/);
    await expect(page.getByTestId("nav-eta-alternative")).toContainText(/kreuzend/);
  });

  test("[REQ-NAV-012] Flachwasser-Check rechnet die Tide ein und weist sie aus", async ({ page }) => {
    await mockApis(page, { tide: true });
    await openWithMap(page);
    await addTwoWaypoints(page);
    await calcAndWait(page);
    // Karte 1.2 m + NW −0.9 m → 0.3 m: weiterhin GEFAHR, jetzt mit Tide-Ausweis
    await expect(page.getByTestId("nav-depth-warning").first()).toContainText(/NW -0.9|NW −0.9/);
    await expect(page.getByTestId("nav-depth-result")).toContainText(/Niedrigstwasser/);
  });
});

test.describe("/navigation — Drag & Offline", () => {
  test("[REQ-NAV-013] Wegpunkt per Ziehen verschieben → Snap-Prüfung greift", async ({ page }, testInfo) => {
    // WebKit (Safari + iPhone) treibt Leaflets Marker-Drag über Playwrights
    // Maus-Emulation nicht zuverlässig an (dragend feuert nicht → keine Snap-
    // Anfrage). Das ist ein Playwright/WebKit-Limit, KEIN Produktfehler: echtes
    // Touch-Dragging auf dem iPhone nutzt Leaflets Touch-Handler. Drag→Snap
    // bleibt über chromium + mobile (Pixel 7) abgedeckt; auf echten iOS-Geräten
    // manuell verifiziert.
    testInfo.skip(testInfo.project.name === "safari" || testInfo.project.name === "iphone", "Leaflet-Drag via Maus-Emulation in WebKit instabil");
    await mockApis(page);
    // Deterministischer Snap (LIFO-Override): Der Standard-Mock ist an die
    // Klick-Koordinate gekoppelt (422 bei lat>54.9) — je nach Viewport lag der
    // Klick mal drüber, mal drunter: Punkt erschien (count=1), wurde dann von
    // der asynchronen 422-Antwort wieder entfernt → Marker weg, Test flaky.
    // Hier: 1. Aufruf (Klick) = "schon im Wasser" (Punkt bleibt an Ort und im
    // Viewport), ab dem 2. (Drag-Ende) = gesnappt auf 54.600/13.600.
    let snapCalls = 0;
    await page.route("**/api/navigation/snap**", (r) => {
      snapCalls++;
      const u = new URL(r.request().url());
      const body =
        snapCalls === 1
          ? { lat: Number(u.searchParams.get("lat")), lon: Number(u.searchParams.get("lon")), snapped: false }
          : { lat: 54.6, lon: 13.6, snapped: true };
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await openWithMap(page);
    const map = page.getByTestId("nav-map");
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.35, y: box.height * 0.4 } });
    await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(1);
    // Marker greifen und ~15% nach rechts unten ziehen (Klicken-und-Halten)
    const marker = page.locator(".wp-marker").first();
    const mb = (await marker.boundingBox())!;
    await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2);
    await page.mouse.down();
    // Auf die vom Drag ausgelöste 2. Snap-Antwort warten, DANN erst asserten —
    // sonst flakte die Hinweis-Prüfung auf iPhone-WebKit unter Volllast.
    const snapResp = page.waitForResponse((r) => r.url().includes("/api/navigation/snap"));
    await page.mouse.move(mb.x + box.width * 0.15, mb.y + box.height * 0.15, { steps: 8 });
    await page.mouse.up();
    await snapResp;
    // Snap-Mock antwortet mit 54.600/13.600 → Listeneintrag zeigt die gesnappte Position
    await expect(page.getByTestId("nav-snap-hinweis")).toContainText(/Wasserstelle/, { timeout: 10000 });
    await expect(page.getByTestId("nav-waypoint-item").first()).toContainText("54.600");
  });

  test("[REQ-NAV-014] Offline: zuletzt geladene Seite bleibt aufrufbar (Service Worker)", async ({ page, browserName, context }) => {
    test.skip(browserName !== "chromium", "SW-Offline-Test nur Chromium");
    await blockTiles(page);
    await page.addInitScript(() => localStorage.setItem("jtc-nav-disclaimer-v1", "1"));
    await page.goto("/navigation");
    await expect(page.getByTestId("nav-map").locator(".leaflet-container")).toBeVisible();
    // SW aktiv werden lassen (registriert nur im Prod-Build, E2E läuft gegen next start)
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker?.getRegistration();
      return !!reg?.active;
    }, undefined, { timeout: 15000 });
    // Erstladung lief VOR der SW-Kontrolle → einmal online neu laden, damit
    // Shell + Chunks durch den SW in den Cache wandern (real: 2. Besuch).
    await page.reload();
    await expect(page.getByTestId("nav-map").locator(".leaflet-container")).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId("nav-map").locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
    await context.setOffline(false);
  });
});

test.describe("/navigation — Liegezeit als Dauer ⇄ Uhrzeit (REQ-NAV-017)", () => {
  test("[REQ-NAV-017] Dauer ergibt Uhrzeit, Uhrzeit ergibt Dauer, stay_min/depart_at im Request", async ({ page }) => {
    test.setTimeout(60_000); // 4 Berechnungen nacheinander — auf WebKit unter Parallellast eng
    await mockApis(page);
    await openWithMap(page);
    const map = page.getByTestId("nav-map");
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.3, y: box.height * 0.4 } });
    await map.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
    await map.click({ position: { x: box.width * 0.7, y: box.height * 0.6 } });
    await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(3);
    await calcAndWait(page);

    // Nach der Berechnung zeigt der Zwischenstopp seine Ankunft.
    await expect(page.getByTestId("nav-arrival")).toBeVisible();
    await expect(page.getByTestId("nav-arrival-pending")).toHaveCount(0);

    // Dauer → Uhrzeit: 2 h 30 min ergibt eine abgeleitete Weiterfahrt-Uhrzeit …
    await page.getByTestId("nav-stay-h").fill("2");
    await page.getByTestId("nav-stay-min").fill("30");
    const v1 = await page.getByTestId("nav-depart-at").inputValue();
    expect(v1).not.toBe("");
    // … und +1 h Dauer verschiebt sie um exakt 60 Minuten.
    await page.getByTestId("nav-stay-h").fill("3");
    const v2 = await page.getByTestId("nav-depart-at").inputValue();
    expect(new Date(v2).getTime() - new Date(v1).getTime()).toBe(3600e3);

    // Die Liegedauer wird auch wirklich MITGESENDET (Bugfix: ging vorher verloren).
    await expect(page.getByTestId("nav-calc")).toBeEnabled();
    const resp1 = page.waitForResponse((r) => r.url().includes("/api/navigation/route"));
    await page.getByTestId("nav-calc").click();
    const body1 = JSON.parse((await resp1).request().postData() ?? "{}") as {
      waypoints: Array<{ stay_min?: number; depart_at?: string }>;
    };
    expect(body1.waypoints[1].stay_min).toBe(210);
    expect(body1.waypoints[1].depart_at).toBeUndefined();

    // Uhrzeit → Dauer: Weiterfahrt 15 min später ⇒ Felder zeigen 3 h 45 min.
    const plus15 = new Date(new Date(v2).getTime() + 15 * 60e3);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${plus15.getFullYear()}-${pad(plus15.getMonth() + 1)}-${pad(plus15.getDate())}T${pad(plus15.getHours())}:${pad(plus15.getMinutes())}`;
    await page.getByTestId("nav-depart-at").fill(local);
    await expect(page.getByTestId("nav-stay-h")).toHaveValue("3");
    await expect(page.getByTestId("nav-stay-min")).toHaveValue("45");

    // Jetzt führt die Uhrzeit: Request trägt depart_at, keine stay_min.
    await expect(page.getByTestId("nav-calc")).toBeEnabled();
    const resp2 = page.waitForResponse((r) => r.url().includes("/api/navigation/route"));
    await page.getByTestId("nav-calc").click();
    const body2 = JSON.parse((await resp2).request().postData() ?? "{}") as {
      waypoints: Array<{ stay_min?: number; depart_at?: string }>;
    };
    expect(body2.waypoints[1].depart_at).toBeTruthy();
    expect(body2.waypoints[1].stay_min).toBeUndefined();

    // Dauer-Felder leeren ⇒ keine Liegezeit mehr im Request.
    await page.getByTestId("nav-stay-h").fill("0");
    await page.getByTestId("nav-stay-min").fill("0");
    await expect(page.getByTestId("nav-calc")).toBeEnabled();
    const resp3 = page.waitForResponse((r) => r.url().includes("/api/navigation/route"));
    await page.getByTestId("nav-calc").click();
    const body3 = JSON.parse((await resp3).request().postData() ?? "{}") as {
      waypoints: Array<{ stay_min?: number; depart_at?: string }>;
    };
    expect(body3.waypoints[1].stay_min).toBeUndefined();
    expect(body3.waypoints[1].depart_at).toBeUndefined();
  });

  test("[REQ-NAV-019] Routen-Profil: Auswahl wandert in den Request, Hinweis erscheint", async ({ page }) => {
    await mockApis(page);
    await openWithMap(page);
    await addTwoWaypoints(page);
    await page.getByTestId("nav-profil-komfort").click();
    await expect(page.getByTestId("nav-profil-hinweis")).toBeVisible();
    const resp = page.waitForResponse((r) => r.url().includes("/api/navigation/route"));
    await page.getByTestId("nav-calc").click();
    const body = JSON.parse((await resp).request().postData() ?? "{}") as { routeProfil?: string };
    expect(body.routeProfil).toBe("komfort");
    await expect(page.getByTestId("nav-profil-komfort")).toHaveAttribute("aria-checked", "true");
  });

  test("[REQ-NAV-017] vor der ersten Berechnung: Eingabe wird angenommen, Kopplung angekündigt", async ({ page }) => {
    await mockApis(page);
    await openWithMap(page);
    const map = page.getByTestId("nav-map");
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.3, y: box.height * 0.4 } });
    await map.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
    await map.click({ position: { x: box.width * 0.7, y: box.height * 0.6 } });
    await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(3);
    // Ohne Berechnung gibt es noch keine Ankunft: Dauer-Eingabe funktioniert,
    // die Uhrzeit bleibt leer und der Hinweis erklärt warum.
    await page.getByTestId("nav-stay-h").fill("2");
    await expect(page.getByTestId("nav-depart-at")).toHaveValue("");
    await expect(page.getByTestId("nav-arrival-pending")).toBeVisible();
    // Nach der Berechnung ist die Kopplung aktiv.
    await calcAndWait(page);
    await expect(page.getByTestId("nav-arrival")).toBeVisible();
    await expect(page.getByTestId("nav-depart-at")).not.toHaveValue("");
  });
});

test.describe("/navigation — Punkt außerhalb des Reviers (BUG-038)", () => {
  test("[REQ-NAV-010] Klick außerhalb der Revier-Maske erklärt die Luftlinie statt zu verwirren", async ({ page }) => {
    await mockApis(page);
    // LIFO-Override: Snap meldet "outside" (Punkt jenseits der Revier-bbox).
    await page.route("**/api/navigation/snap**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ lat: 57.9, lon: 7.5, snapped: false, outside: true }),
      }),
    );
    await openWithMap(page);
    const map = page.getByTestId("nav-map");
    const box = (await map.boundingBox())!;
    await map.click({ position: { x: box.width * 0.5, y: box.height * 0.3 } });
    // Punkt bleibt gesetzt, der Toast erklärt die Lage — sichtbar AUF der Karte
    // (BUG-037: im Vollbild war Feedback unterhalb der Karte unsichtbar).
    await expect(page.getByTestId("nav-waypoint-item")).toHaveCount(1);
    const toast = page.getByTestId("nav-snap-hinweis");
    await expect(toast).toContainText(/außerhalb des Reviers/);
    await expect(toast).toContainText(/Luftlinie/);
  });
});

test.describe("/navigation — Schlanker Törnplaner (IA-Split, REQ-NAV-024)", () => {
  test("[REQ-NAV-024] Sub-Tools sind eingeklappt, Kern bleibt sichtbar, Aufklappen zeigt Regler", async ({ page }) => {
    await mockApis(page);
    await openWithMap(page);
    // Kern der Planung ist ohne Klick sichtbar …
    await expect(page.getByTestId("nav-calc")).toBeVisible();
    await expect(page.getByTestId("nav-profil-komfort")).toBeVisible();
    // … die Sub-Tool-Inhalte NICHT (eingeklappt): der GPS-Start und der
    // Abfahrts-Scan-Knopf liegen in geschlossenen <details>.
    await expect(page.getByTestId("nav-gps-start")).toBeHidden();
    await expect(page.getByTestId("nav-departure-scan")).toBeHidden();
    // Aufklappen macht das Werkzeug bedienbar.
    await page.getByTestId("nav-tool-scan").click();
    await expect(page.getByTestId("nav-departure-scan")).toBeVisible();
    await page.getByTestId("nav-tool-gps").click();
    await expect(page.getByTestId("nav-gps-start")).toBeVisible();
  });
});

test.describe("/navigation — Kreuzpeilung (REQ-NAV-025/026)", () => {
  test("[REQ-NAV-025] Zwei Objekte + Peilungen ergeben einen Standort, drittes ein Fehlerdreieck", async ({ page }) => {
    await mockApis(page);
    await openWithMap(page);
    await page.getByTestId("nav-tool-peilung").click();
    // Zwei Referenzpunkte + zwei (nicht parallele) Peilungen → Standort.
    await page.getByTestId("nav-peil-ref-0").selectOption({ index: 1 });
    await page.getByTestId("nav-peil-mag-0").fill("45");
    await page.getByTestId("nav-peil-ref-1").selectOption({ index: 2 });
    await page.getByTestId("nav-peil-mag-1").fill("135");
    await expect(page.getByTestId("nav-peil-fix")).toBeVisible();
    // Dritte Peilung → Fehlerdreieck wird ausgewiesen (n≥3).
    await page.getByTestId("nav-peil-add").click();
    await page.getByTestId("nav-peil-ref-2").selectOption({ index: 3 });
    await page.getByTestId("nav-peil-mag-2").fill("200");
    await expect(page.getByTestId("nav-peil-fix")).toContainText(/Fehlerdreieck/);
  });
});
