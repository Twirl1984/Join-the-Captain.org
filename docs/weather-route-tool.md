# Wetter-Routen-Tool (`/wetter`) — erste eigene JTC-Implementierung

Stand: 2026-07-02 · Branch: `feat/weather-route` · Status: **KOMPLETT — Backend + Leaflet-UI gebaut & verifiziert (Unit 28 · E2E 8/8 · Build sauber), bereit für Test-Deploy**

Das erste echte Eigenbau-Tool auf `join-the-captain.org`: Ein Segler zieht auf einer
Karte eine Route, wählt Abfahrtszeit + Boot, und bekommt **Wind, Welle, Sturm-/
Gewitter-Warnungen und ETA pro Leg** — berechnet aus freien Open-Meteo-Daten.

Herkunft: Der Routen-/ETA-Kern ist aus dem Schwesterprojekt `jtc.de`
(`feat/weather-service`, Module `lib/weather/route-forecast.js` + `polar.js`) nach
TypeScript portiert. Die schwere Modell-**Validierungsstudie** (Scoreboard/Ledger/
Python-Fetcher) wurde bewusst **weggelassen** — fürs Web-Tool nicht nötig.

---

## Architektur

```
src/lib/weather/
  polar.ts             ✅ Bootsgeschwindigkeit (Segel/Motor, TWA) — Port, getestet
  route-forecast.ts    ✅ Haversine, Kurs, Leg-ETA, Warnungen (Bft-Stärke) — getestet
  warnings.ts          ✅ Unwetter-Klassifikation, Risiko-Regler, Beaufort, Safety-Floor
  backtest.ts          ✅ FP/FN-Metrik, Sensitivitäts-Sweep, windstärke-gewichtete Empfehlung
  open-meteo.ts        ✅ buildSampler(sensitivity): Open-Meteo → sampleForecast (Cache 1 h)
  reviere.ts           ✅ 3 Reviere (Ostsee/Istrien/Dalmatien) + 14 Häfen, Kartencenter
  __tests__/*.test.ts  ✅ 28 Unit + 2 Live-Integration (node:test)
src/app/api/weather/route/route.ts  ✅ POST: waypoints+sensitivity → Plan (Legs+ETA+Warnungen)
scripts/weather-backtest-{fetch,run}.ts  ✅ historischer FP/FN-Backtest (echte Daten)
e2e/wetter.spec.ts + playwright.config.ts ✅ E2E 8/8 grün (Chromium + Mobile)
src/app/wetter/page.tsx + src/components/wetter/* ✅ Leaflet-Karte + Regler + Ergebnis-UI
```

Datenfluss: `/wetter`-Seite → `POST /api/weather/route` → `buildSampler()` holt
Open-Meteo für die Leg-Mittelpunkte (ein Request je API, Multi-Location) →
`planRoute()` rechnet deterministisch → JSON zurück → UI rendert Legs + Warnungen.

---

## ✅ Fertig & verifiziert (auf diesem Branch)

- **Kern portiert** (`polar.ts`, `route-forecast.ts`) — reine, I/O-freie Geometrie.
  Tests aus jtc.de mitportiert, laufen grün:
  `node --import tsx --test src/lib/weather/__tests__/route-forecast.test.ts`
- **Open-Meteo-Adapter** (`open-meteo.ts`):
  - Atmosphäre: `api.open-meteo.com/v1/forecast` (`wind_speed_10m`, `wind_gusts_10m`,
    `wind_direction_10m`, `cape`; `wind_speed_unit=kn`, `timezone=UTC`, `forecast_days=7`).
  - Welle: `marine-api.open-meteo.com/v1/marine` (`wave_height`) — für landnahe Punkte
    fehlertolerant (`null`).
  - Sturm = Böen ≥ 34 kn (8 Bft) · Gewitter-Proxy = CAPE ≥ 800 J/kg (wie jtc.de-Fetcher).
  - Caching über Next.js `fetch(..., { next: { revalidate: 3600 } })` → 1 Request/Punkt/Stunde.
  - Base-URLs + optionaler `OPEN_METEO_API_KEY` per env überschreibbar (Free-Tier ↔ kommerziell).
- **API-Route** (`/api/weather/route`): Input-Validierung, max. 25 Wegpunkte,
  Boot-Profil-Merge, 502 bei Open-Meteo-Ausfall.

### API-Contract

`POST /api/weather/route`
```jsonc
// Request
{
  "waypoints": [{ "lat": 54.679, "lon": 13.432, "name": "Kap Arkona" },
                { "lat": 54.95,  "lon": 12.46,  "name": "Klintholm" }],
  "startTime": "2026-07-01T08:00:00Z",   // optional, Default: jetzt; > 7 Tage → 422
  "mode": "sail",                          // "sail" | "motor"
  "sensitivity": 0.75,                     // optional 0..1 (Risiko-Regler); Default = sicherer Wert
  "boat": { "cruise_speed_motor_kn": 6.5, "hull_speed_kn": 7.2,
            "upwind_no_go_deg": 35, "drive_efficiency": 0.62 }  // optional
}
// Response 200
{
  "plan": {
    "legs": [{ "leg": 1, "from": "Kap Arkona", "to": "Klintholm",
               "distance_nm": 19.2, "course_deg": 312, "mode": "sail",
               "speed_kn": 5.8, "wind_kn": 14, "wind_from_deg": 250,
               "wave_m": 0.6, "eta": "2026-07-01T11:18:00Z",
               "duration_h": 3.3, "warnings": ["Sturm (9 Bft) ⚠ gefährlich auf Leg 1 (→ Klintholm)"] }],
    "total_nm": 19.2, "eta": "2026-07-01T11:18:00Z", "warnings": []
  },
  "sensitivity": 0.75,
  "source": "open-meteo"
}
// Fehler: 400 (Validierung) · 422 (Startzeit jenseits 7-Tage-Horizont) · 502 (Open-Meteo down)
```

**Risiko-Regler (`sensitivity` 0..1) — Sicherheits-Kern.** 0 = risikofreudig (hohe
Schwellen, wenige Fehlalarme/FP, mehr verpasste Warnungen/FN) · 1 = vorsichtig
(niedrige Schwellen, wenige FN, mehr FP). Mittelpunkt 0.5 kalibriert auf 8 Bft/34 kn.
Schwere Stürme (≥ 47 kn) warnen **immer** (`warnings.SEVERE_GUST_KN`, reglerunabhängig).
FP/FN-Definitionen, Backtest-Zahlen und Default-Begründung: **[weather-test-plan.md](weather-test-plan.md)**
+ **[weather-backtest-results.md](weather-backtest-results.md)**. Ausbau zum Sicherheits-
Assistenten (Ankerplätze, Notfall, Strömung/PS, Landleinen): **[weather-roadmap.md](weather-roadmap.md)**.

---

## ✅ GEBAUT — `src/app/wetter/page.tsx` + `src/components/wetter/*` (Leaflet-UI)

Interaktive Karte zum Setzen der Route + Ergebnis-Panel. Folgt dem JTC-Design
(`docs/design-paket.md` Teil A). **Eigene Implementierung → KEINE Affiliate-Kennzeichnung**,
aber Quellen-Attribution „Wetterdaten: Open-Meteo (CC-BY 4.0)" im Footer Pflicht.

### Dependencies (vom bauenden Agenten hinzuzufügen + installieren)
```
npm i leaflet react-leaflet
npm i -D @types/leaflet
```
Leaflet rendert clientseitig → Karten-Komponente als eigenes `"use client"`-Modul,
in `page.tsx` via `next/dynamic` mit `{ ssr: false }` einbinden (sonst SSR-Crash auf
`window`). Leaflet-CSS in `layout.tsx` oder per Import in der Client-Komponente laden.

### UX-Fluss
1. **Revier wählen** (Dropdown aus `REVIERE`) → Karte zentriert (`center`/`zoom`),
   Häfen als anklickbare Marker.
2. **Route bauen**: Klick auf Karte ODER auf Hafen-Marker hängt Wegpunkt an die Liste
   (Polyline verbindet sie, fortlaufend nummeriert). Wegpunkt entfernen/neu ordnen via
   Liste daneben. Drag der Marker optional (P2).
3. **Abfahrt + Modus + Boot**: Datetime-Picker (Default jetzt+1 Tag, 08:00; max 7 Tage),
   Toggle Segel/Motor, optional Boot-Defaults (vorbelegt aus `DEFAULT_BOAT`).
4. **Risiko-Schieberegler** (`data-testid="risk-slider"`, `input[type=range]` 0..1,
   Default `RECOMMENDED_SENSITIVITY`): links „risikofreudig — wenige Fehlalarme",
   rechts „vorsichtig — keine verpasste Warnung". Kurzer Erklärtext darunter (FP vs FN
   in einem Satz). Wert geht als `sensitivity` an die API.
5. **„Route berechnen"** (Teal-CTA) → `POST /api/weather/route` → Ergebnis-Panel.

### Ergebnis-Panel (JTC-Kartenstil)
- Kopf: Gesamt-Distanz, Gesamt-ETA, Journey-Tag **„Planung"** (Blau BG `#E6F1FB`/Text `#185FA5`).
- **Warnungen zuerst** (`data-testid="warning-item"` je Zeile), rot-getöntes Band,
  `ti-alert-triangle`, je Warnung eine Zeile inkl. Windstärke („Sturm (9 Bft) ⚠ gefährlich
  auf Leg 2 → Vis"). Der `warnings`-Array der API ist bereits fertig formatiert.
- **Leg-Liste**, je Leg eine Karte (Weiß, 0.5px Border, radius 12px): „Leg n: von → nach",
  Distanz sm, Kurs°, Wind kn + Richtung (Pfeil-Icon gedreht), Welle m, Modus (Segel/Motor),
  Dauer h, ETA (lokale Zeit, `de-DE`). Leg mit Warnung → Border/Akzent rot.
- **States**: Loading (Karten-Skelett + Shimmer), Empty (vor erster Berechnung Hinweis-Text),
  Error (freundliche Meldung bei 502 „Wetterdaten gerade nicht verfügbar, bitte später").

### Tokens (aus Teil A)
Navy `#0B2545`/`#13315C` · Teal `#2EA39E` (CTA/Icons) · Gold `#C9A24B` · Salt-White `#F4EEE2`
· Poppins · Tabler Outline Icons (`Icon.tsx` existiert) · Touch-Targets ≥ 44px · Mobile: Karte
oben, Eingabe/Ergebnis darunter gestapelt.

### Verzeichnis-Eintrag
- `/wetter` zusätzlich als Tool im Verzeichnis listen (Phase **Planung**), Karte verlinkt
  auf `/wetter`. Prüfen, wie Tools in `src/lib/data.ts` / Migration `0001_init.sql` modelliert
  sind — entweder als seed-Eintrag mit interner URL oder als Sonderfall „eigene App" (kein
  `affiliate_url`). Im Zweifel klein halten: erstmal nur die `/wetter`-Seite + Header-Nav-Link.
- Header-Nav (`SiteHeader.tsx`) optional um „Wetter" ergänzen.

---

## Verifikation (Stand 2026-07-02: ALLE Stufen grün gelaufen)
```bash
npm install                          # zieht leaflet, react-leaflet, @playwright/test
npm run test:weather                 # ✅ 28 Unit-Tests grün (2 Live-Tests skipped ohne Netz)
JTC_WEATHER_LIVE=1 npm run test:weather   # ✅ +2 Live-Integrationstests (echte Open-Meteo-API)
npm run typecheck                    # ✅ 0 Fehler
npm run build                        # ✅ /wetter statisch, 5.78 kB
npx playwright install chromium      # einmalig
PW_PORT=3311 npm run test:e2e        # ✅ 8/8 grün (Chromium + Mobile/Pixel 7)
# API-System-Smoke (echte Daten, alle Fehlerpfade): ✅ verifiziert
curl -s -X POST localhost:3311/api/weather/route -H 'content-type: application/json' \
  -d '{"waypoints":[{"lat":54.679,"lon":13.432,"name":"Arkona"},{"lat":54.95,"lon":12.46,"name":"Klintholm"}],"mode":"sail","sensitivity":1}' | jq .plan
# 422 bei startTime > 7 Tage · 400 bei <2 Wegpunkten / kaputtem JSON · 502-UI-Meldung per E2E gemockt
```
`PW_PORT` erlaubt den E2E-Lauf neben einer laufenden Dev-Instanz auf 3000.

## Deploy (bestehender `.org`-Flow, siehe `docs/DEPLOYMENT.md`)
1. PR `feat/weather-route` → `main`, mergen.
2. Erst **Test-Instanz** (`:3100`, hinter Basic-Auth): `git pull && docker compose -f docker-compose.test.yml up -d --build`, `/wetter` prüfen.
3. Dann **Prod**: `cd /srv/jtc-org/repo && git pull && docker compose up -d --build`.
4. **Keine DB-Migration nötig** (Tool ist rein berechnend). VPS hat ausgehendes HTTPS für Open-Meteo.
5. Optional `OPEN_METEO_API_KEY` in `.env` setzen, falls auf den kommerziellen Plan gewechselt wird.

## Kosten
- Open-Meteo **Free-Tier: 0 €** (kein Key, ~10k Req/Tag, CC-BY → Attribution Pflicht).
  Mit 1-h-Cache + max. ~24 Sample-Punkten/Route bleibt der Verbrauch winzig.
- Streng genommen ist kommerzielle Nutzung der **API-Plan** (~29 €/Mon) — reiner env-Switch
  (`OPEN_METEO_*`-URLs + `OPEN_METEO_API_KEY`), kein Code-Umbau. Fürs MVP/Launch Free-Tier + Attribution.
- Keine LLM-Kosten im Kernpfad (Route ist deterministische Mathematik).

## Spätere Ausbaustufen (nicht MVP)
- Freitext-Routeneingabe per Claude („Von Split nach Vis über Hvar") → Wegpunkte.
- Modell-Auswahl / das beste Modell je Revier aus der jtc.de-Validierungsstudie ziehen.
- Nutzer-Feedback zur Vorhersagegüte (wie im jtc.de-Bot-Konzept), Marker-Drag, GPX-Export.
```

---

## Runde 2 (2026-07-02): Bootsprofil · Liegezeiten · Archiv-Modus · Abfahrts-Empfehlung

- **Bootsprofil:** `polar.boatFromSpecs({length_waterline_m, displacement_t, engine_hp, cruise_speed_motor_kn?})`
  — Rumpfgeschwindigkeit 2.43·√LWL, Marschfahrt aus der Verdränger-Formel (SLR = 10.665/(lb/PS)^⅓, Kappe 1.34, ×0.85).
  UI: aufklappbare Karte „Boot anpassen", abgeleitete Werte live (`boat-derived`).
- **Liegezeiten:** `Waypoint.depart_at` = „Weiterfahrt ab" an Zwischenstopps; `planRoute` wartet
  (Leg bekommt `layover_h` + `depart`). UI: datetime-Feld pro Zwischen-Wegpunkt.
- **Archiv-Modus:** Startzeiten in der Vergangenheit (bis ~5 Jahre) sind erlaubt → Daten kommen von
  `historical-forecast-api` (damalige VORHERSAGEN — „hätte das Tool gewarnt?") + Marine-Archiv.
  Antwort trägt `source: "open-meteo-archive"`, UI zeigt Badge „Archivdaten · Validierung".
- **Sicherheits-Fix aus dem Test:** Warnungen werden jetzt über den GANZEN Leg-Verlauf geprüft
  (Abfahrt/Mitte/Ankunft, Flags ODER, Böe max) — eine Zelle am Leg-Anfang rutschte vorher durchs
  einzelne Mittel-Sample.
- **`POST /api/weather/departure`** — „Wann auslaufen?": `{waypoints, windowStart, windowEnd,
  stepH?, mode?, sensitivity?, boat?}` → `slots[]` (je Kandidat: warnings, max_gust_kn, max_wave_m,
  motor_share, duration_h, score, avoid) + `recommended` + `all_windy`. Slots mit Warnung sind
  „meiden" (Malus 1000); unter den freien gewinnt Komfort (Böen, Welle, Motoranteil, Dauer).
  Fenster max. 5 Tage, ein Datenabruf pro Scan. UI: „Beste Abfahrt finden" — Klick auf Slot
  übernimmt ihn als Abfahrt.
- **HTTPS:** Test-Instanz läuft auf `https://join-the-captain.org:3100` (Let's Encrypt,
  Auto-Renewal; Port 80 → 302 auf die Test-Instanz, bis Prod kommt).
- Verifikation: Unit 42 grün (13 neue) · Typecheck 0 · Build ok · E2E 12/12 · Live-Smoke: Archiv
  (Jan 2025) + Departure-Scan (echtes Sturmtief korrekt gemieden, Sa-Abend empfohlen).
