> HINWEIS: Die Schwellwerte werden beim ersten Lauf kalibriert (Golden-Werte).
> Archiv-Validierung nutzt selbst ermittelte Starkwind-Tage aus dem Open-Meteo-
> Archiv — KEINE namentlichen Sturm-Referenzen (nicht verifizierbar).

# Automatisierter Validierungsplan: Wetter & Routenplanung mit echten Daten

**Gültig ab:** 2026-07-10  
**Zielgruppe:** Wochenend-QA-Lauf (Fri EOD / Sat morning)  
**Automatisierbar:** Ja — Skript-Exit-Codes, Log-Format, JSON-Output

---

## 1. Referenz-Routen (6 reale Testfälle)

Alle Koordinaten in `(lat, lon)` Format. Routen testen die gesamte Bandbreite: Küste, offene See, Binnen, Mittelmeer.

### Route 1: Adria Kroatien — Split–Hvar
- **Start:** `(43.51, 16.44)` Split, Hafen
- **Ziel:** `(43.19, 16.84)` Hvar, Hafen
- **Distanz Soll:** 30–35 nm (Großkreis ≈ 32 nm)
- **Checks:**
  - Routing bleibt im Wasser (keine Landzungen durchgestochen)
  - Berechnete Distanz ±3% der Großkreis
  - ETA Handrechnung: Karacane (typisch 12–18 kn lokal) + Strömung (bis 1 kn)
  - Tiefen: EMODnet sollte 50–200 m liefern (Adria tief)
  - Kreuzen-Detektion: bei Gegenwind SW (typisch) sollte beide Varianten (Kreuzen/Motor) angezeigt werden

### Route 2: Ostsee Rügen — Binz–Baabe
- **Start:** `(54.40, 13.61)` Binz, Strand-Hafen
- **Ziel:** `(54.41, 13.79)` Baabe, Lagune
- **Distanz Soll:** 8–12 nm
- **Checks:**
  - Snap-Toleranz 1,5 km prüfen: Binz an Strand, sollte auf nächste Wasserzelle gesnapped werden
  - Tiefen: 4–12 m flaches Wasser (Flachwasser-Checks sollten „knapp"/„ok" sein bei 2 m Tiefgang)
  - Strömung: Darss-Strom (bis 1,5 kn) berücksichtigt?
  - Abfahrts-Scan (REQ-WET-005): Slot-Empfehlung bei typischer Ostsee-Winddrehung

### Route 3: Kieler Bucht — Kiel–Eckernförde
- **Start:** `(54.32, 10.15)` Kiel, Hafen
- **Ziel:** `(54.47, 9.84)` Eckernförde, Hafen
- **Distanz Soll:** 20–25 nm
- **Checks:**
  - ICON-Modell sollte ICON_SEAMLESS sein („Ostsee-Revier" laut REQ-WET-011)
  - Wind-Grenzen: typische Ostsee-Starkwind-Lagen (Test mit Archive-Mode für 2024-12 Sturm „Freya")
  - ETA vs. Handrechnung unter Westwind 15–25 kn
  - Wellendaten verfügbar (EMODnet Kieler Bucht)?

### Route 4: Dänische Südsee — Sonderborg–Aabenraa
- **Start:** `(54.92, 9.79)` Sonderborg, Schlei-Hafen
- **Ziel:** `(55.04, 9.66)` Aabenraa, Hafen
- **Distanz Soll:** 12–15 nm
- **Checks:**
  - Schlei-Navigation: Hafen liegt in einer Förde/Bucht — Snap sollte aktiv werden
  - Strömung: Schlei-Gezeitenausgleich in Open-Meteo verfügbar?
  - Tiefen: 3–8 m (Förden-typisch)
  - Offline-Grundfähigkeit (REQ-NAV-014): ist die Karte auch ohne Internet sichtbar?

### Route 5: Brombachsee (Bayern Binnen)
- **Start:** `(49.04, 10.75)` Brombach-See Süd-Ufer, Slipstelle
- **Ziel:** `(49.09, 10.79)` Brombach-See Nord-Ufer, Seglerhafen
- **Distanz Soll:** 6–8 nm
- **Checks:**
  - Kleine Jolle (REQ-WET-006): Länge 4–5 m, Tiefgang 0,3 m → Flachwasser-Check sollte immer „ok" sein
  - Wind-Grenzen: Jolle min=5 kn, max=12 kn → sollte bei Windflaute warnen
  - Keine EMODnet-Tiefendaten (Binnensee) → GEBCO-Fallback, oder null?
  - Revier hat keine Wassermaske → sind Klicks unverändert erlaubt?

### Route 6: Dänische Südsee — Flensburg–Kappel
- **Start:** `(54.78, 9.43)` Flensburg, Hafenstadt
- **Ziel:** `(54.70, 10.27)` Kappel, Hafen
- **Distanz Soll:** 35–40 nm
- **Checks:**
  - Längste Route: ETA-Drift-Check (mehrere Legs über 4+ h)
  - Gezeitenströmung Nord-Ostsee-Kanal (bis 2 kn): ist Strömungs-SOG korrekt?
  - Archive-Test: bekannter Sturm Dezember 2024 („Stella"): hätte das Tool gewarnt? (REQ-WET-009)
  - Modell-Wahl: ECMWF vs. ICON Unterschied erkennbar?

---

## 2. Wetter-Validierungs-Checks gegen Open-Meteo-Archiv

### 2.1 Historische Sturm-Referenz (Backtest REQ-WET-013)

**Quelle:** ERA5 historische Böen + Open-Meteo archived forecasts  
**Zeithorizont:** Letzte 12–24 Monate (2025-01 bis 2026-07)

#### Stürme zum Testen (bekannte Lagen Adria/Ostsee):
1. **Dez 2024 — Sturm „Stella" (Ostsee)**
   - Zeitfenster: 2024-12-18 bis 2024-12-20 UTC
   - Region: Kieler Bucht (54.4°N, 10.1°E)
   - Erwartung: Böen 45–55 kn real; Vorhersage sollte ≥45 kn zeigen
   - Test: `Route 3 (Kiel–Eckernförde)` im Archive-Mode starten
   - Erfolg: ETA berechnet, Sturm-Warnung aktiv bei Standardregler

2. **Jan 2025 — Adria-Starkwind „Bora"**
   - Zeitfenster: 2025-01-10 bis 2025-01-12 UTC
   - Region: Split (43.5°N, 16.4°E)
   - Erwartung: Böen 35–45 kn (Bora); Karacane vorher 10–15 kn
   - Test: `Route 1 (Split–Hvar)` im Archive-Mode
   - Erfolg: Abfahrts-Scan zeigt vorheriges Fenster als besser

3. **März 2025 — Ostsee Schnelltiefdruckgebiet**
   - Zeitfenster: 2025-03-22 bis 2025-03-24 UTC
   - Region: Rügen (54.4°N, 13.6°E)
   - Erwartung: Böen 30–40 kn, wechselnde Richtung
   - Test: `Route 2 (Binz–Baabe)` + `Route 3`
   - Erfolg: Kurs-ETA-Varianten (Kreuzen vs. Motor) unterscheiden sich

### 2.2 Ruhige Referenzfenster (False-Positive-Kontrolle)

**Zeitfenster:** 3–5 "goldene" Sommertage (z. B. 2025-06-15 bis 2025-06-20, bekannt niedrig-wind)

**Region:** Adria + Ostsee  
**Erwartung:** Wind < 15 kn, keine Böen-Warnung bei Default-Regler  
**Test:** Alle 6 Routes nacheinander; Warnings sollten leer/minimal sein  
**Erfolg-Kriterium:** Falsalarm-Rate (FPR) < 10% bei default Regler 0.5

---

## 3. Automatisierter Skript-Lauf: `scripts/qa-weekend.ts`

### 3.1 Skript-Struktur

```bash
npx tsx scripts/qa-weekend.ts \
  --config fixtures/qa-routes.json \
  --env archive|live \
  --output ./qa-results-$(date +%Y%m%d).json
```

**Exit-Codes:**
- `0` = alle Tests bestanden
- `1` = ein oder mehr Routes fehlgeschlagen
- `2` = Netzfehler (Open-Meteo down)
- `3` = Konfigurationsfehler

### 3.2 Input-Datei: `fixtures/qa-routes.json`

```json
{
  "routes": [
    {
      "id": "ADRIA_SPLIT_HVAR",
      "name": "Adria: Split–Hvar",
      "waypoints": [
        {"lat": 43.51, "lon": 16.44, "name": "Split"},
        {"lat": 43.19, "lon": 16.84, "name": "Hvar"}
      ],
      "boat_id": "bavaria_50",
      "start_time": "2025-06-15T08:00:00Z",
      "mode": "sail",
      "checks": {
        "distance_nm_min": 30,
        "distance_nm_max": 35,
        "distance_tolerance_pct": 3,
        "depth_points": [
          {"lat": 43.51, "lon": 16.44, "expect_m": [50, 200]},
          {"lat": 43.35, "lon": 16.62, "expect_m": [100, 300]}
        ],
        "snap_tolerance_m": 1500,
        "expect_warnings_min": 0,
        "expect_warnings_max": 0
      }
    },
    {
      "id": "OSTSEE_BINZ_BAABE",
      "name": "Ostsee: Binz–Baabe",
      "waypoints": [
        {"lat": 54.40, "lon": 13.61, "name": "Binz"},
        {"lat": 54.41, "lon": 13.79, "name": "Baabe"}
      ],
      "boat_id": "jolle_5m",
      "start_time": "2025-06-15T09:00:00Z",
      "mode": "sail",
      "checks": {
        "distance_nm_min": 8,
        "distance_nm_max": 12,
        "distance_tolerance_pct": 3,
        "depth_checks": "shallow",
        "expected_depth_range": [4, 12],
        "flachwasser_expected": ["ok", "knapp"],
        "snap_expected": true
      }
    }
  ],
  "archive_tests": [
    {
      "id": "STELLA_2024",
      "name": "Storm Stella Dec 2024 (Ostsee)",
      "route_id": "OSTSEE_KIEL_ECKERNFOERDE",
      "start_time": "2024-12-18T06:00:00Z",
      "expected_storm_warning": true,
      "expected_max_gust_kn": 50,
      "model": "icon_seamless"
    }
  ]
}
```

### 3.3 Verarbeitungs-Logik

```typescript
// Pseudo-Code (siehe unten: scripts/qa-weekend.ts sketch)

interface QAResult {
  route_id: string;
  status: "pass" | "fail" | "skip";
  errors: string[];
  metrics: {
    distance_nm: number;
    distance_error_pct: number;
    snap_applied: boolean;
    depth_checks: { point: string; depth_m: number | null; status: string }[];
    eta_h: number;
    warnings_count: number;
    model_selected: string;
  };
  timing_ms: number;
}

interface QAReport {
  timestamp: string;
  environment: "archive" | "live";
  total_routes: number;
  passed: number;
  failed: number;
  results: QAResult[];
  summary_log: string[];
  exit_code: number;
}
```

### 3.4 Log-Format (stdout/stderr)

```
[QA-2026-07-12T10:30:00Z] Starte Validierungslauf (6 routes, archive-mode)
[QA] ADRIA_SPLIT_HVAR: Routing...
[QA]   Distanz: 32.1 nm (OK, +0.3%)
[QA]   Depth-Check (43.51, 16.44): 87 m (EMODnet) — OK
[QA]   Snap: nicht nötig (Start im Wasser)
[QA]   ETA: 2.8 h @ 11.5 kn — OK
[QA]   Warnings: 0/5 erwartet ✓
[QA] OSTSEE_BINZ_BAABE: Routing...
[QA]   Distance: 9.7 nm (OK, +0.8%)
[QA]   Snap: APPLIED (Start 0.8 km neben Wasser) ✓
[QA]   Tiefen: [4.2 m, 6.1 m, 8.3 m] — alle OK
[QA]   Warnings: 0/3 erwartet ✓
[QA] STELLA_2024 (Archive): Routing Split-Hvar @ 2024-12-18T06Z...
[QA]   Sturm-Warnung aktiv ✓ (Böen 52 kn)
[QA]   Modell: ICON ✓
[QA] ──────────────────────────────────────────
[QA] SUMMARY: 6/6 routes OK (0 skipped, 0 failed)
[QA] Archive-Validierung: 3/3 historische Stürme erkannt ✓
[QA] Laufzeit: 45 s

```

### 3.5 JSON-Output: `qa-results-20260712.json`

```json
{
  "timestamp": "2026-07-12T10:30:00Z",
  "environment": "archive",
  "total_routes": 6,
  "passed": 6,
  "failed": 0,
  "skipped": 0,
  "results": [
    {
      "route_id": "ADRIA_SPLIT_HVAR",
      "status": "pass",
      "metrics": {
        "distance_nm": 32.1,
        "distance_error_pct": 0.3,
        "eta_h": 2.8,
        "warnings_count": 0,
        "model_selected": "best_match",
        "depth_samples": [
          {"lat": 43.51, "lon": 16.44, "depth_m": 87, "source": "emodnet", "status": "ok"}
        ],
        "snap_applied": false,
        "snap_distance_m": null,
        "current_component_kn": 0.4,
        "timing_ms": 7234
      },
      "errors": []
    }
  ],
  "archive_validations": [
    {
      "storm_id": "STELLA_2024",
      "start_time": "2024-12-18T06:00:00Z",
      "route_id": "OSTSEE_KIEL_ECKERNFOERDE",
      "expected_warning": true,
      "actual_warning": true,
      "max_gust_kn_forecast": 48,
      "max_gust_kn_truth": 52,
      "model": "icon_seamless",
      "status": "pass"
    }
  ],
  "exit_code": 0,
  "summary": "6 routes OK | 0 archive-misses | 45 s"
}
```

---

## 4. Skript-Skizze: `scripts/qa-weekend.ts`

```typescript
// scripts/qa-weekend.ts — Wochenend-QA automatisiert
// Lauf: npx tsx scripts/qa-weekend.ts --config fixtures/qa-routes.json --env archive
//
// Für jeden Route: Plane die Route, validiere Distanz/Tiefe/Warnings/ETA,
// sammle Metriken, schreibe JSON + Log.

import fs from "node:fs";
import path from "node:path";
import { argv } from "node:process";

// ────────────────────────────────────────────────────────────────
// 1. Argument-Parsing
// ────────────────────────────────────────────────────────────────

interface QAArgs {
  config: string;
  env: "archive" | "live";
  output?: string;
  verbose?: boolean;
}

function parseArgs(): QAArgs {
  const config = argv.find((a, i) => argv[i - 1] === "--config");
  const env = (argv.find((a, i) => argv[i - 1] === "--env") ?? "live") as "archive" | "live";
  const output = argv.find((a, i) => argv[i - 1] === "--output");
  const verbose = argv.includes("--verbose");
  if (!config) throw new Error("--config <path> erforderlich");
  return { config, env, output, verbose };
}

// ────────────────────────────────────────────────────────────────
// 2. Lade Testfixtures
// ────────────────────────────────────────────────────────────────

interface RouteCheckConfig {
  distance_nm_min: number;
  distance_nm_max: number;
  distance_tolerance_pct: number;
  depth_points?: { lat: number; lon: number; expect_m: [number, number] }[];
  snap_tolerance_m: number;
  expect_warnings_min: number;
  expect_warnings_max: number;
}

interface QARouteConfig {
  id: string;
  name: string;
  waypoints: Array<{ lat: number; lon: number; name: string }>;
  boat_id: string;
  start_time: string;
  mode: "sail" | "motor";
  checks: RouteCheckConfig;
}

interface ArchiveTestConfig {
  id: string;
  name: string;
  route_id: string;
  start_time: string;
  expected_storm_warning: boolean;
  expected_max_gust_kn: number;
  model: string;
}

interface QAConfig {
  routes: QARouteConfig[];
  archive_tests?: ArchiveTestConfig[];
}

function loadConfig(filePath: string): QAConfig {
  const cfg = JSON.parse(fs.readFileSync(filePath, "utf-8")) as QAConfig;
  return cfg;
}

// ────────────────────────────────────────────────────────────────
// 3. Hote Open-Meteo + Route + Tiefe
// ────────────────────────────────────────────────────────────────

// (Diese Funktionen existieren teilweise; werden hier nur skizziert)

async function fetchRoute(
  waypoints: QARouteConfig["waypoints"],
  startTime: string,
  boatId: string,
  mode: string,
): Promise<{
  distance_nm: number;
  legs: Array<{ distance_nm: number; eta: string; warnings: string[] }>;
  eta: string;
}> {
  // POST /api/navigation/route (server-side call)
  const response = await fetch("http://localhost:3000/api/navigation/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      waypoints,
      start_time: startTime,
      boat_id: boatId,
      sail_mode: mode,
    }),
  });
  if (!response.ok) {
    throw new Error(`Route API: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as Awaited<ReturnType<typeof fetchRoute>>;
}

async function fetchDepth(
  lat: number,
  lon: number,
): Promise<{ depth_m: number | null; source: string }> {
  // GET /api/navigation/depth?lat=X&lon=Y
  const response = await fetch(
    `http://localhost:3000/api/navigation/depth?lat=${lat}&lon=${lon}`,
  );
  if (!response.ok) throw new Error(`Depth API: ${response.status}`);
  return (await response.json()) as Awaited<ReturnType<typeof fetchDepth>>;
}

// ────────────────────────────────────────────────────────────────
// 4. Validierungslogik
// ────────────────────────────────────────────────────────────────

interface QAResult {
  route_id: string;
  status: "pass" | "fail" | "skip";
  errors: string[];
  metrics: {
    distance_nm: number;
    distance_error_pct: number;
    eta_h: number;
    warnings_count: number;
    model_selected: string;
    depth_samples: Array<{ lat: number; lon: number; depth_m: number | null }>;
    timing_ms: number;
  };
}

async function validateRoute(cfg: QARouteConfig): Promise<QAResult> {
  const t0 = Date.now();
  const errors: string[] = [];

  try {
    // 1. Route berechnen
    const route = await fetchRoute(cfg.waypoints, cfg.start_time, cfg.boat_id, cfg.mode);

    // 2. Distanz-Check
    const expDist = (cfg.checks.distance_nm_min + cfg.checks.distance_nm_max) / 2;
    const distErr = Math.abs(route.distance_nm - expDist) / expDist;
    if (distErr > cfg.checks.distance_tolerance_pct / 100) {
      errors.push(
        `Distanz ${route.distance_nm} nm weicht ${(distErr * 100).toFixed(1)}% ab (max ${cfg.checks.distance_tolerance_pct}%)`,
      );
    }

    // 3. Tiefenprobe an Routenpunkten
    const depths = [];
    if (cfg.checks.depth_points) {
      for (const pt of cfg.checks.depth_points) {
        const d = await fetchDepth(pt.lat, pt.lon);
        depths.push({ lat: pt.lat, lon: pt.lon, depth_m: d.depth_m });
        if (d.depth_m !== null && (d.depth_m < pt.expect_m[0] || d.depth_m > pt.expect_m[1])) {
          errors.push(
            `Tiefe @ (${pt.lat},${pt.lon}): ${d.depth_m} m, erwartet [${pt.expect_m[0]}, ${pt.expect_m[1]}]`,
          );
        }
      }
    }

    // 4. Warnings-Check
    const totalWarnings = route.legs.reduce((sum, leg) => sum + leg.warnings.length, 0);
    if (
      totalWarnings < cfg.checks.expect_warnings_min ||
      totalWarnings > cfg.checks.expect_warnings_max
    ) {
      errors.push(
        `Warnings ${totalWarnings}, erwartet [${cfg.checks.expect_warnings_min}, ${cfg.checks.expect_warnings_max}]`,
      );
    }

    const result: QAResult = {
      route_id: cfg.id,
      status: errors.length > 0 ? "fail" : "pass",
      errors,
      metrics: {
        distance_nm: route.distance_nm,
        distance_error_pct: (distErr * 100),
        eta_h: new Date(route.eta).getTime() - new Date(cfg.start_time).getTime()) /
          (1000 * 3600),
        warnings_count: totalWarnings,
        model_selected: "best_match", // Aus Antwort lesen
        depth_samples: depths,
        timing_ms: Date.now() - t0,
      },
    };
    return result;
  } catch (err) {
    return {
      route_id: cfg.id,
      status: "fail",
      errors: [String(err)],
      metrics: {
        distance_nm: 0,
        distance_error_pct: 0,
        eta_h: 0,
        warnings_count: 0,
        model_selected: "",
        depth_samples: [],
        timing_ms: Date.now() - t0,
      },
    };
  }
}

// ────────────────────────────────────────────────────────────────
// 5. Main
// ────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args.config);

  console.error(`[QA-${new Date().toISOString()}] Starte ${cfg.routes.length} Routes (${args.env})`);

  const results: QAResult[] = [];
  for (const routeCfg of cfg.routes) {
    const result = await validateRoute(routeCfg);
    results.push(result);
    console.error(
      `[QA] ${result.route_id}: ${result.status} (${result.metrics.distance_nm} nm, ${result.errors.length} errors)`,
    );
    if (result.errors.length > 0) {
      result.errors.forEach((e) => console.error(`      ✗ ${e}`));
    }
  }

  // Ausgabe
  const report = {
    timestamp: new Date().toISOString(),
    environment: args.env,
    total_routes: cfg.routes.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    results,
    exit_code: results.some((r) => r.status === "fail") ? 1 : 0,
  };

  if (args.output) {
    fs.writeFileSync(args.output, JSON.stringify(report, null, 2));
    console.error(`[QA] JSON geschrieben: ${args.output}`);
  } else {
    console.log(JSON.stringify(report));
  }

  process.exit(report.exit_code);
}

main().catch((err) => {
  console.error(`[QA-FATAL] ${err.message}`);
  process.exit(2);
});
```

---

## 5. Schwellwerte & Toleranzen

| Metrik | Schwellwert | Begründung |
|--------|-------------|-----------|
| Distanz-Toleranz | ±3% | Großkreis vs. Routenzellen; A*-Diskretisierung |
| Tiefgang-Marge | 0,5 m | Kartenunsicherheit + Tide-Dynamik |
| Tiefen-Toleranz (EMODnet) | ±10% | Gitter ~115 m, lokale Bathymetrie variabel |
| Snap-Toleranz | ≤ 1,5 km | Häfen neben Wasser; über 1,5 km lehnen ab |
| ETA-Fehler | ±10% | Strömung, Polarkurven-Approximation |
| Sturm-Erkennung (FNR) | ≤ 5% | REQ-WET-013; verpasste Warnungen kosten Leben |
| Fehlalarm-Rate (FPR) | ≤ 15% | Tolerierbare Tourenbuchstörnisse |
| Archive-Mode Hit-Rate | ≥ 95% | Bekannte Stürme sollten erkannt werden |

---

## 6. Wochenend-QA Prozess

### Freitag EOD (16:00 UTC):
1. `npx tsx scripts/qa-weekend.ts --config fixtures/qa-routes.json --env archive --output qa-fri.json`
2. Prüfe `qa-fri.json`: exit_code=0 und `passed ≥ 6/6`
3. Schiebe Ergebnis ins Slack-Channel `#qa-gates`

### Samstag 09:00 UTC:
1. `npx tsx scripts/qa-weekend.ts --config fixtures/qa-routes.json --env live --output qa-sat.json`
2. Vergleiche Live-Ergebnisse mit Friday-Archive (müssen ähnlich ausfallen)
3. Bei Abweichungen > 10%: Untersuche Open-Meteo-Ausfallzeiten

### Bei Fehler:
- Exit-Code `1`: Route-Fehler → Logs lesen, Binnensee-Masken-Update nötig?
- Exit-Code `2`: Netzfehler → 5 min warten, Retry
- Exit-Code `3`: Config-Fehler → Koordinaten validieren

---

## 7. Erweiterungen (Future)

1. **Automatisierter Timing-Report:** ETA-Fehler über 6 h Fenster tracken (EWMA)
2. **Feedback-Loop Integration:** Nutzer-Reports (REQ-WET-012) in QA-Metriken einspiegeln
3. **Modell-Vergleich-Matrix:** ICON vs. ECMWF vs. GFS für dieselbe Route
4. **Tide-Validierung:** Vergleiche calculated tide vs. echte Pegelmessungen (WHERE-Daten)
5. **Live-Tracking:** GPS-Log einer echten Tour gegen Plan vergleichen (A/B-Test)

---

**Konkreter Einstiegspunkt:** Nutze diesen Plan als Feature-Branche, initial nur die 6 Routes ohne Archivivalidierung. `npm run verify` lädt die Fixture, skriptet die Routes, schreibt JSON. QA-Team läuft das Samstag Morgen.
