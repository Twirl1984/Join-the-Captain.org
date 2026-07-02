# Testplan — Wetter-Routen-Tool (nach ISTQB)

Stand: 2026-07-02 · Branch: `feat/weather-route` · Bezug: [weather-route-tool.md](weather-route-tool.md), [weather-backtest-results.md](weather-backtest-results.md), [weather-roadmap.md](weather-roadmap.md)

Umfassende Teststrategie von Unit bis E2E, plus die für ein **Sicherheits-Tool**
entscheidende **Validierung der Unwetterwarnungen gegen historische Wetterdaten**
(FP/FN). Leitprinzip: *so viele Schleifen, bis alles grün ist* — jede Stufe hat
klare Ein-/Ausgangskriterien; ein roter Test blockt das Weiterreichen.

---

## 1. FP/FN — was es hier bedeutet (Sicherheits-Kern)

Positiv = „Unwetterwarnung ausgegeben".

| | Unwetter tritt ein | kein Unwetter |
|---|---|---|
| **gewarnt** | TP (richtig gewarnt) | **FP — Fehlalarm** |
| **nicht gewarnt** | **FN — verpasste Warnung** | TN (richtig geschwiegen) |

- **FP (Fehlalarm):** Gewitter/Sturm vorhergesagt, es kommt keins. Ärgerlich —
  führt eher zu Hafen- statt Buchtübernachtung, kostet Komfort/Geld und erzeugt
  Warnmüdigkeit. **Aber sicher.**
- **FN (verpasste Warnung):** kein Unwetter vorhergesagt, es kommt aber eines —
  womöglich **heftiger Sturm/Gewitter, das gefährlich wird.** Die teuerste
  Fehlerart. Ihre Schwere hängt ab von:
  - **Windstärke** — eine verpasste 9-Bft-Bö wiegt weit mehr als eine verpasste
    8-Bft-Bö → FN wird im Backtest **windstärke-gewichtet** (`backtest.costFor`),
    und schwere Stürme (≥ 47 kn) lösen über einen **Sicherheits-Floor**
    (`warnings.SEVERE_GUST_KN`) **immer** aus, reglerunabhängig.
  - **Position & Vorhersage-Unschärfe** — eine Zelle kann knapp vorbeiziehen
    *oder* durch kleine Verlagerung genau die Ankerbucht treffen. Der Regler
    kodiert diesen Sicherheitsabstand: höhere Sensitivität = Warnung mit Puffer
    gegen Vorhersagefehler/Beinahe-Treffer. (Räumlicher Puffer/Ensemble-Spread:
    Roadmap, s. weather-roadmap.md.)
  - **Seltene, heftige Ereignisse** (Downburst/Wirbelsturm) — dürfen nie durch
    eine risikofreudige Reglerstellung wegfallen (→ Floor).

**Ziel:** FN so klein wie möglich (Sicherheit), FP erträglich halten. Der
Nutzer justiert den Rest per Schieberegler (0 = risikofreudig, 1 = vorsichtig);
Default = datengestützter, konservativer Betriebspunkt.

### Akzeptanzkriterien (Warnqualität)
- Sicherheits-Floor: **jede** Böe ≥ 47 kn erzeugt eine Sturm-Warnung (Test grün).
- Monotonie: höhere Sensitivität ⇒ FNR nicht steigend, FPR nicht fallend (Test grün).
- Backtest dokumentiert FP/FN je Reglerstufe über echte Historie; die empfohlene
  Default-Stellung ist datengetrieben begründet (weather-backtest-results.md).
- Bekannte Grenze: Gewitter-Wahrheit (ERA5-`weather_code`) unterschätzt Konvektion
  → Gewitter-FN/FP sind vorläufig; bessere Wahrheitsquelle ist Roadmap (DWD-Warnarchiv).

---

## 2. Teststufen

| Stufe | Was | Werkzeug | Ort | Status |
|---|---|---|---|---|
| **Komponenten/Unit** | polar, route-forecast, warnings, backtest (reine Logik) | `node:test` + tsx | lokal/CI, offline | ✅ 28 grün |
| **Integration** | open-meteo-Adapter ↔ echte API ↔ Klassifikation | `node:test`, `JTC_WEATHER_LIVE=1` | Netz nötig | ✅ 2 grün |
| **API/System** | `POST /api/weather/route` (Validierung, 422-Horizont, 502-Resilienz, sensitivity) | curl-Smoke + Playwright-Route-Mock | dev/Test-Instanz | ⏳ Smoke dok. |
| **System/E2E** | `/wetter`-Seite im Browser (Karte, Regler, Ergebnis) | Playwright (Chromium + Mobile) | benötigt laufende App | ⛔ UI offen, Specs bereit |
| **Abnahme** | Nutzer-Szenarien Ostsee/Kroatien, Mobile, A11y | manuell + explorativ | Test-Instanz `:3100` | ⛔ nach UI |

---

## 3. Testarten

- **Funktional:** Routen-/ETA-Rechnung, Warnauslösung, Reglerwirkung, Reviere-Presets.
- **Nicht-funktional:**
  - *Performance/Kosten:* 1-h-Cache (`revalidate`), 1 Multi-Location-Request je API,
    ≤ 25 Wegpunkte. Ziel: < 1 s Serverantwort bei warmem Cache.
  - *Robustheit/Resilienz:* Open-Meteo-Ausfall → 502 + freundliche UI-Meldung;
    Marine ohne Wellen (Binnennähe) → `null`, kein Crash; Startzeit > 7 Tage → 422.
  - *Usability/A11y:* Kontrast ≥ 4.5:1, Touch-Targets ≥ 44px, Tastaturbedienung der
    Karte/Regler, `aria-label` für Icon-Buttons (JTC-Design Teil A).
- **White-Box/Struktur:** Zweig-Abdeckung der Klassifikation (Grenzwerte je Schwelle),
  Grenzwertanalyse (Bft-Übergänge, Floor bei 47 kn), Äquivalenzklassen (Wind/CAPE/Welle).
- **Change-related:** Re-Test nach jeder Änderung; Regressionssuite = die 28 Unit-Tests
  + Typecheck + `next build` müssen grün bleiben.

---

## 4. Testdaten

- **Synthetische Fixtures** (in den Unit-Tests): deterministische, von Hand
  nachgerechnete Confusion-Matrizen → beweisen die FP/FN-Mathematik.
- **Historischer Backfill:** `scripts/weather-backtest-fetch.ts` zieht archivierte
  Open-Meteo-Vorhersagen (Böen/Wind/CAPE) + ERA5-Wahrheit (Böen/`weather_code`) über
  die Revier-Häfen → `fixtures/weather-backtest.jsonl` (gitignored, ~30 k Samples).
  `scripts/weather-backtest-run.ts` erzeugt daraus die Ergebnis-Tabelle.
- Reproduzierbar mit Netz; die Ergebnis-Markdown ist committed.

---

## 5. Ein-/Ausgangskriterien & „Schleifen bis grün"

**Entry:** Code kompiliert (`tsc --noEmit` sauber). **Exit je Stufe:**
1. Unit + Integration grün · 2. Typecheck 0 Fehler · 3. `next build` ok ·
4. E2E (Playwright) grün · 5. Explorative Session ohne offene Sev-1/2-Findings ·
6. Backtest-FP/FN dokumentiert, Default-Regler begründet.

**Loop:** Bei rotem Test → fixen → **gesamte** betroffene Stufe erneut, bis 0 Fehler,
dann nächste Stufe. Keine Stufe wird mit bekannten Rotmeldungen weitergereicht.

```bash
# lokale Schleife
node --import tsx --test src/lib/weather/__tests__/*.test.ts   # Unit (offline)
JTC_WEATHER_LIVE=1 node --import tsx --test src/lib/weather/__tests__/open-meteo.integration.test.ts
npm run typecheck && npm run build
npx playwright test                                            # E2E (nach UI)
npx tsx scripts/weather-backtest-fetch.ts && npx tsx scripts/weather-backtest-run.ts
```

---

## 6. Exploratives Testen (Session-Based)

Charters — je Session zeitboxen (~60 min), Befunde notieren:
1. **Grenz-Geometrie:** 0-sm-Legs, identische Wegpunkte, Antimeridian, sehr lange Legs.
2. **Regler-Extreme × echte Reviere:** s=0 vs s=1 an stürmischen vs. ruhigen Tagen.
3. **Zeitfenster:** Start in der Vergangenheit, in 6 Tagen, in 30 Tagen (Horizont).
4. **Bootsprofil:** Flaute→Motor-Fallback, starker Wind→Rumpfgeschwindigkeit-Kappung.
5. **Datenlücken:** Binnennaher Punkt ohne Welle, CAPE fehlt, Marine-Ausfall.

**Bereits durchgeführte Session (2026-07-02) — Befunde:**
- C1 doppelter Wegpunkt (0 sm) → `distance 0, duration 0`, kein NaN/Crash. ✔
- C2 Flaute 2 kn hart am Wind → Modus `motor` (Fallback greift). ✔
- C3 Adria-Sommertag ruhig → 0 Warnungen bei s=0 und s=1 (konsistent). ✔
- **C4 Start +30 Tage → stiller Plan aus der letzten Vorhersagestunde (irreführend).
  BEHOBEN:** API lehnt Startzeit > 7 Tage jetzt mit 422 ab (`FORECAST_HORIZON_DAYS`).

---

## 7. E2E-Vertrag (Playwright)

`e2e/wetter.spec.ts` erwartet folgende `data-testid` auf `/wetter`:
`revier-select`, `wetter-map`, `waypoint-item`, `risk-slider`, `calc-button`,
`result-panel`, `leg-card`, `warning-item`, `attribution`.
Fälle: Seite lädt (Karte/Regler/Attribution) · Route setzen → Legs · **Regler ↑
erhöht/hält Warnungszahl (Monotonie)** · API-502 → freundliche Meldung.
Lauf: `npx playwright install --with-deps chromium && npm run build && npx playwright test`.

---

## 8. Metriken & Reporting

Pro Lauf festhalten: Test-Pass-Rate, Typecheck/Build-Status, E2E-Ergebnis,
FP/FN je Reglerstufe (Tabelle) + empfohlener Default, offene explorative Findings
nach Schweregrad. Sicherheits-relevante Findings (FN-nah) haben Vorrang.
