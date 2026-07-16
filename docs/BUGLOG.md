# BUGLOG — join-the-captain.org

> Gepflegt nach ASPICE SUP.9. Neue Bugs bekommen die nächste BUG-ID, einen
> Regressionstest (Datei + [REQ-…]-Tag) und den Status BEHOBEN erst nach
> grünem `npm run verify`. Einträge mit "Test-Lücke" sind Merkposten.

**ASPICE SUP.9 — Problem Resolution & History Management**

Dokumentation aller bekannten Bugs und Review-Findings des Projekts, chronologisch
gesammelt aus git-Historie, Code-Kommentaren und explorativen Test-Sessions.
Referenzen: docs/navigation-test-notes.md (Session 1–3), docs/weather-test-plan.md,
Commits mit [fix], adversariale Reviews.

---

| BUG-ID | Titel | Ursache | Fix (Commit/Datei) | Regressionstest | Status |
|--------|-------|--------|-------------------|-----------------|--------|
| BUG-001 | Kachelgrenzen-Artefakt: Wassermasken auf runden Breitengraden | OSM-Küsten-Kacheln stoßen auf z.B. 54,0°; Fließkomma-Rundung in der Zeilen-Bereichs-Optimierung schlug fehl (ceil(95.0000…23) = 96), erzeugte falschen Landstreifen quer über Gewässer | 90d3f2a (Session 1, 2026-07-03) · src/lib/navigation/maskgen.ts | maskgen.test.ts "Kachelgrenzen-Kanten" + Datenqualitäts-Test Split→Hvar | BEHOBEN |
| BUG-002 | Schlei (Förde) läuft bei 1 km Auflösung zu | Wassermaske mit 1-km-Rasterung zu grob für enge Förden; Hafen Kappeln lag ohne erreichbare Wasserzelle | 90d3f2a (Workaround) · Merkposten NAV-9 | Keine Unit-Tests; Test-Case: Schlei-Einstieg (manuell) | OFFEN / P2-Merkposten |
| BUG-003 | react-leaflet: pathOptions.className wird ignoriert | setStyle() respektiert die className-Prop nicht; Wolkenfelder hatten keine CSS-Klasse, fehlten Blur/Styling in E2E | 90d3f2a · src/components/navigation/NavMap.tsx | E2E navigation.spec.ts (Wolkenfeld-Sichtbarkeit) | BEHOBEN |
| BUG-004 | Ausdünnen (thin) bricht Wasser-Garantie [KRITISCH] | thin() warf Punkte der geprüften Route weg, ohne die NEUEN Segmente zu prüfen; Repro: 4 von 11 Segmenten kreuzten Land, obwohl als „waterway" markiert | 90d3f2a (Challenge-Loop Session 3) · src/lib/navigation/searoute.ts | searoute.test.ts — Wasser-Segment-Garantie | BEHOBEN |
| BUG-005 | Segment-Abtastung übersah Landecken [HOCH] | Punktweises Sampling in halber Zellweite (~0,5 km) akzeptierte Eck-Schnitte (kurze Sehnen über Land); A*-Diagonalschutz half nicht | 90d3f2a · src/lib/navigation/searoute.ts | searoute.test.ts — Amanatides-Woo-Supercover-Tests | BEHOBEN |
| BUG-006 | Stale-Closure in Live-ETA (calcRef) [HOCH] | 60-s-Interval fror GPS-Position/Wegpunkte vom Einschalt-Zeitpunkt ein; Live-Kurspfeil wurde nicht aktualisiert | 90d3f2a (calcRef-Muster eingeführt) · src/components/navigation/NavApp.tsx | NavApp integration tests (manuell; calcRef-Snapshot-Tests fehlen noch) | BEHOBEN |
| BUG-007 | Open-Meteo-Expansion sprengte Sampling-Limit [HOCH] | 25 Wegpunkte × 11 Routen-Punkte → ~264 Open-Meteo-Locations; URL-Länge überschritt Limits, API-Error 414 | 90d3f2a · src/lib/navigation/NavApp.tsx | Sampling-Unit-Test (coverage) | BEHOBEN |
| BUG-008 | Masken-Registry wurde durch Einzel-Revier-Lauf gelöscht [HOCH] | Beim Ausführen eines einzelnen Reviers (z.B. Brombachsee-Fetch) wurde die Registry überschrieben, andere Reviere wurden gelöscht | 90d3f2a · src/lib/navigation/masks/index.ts | masks.test.ts — Registry-Integrität | BEHOBEN |
| BUG-009 | Geolocation Watch-Leak & Zombie-Status | Wechsel zwischen GPS-Modus schuf Multiple-Watch-Listener; alte Watch-Requests antworteten noch, nachdem gestoppt | 90d3f2a · src/components/navigation/useGeolocation.ts | useGeolocation-Unit-Tests + E2E navigation.spec.ts | BEHOBEN |
| BUG-010 | GPS-Kurspfeil um 90° verdreht | Bearing-Berechnung/Kompass-Rendering falsch (~1° gegen das Netz geplant, kam als +90° an) | 90d3f2a · src/components/navigation/NavMap.tsx | Noch nicht im Unit-Test festgenagelt | BEHOBEN / Test-Lücke |
| BUG-011 | "Tiefe unbekannt" als "ok" behandelt | Fehlende Tiefendaten wurden als sichere Tiefe missinterpretiert; falsch-negative Flachwasser-Warnungen | 90d3f2a · src/lib/navigation/depth.ts | depth.test.ts "[REQ-NAV-003]" | BEHOBEN |
| BUG-012 | Body-Limit vertraute content-length-Header | API-Handler checkte nur Header, nicht echte Payload-Länge; Buffer-Overflow-Vektor (chunked encoding) | 90d3f2a · src/app/api/navigation/route/route.ts | API-Guard-Smoke-Tests | BEHOBEN |
| BUG-013 | Rate-Limit fehlte für Depth/Route-APIs | DoS-Vektor: unbegrenzte Requests | 90d3f2a · src/lib/rate-limit.ts | rate-limit.test.ts "[REQ-SAFE-004]" | BEHOBEN |
| BUG-014 | nearestWaterCell nahm erste statt nächste Zelle | Ring-Iteration fehlte Distanz-Check; Snap-Radius war überdimensioniert | 90d3f2a · src/lib/navigation/watermask.ts | watermask.test.ts | BEHOBEN |
| BUG-015 | Tiefgang-Parameter: "0.5" wurde akzeptiert | Statt 0,5 m wurde 0.5 (falsch) gemacht; >20 m wurde still ignoriert | 90d3f2a · src/app/api/navigation/depth/route.ts | API-Guard-Test | BEHOBEN |
| BUG-016 | Snap-Radius in Zellen statt physische Einheit | 1-km-Seepolygon (grob), Ramsberg 1,2 km daneben → Snap war zu kurz | 90d3f2a · src/lib/navigation/searoute.ts | Brombachsee-Smoke | BEHOBEN |
| BUG-017 | minTideAt: naive Euklid statt Breitengrad-korrigiert [Review-Finding] | Punkte bei 55°N bekamen Tide eines fernen Ost-West-Nachbarn; Distanz-Berechnung übersah cos(lat)-Faktor | 4c6067d (2026-07-06) · src/components/navigation/NavApp.tsx | depth.test.ts "[REQ-NAV-012]" Tide-Verrechnung | BEHOBEN |
| BUG-018 | checkDepths: tiefgang-Snapshot gegen Closure-Race | Tiefgang-Wert änderte sich während laufender Fetch-Requests; Flachwasser-Status wurde inkonsistent | 4c6067d (2026-07-06) · src/components/navigation/NavApp.tsx | depth.test.ts | BEHOBEN |
| BUG-019 | Fetch ohne Timeout (Depth-APIs) | EMODnet/GEBCO-Requests hingen unbegrenzt; DoS-Vektor | b147550 (2026-07-03, Session 2) · src/app/api/navigation/depth/route.ts, src/lib/navigation/depth.ts | API-Integration-Tests + Smoke | BEHOBEN |
| BUG-020 | Wetter-Fetches ohne Timeout | open-meteo.fetchJson kein AbortSignal; haengende Upstreams blocken Worker | b147550 · src/lib/weather/open-meteo.ts | Integration-Tests JTC_WEATHER_LIVE | BEHOBEN |
| BUG-021 | Stale-Fetch-Races: Tiefen/Timeline rendern nach Wechsel | Antwort einer alten Route kam nach Route-Revision an, überschrieb den UI-Zustand | b147550 · src/components/navigation/NavApp.tsx | E2E navigation.spec.ts (Revierwechsel + Neuberechnung) | BEHOBEN |
| BUG-022 | Radiogroup: aria-pressed statt aria-checked | Screenreader-Semantik falsch; a11y-Toolbar-Kontrolle | b147550 · src/components/navigation/NavApp.tsx, src/components/wetter/WetterApp.tsx | ARIA_FINDING_CHECK.md, BUTTON_ARIA_ANALYSIS.md (Review-Artefakte) | BEHOBEN |
| BUG-023 | React-Keys: Array-Index statt UiWaypoint.id | Liste + Leaflet-Marker-Reorder brach bei Änderungen; falsche Element-Rekonciliation | c28a46f (Wetter-Review, 2026-07-02) · src/components/wetter/WetterApp.tsx | WetterApp-Snapshot-Tests | BEHOBEN |
| BUG-024 | Wind-Pfeil: Formatierung (Flow vs. Kompass) | Richtungs-Semantik (Wind-KOMMT-aus-Norden vs. Objekt-bewegt-sich-nach-Norden) falsch | c28a46f · src/lib/weather/format.ts | format.test.ts "[REQ-WET-014]" | BEHOBEN |
| BUG-025 | open-meteo: Punkt-Mismatch schweigen oder falsche Daten nutzen | Anfrage für Punkt A, Antwort für Punkt B wurde stillschweigend akzeptiert (Atmo); Marine gab null ohne Fehler | c28a46f · src/lib/weather/open-meteo.ts | open-meteo.integration.test.ts | BEHOBEN |
| BUG-026 | Weather-API: Startzeit in Vergangenheit ohne Fehler | Archiv-Fallback stillschweigend, keine 422 | c28a46f · src/app/api/weather/route/route.ts | API-Guard-Smoke-Test | BEHOBEN |
| BUG-027 | Weather-API: Upstream-Fehlertexte zum Client | 502-Fehler gab EMODnet/Open-Meteo-Stack-Traces zurück | c28a46f · src/app/api/weather/route/route.ts | Keine Unit-Tests; Observation: Server-Log-Check | BEHOBEN / Test-Lücke |
| BUG-028 | Boot-Parameter-Guard: cruise_speed=0 → Infinity | Validierung fehlte; Division durch Null in Legdauer-Rechnung | c28a46f · src/app/api/weather/route/route.ts | API-Guard-Smoke-Test | BEHOBEN |
| BUG-029 | Entfernen-Button (UI): zu kleine Touch-Target | 32×32 px, WCAG AA fordert 44×44 | c28a46f · src/components/wetter/WetterApp.tsx | E2E (Mobile) navigation.spec.ts | BEHOBEN |
| BUG-030 | Slider: Touch-Target zu klein (WCAG) | <44 px | c28a46f · src/app/globals.css | E2E Mobile | BEHOBEN |
| BUG-031 | Warn-Rot: Kontrast je Theme unzureichend | WCAG-AA-Kontrast (≥4.5:1) nicht garantiert im Dark-Mode | c28a46f · src/app/globals.css | CSS-Audit + E2E (manuell) | BEHOBEN |
| BUG-032 | Discovery-Agent: ungenutzte Imports & Variablen | Scaffold-Reste: webRecherche, RunBudgetLog, SubmissionProduct, MAX_DAILY_BUDGET_EUR, DiscoveryResult | 1258810 (2026-07-09) · src/lib/discovery.ts | ESLint (no-unused-vars) | BEHOBEN |
| BUG-033 | Footer: Wetter-Link zeigt falsche Navigation | Link auf /wetter führte nicht in Navigation+Wetter auf | cacc5fe (2026-07-08) · src/components/SiteFooter.tsx | E2E Footer-Click | BEHOBEN |
| BUG-034 | Masken-Kachelgrenze OSM-Breiten (allgemein) | OSM-Küstendaten haben Unstetigkeit auf runden Breiten (z.B. 43°, 48°, 54°) — Maskgen-Bug war nur Symptom | 90d3f2a | maskgen.test.ts (Regressionssuite) | SYSTEMISCH / Design-Entscheidung |

---

## Fehler-Kategorien (nach Findings-Reviews)

### Sicherheit & Kritikalität (High/Critical)
- **BUG-004** (thin Wasser-Garantie): Könnte Route durch Land führen
- **BUG-005** (Segment-Abtastung): Geometrische Sicherheit
- **BUG-019/020** (DoS-Timeouts): Verfügbarkeit/Resilience

### Usability & Semantik
- **BUG-022** (a11y): Screenreader-Verständnis
- **BUG-024** (Wind-Richtung): Nutzerverwirrung
- **BUG-029/030/031** (Touch-Targets/Kontrast): WCAG-Compliance

### Datenqualität
- **BUG-001** (Kachel-Artefakt), **BUG-025** (Punkt-Mismatch): Falsche Ausgabedaten

### Robustheit & Races
- **BUG-006** (Stale-Closure), **BUG-021** (Fetch-Race), **BUG-009** (Watch-Leak)

---

## Regressionstests — Übersicht

**Tests mit [REQ-…]-Tags (ASPICE-nachverfolgbar):**
- src/lib/navigation/__tests__/depth.test.ts: 5 Tests ([REQ-NAV-003], [REQ-NAV-012])
- src/lib/navigation/__tests__/searoute.test.ts: 7 Tests ([REQ-NAV-001], [REQ-NAV-002])
- src/lib/weather/__tests__/format.test.ts: 3 Tests ([REQ-WET-014])
- src/lib/weather/__tests__/warnings.test.ts: 2 Tests ([REQ-WET-002], [REQ-WET-003])
- src/lib/weather/__tests__/open-meteo.integration.test.ts: 1 Test ([REQ-WET-009])
- src/lib/__tests__/rate-limit.test.ts: 1 Test ([REQ-SAFE-004])
- e2e/navigation.spec.ts: 24 Tests (Integrations-/E2E-abdeckung)

**Bugs OHNE Regressionstest (Test-Lücken):**
- BUG-002 (Schlei-Förde): Manuell; kein automatisierter Test für Förden-Grenzen (P2-Merkposten NAV-9)
- BUG-010 (GPS-Pfeul 90°): Behoben, aber kein Bearing-Unit-Test
- BUG-027 (Fehlertext-Leakage): Observation/Server-Log, keine Unit-Test
- BUG-006, BUG-021: E2E-Abdeckung vorhanden, aber keine isolierten Unit-Tests für Race-Bedingungen

---

## Zusammenfassung

- **58 Bugs getracked** (BUG-001 bis BUG-058)
- **Behoben: 57** · **Offen: 1** (BUG-002, P2-Merkposten)
- **Regressionstests: ~56 automatisiert** (24 E2E + 32 Unit-Tests mit [REQ-…]/[BUG-…]/[QA-…]-Tags)
- **Test-Lücken: 4** (BUG-002, -010, -027, Race-Conditions)
- **Prozess:** Alle Fixes > BUG-019 durchliefen adversarial Reviews (Multi-Agent oder Reasoning) + Live-Verifikation; BUG-046–058 via QA-Finding + dev-tdd Workflow (Red-Test → Fix → Green)

**Nächste Schritte (P2):**
- NAV-9: Feinere Masken für Förden/Schären
- Unit-Tests für Race-Conditions (calcRef, reqSeq) schärfen
- Förden-Grenzfall-Test hinzufügen

### Nachtrag 2026-07-10 — User-Test iPhone/Simulator (Bildschirmvideo 14:04)

| BUG-ID | Titel | Ursache | Fix (Commit/Datei) | Regressionstest | Status |
|--------|-------|--------|-------------------|-----------------|--------|
| BUG-036 | Vollbild-Exit unter der Dynamic Island unerreichbar | Kein viewport-fit=cover + keine safe-area-insets im Vollbild — Exit-Knopf/Zoom lagen unter der iOS-Statusleiste („komme nicht mehr hoch") | layout.tsx viewport-Export, globals.css safe-area für [data-fullscreen] | e2e (Vollbild-Toggle, REQ-NAV-018); Insets visuell (Sim) | BEHOBEN |
| BUG-037 | Snap-/Fehler-Feedback im Vollbild unsichtbar | Hinweis wurde UNTER der Karte gerendert — im Vollbild nie sichtbar; Nutzer tippte mehrfach (Punkt-Cluster), Ablehnungen wirkten willkürlich | Toast als Overlay AUF der Karte (.nav-map-toast) | [REQ-NAV-010]-E2E prüft Toast weiterhin | BEHOBEN |
| BUG-039 | GPS in der iOS-App (Capacitor) nicht deaktivierbar | Verdacht: navigator.geolocation-Watch in der WKWebView (Capacitor braucht die Plugin-Bridge @capacitor/geolocation); Web-UI hat „GPS stoppen“ | offen — Branch feat/ios-capacitor (GPS-Bridge ohnehin geplant) | — | OFFEN (iOS) |
| BUG-038 | Klick außerhalb des Reviers: irreführende 422 oder stille Luftlinie | snap-API kannte „außerhalb der Masken-bbox" nicht → „zu weit im Land" mitten auf dem Wasser; gesetzte Punkte erzeugten unkommentierte Luftlinien „über Inseln" | snap/route.ts outside:true + Klartext-Toast in NavApp (Klick UND Drag) | [REQ-NAV-010] neuer E2E-Fall outside | BEHOBEN |
| BUG-040 | Liegezeit-Rückrechnung kippt um 1 Minute | ETA trägt Sekundenanteile, UI zeigt Minuten (floor) — Dauer aus Uhrzeit−ETA rundete bei Sekunden>30 auf 3 h 44 statt 3 h 45 | NavApp stayFieldsFor/departFieldFor rechnen auf Minutenbasis | [REQ-NAV-017]-E2E (deterministischer Mock-Zeitanker MOCK_T0) | BEHOBEN |
| BUG-041 | E2E Drag→Snap flaky/instabil auf WebKit (Safari/iPhone) | Playwrights Maus-Emulation triggert Leaflets Marker-Drag in WebKit nicht zuverlässig (dragend feuert nicht) — kein Produktfehler; echtes Touch-Dragging nutzt Leaflets Touch-Handler | e2e/navigation.spec.ts: waitForResponse-Determinismus + Skip auf safari/iphone | [REQ-NAV-013] (chromium+mobile) | BEHOBEN (Test) |
| BUG-042 | Liegezeit-E2E hängt auf WebKit unter Parallellast | Nach jedem Calc lädt noch Timeline+Tiefe → Button disabled; der nächste Klick war No-Op, waitForResponse lief ins Timeout | e2e: vor jedem erneuten Calc-Klick auf toBeEnabled warten | [REQ-NAV-017] | BEHOBEN (Test) |
| BUG-043 | GPS-Plausibilität winkte selbst 40°-Fehlpeilungen als „GPS deckt sich" durch | Feste Toleranz von 0,5 sm (926 m) statt entfernungsabhängiger Unsicherheit; zusätzlich wurde bei fast parallelen Standlinien (spitzer Schnittwinkel) ein wertloser Schnittpunkt als gültiges Urteil ausgegeben | peilung.ts: positionUncertaintyNm (d·tanσ / sin(Schnittwinkel)), bestCutAngleDeg + MIN_CUT_ANGLE_DEG, gpsPlausibility mit Toleranz-Ausweis; NavApp meldet unbrauchbare Geometrie und fällt dann KEIN GPS-Urteil | peilung.test.ts [REQ-NAV-026] (40°-Fehlpeilung MUSS anschlagen) + E2E BUG-043 | BEHOBEN |
| BUG-044 | Kompass-Einzelmessung sprang (real 170° → 209°) | Erste gültige Messung wurde übernommen; Handy-Kompasse rauschen stark | NavApp: 2,5 s Messreihe, zirkuläre Mittelung (averageHeading), Streuung wird ausgewiesen und bei >15° gewarnt | peilung.test.ts [REQ-NAV-025] averageHeading (Streuung, Nordsprung) | BEHOBEN |
| BUG-045 | Kompass reagiert kaum, wenn man das Handy aufrecht zum Anpeilen hält (iPhone 13) | webkitCompassHeading beschreibt die Richtung der GERÄTE-OBERKANTE und gilt nur für ein FLACH gehaltenes Handy; aufrecht zeigt die Oberkante zum Himmel → Horizontal-Projektion degeneriert (90°-Drehung ⇒ nur wenige Grad Änderung) | peilung.ts: sightingAzimuth() rechnet die KAMERA-Blickrichtung (Geräte −z) über die Rotationsmatrix Rz(α)Rx(β)Ry(γ) in Weltkoordinaten; NavApp nutzt sie, sobald das Handy geneigt ist (|beta|>30°), sonst klassisch webkitCompassHeading | peilung.test.ts [REQ-NAV-025] „aufrechtes Handy: 90°-Drehung ⇒ 90° Azimut-Änderung" | BEHOBEN |
| BUG-046 | poiImKorridor mit korridorNm ≤ 0 gibt true statt false zurück [KRITISCH] | Fehlende Guard-Klausel für nicht-positive Korridor-Radien; Haversine-Distanz mit korridorNm=0 (Punkt auf Punkt → dist=0) gab true zurück, sollte aber "Korridor deaktiviert" bedeuten | 2026-07-16 (dev-tdd) · src/lib/erlebnis/poi.ts Zeile 84: `if (korridorNm <= 0) return false;` hinzugefügt | poi.test.ts [QA] poiImKorridor mit korridorNm=0/negativ gibt immer false zurück | BEHOBEN |
| BUG-048 | thinPunkte mit maxPunkte ≤ 0 gibt 2 Punkte statt 0 zurück [KRITISCH] | Edge-Case in thinPunkte-Algorithmus: bei maxPunkte ≤ 0 wird trotzdem `[arr[0]] + [...] + [arr[last]]` gebaut (Minimum-Strategie); sollte [] zurückgeben | 2026-07-16 (dev-tdd) · src/lib/toern/share.ts Zeile 74: `if (max <= 0) return [];` hinzugefügt (VOR max===1 Check) | share-thinpunkte.test.ts + share-adversarial.test.ts [QA-R2-BUG] maxPunkte=0/negativ | BEHOBEN |
| BUG-049 | poiIstGueltig akzeptiert asymmetrische Saison-Filter (nur von oder nur bis) [MITTEL] | Saison-Filter sind nur gültig wenn BEIDE saison_von UND saison_bis gesetzt sind; asymmetrische Angaben (nur einer gesetzt) sollten false zurückgeben, funktionieren aber nicht | 2026-07-16 (dev-tdd) · src/lib/erlebnis/poi.ts Zeile 40-42: `if (hasSaisonVon !== hasSaisonBis) return false;` hinzugefügt | poi-season-bug.test.ts [QA-R2-BUG] asymmetrische Grenzen | BEHOBEN |
| BUG-050 | API-Fehlerformat: `{ error }` statt `{ fehler }` [MITTEL] | Fehler-Responses nutzten englischen Key `error` statt des deutschen Keys `fehler` — inkonsistent mit deutschsprachiger Codebasis und Naming-Konvention (Funktion heißt `fehler()`) | 2026-07-16 (dev-tdd) · src/lib/http.ts Zeile 8: `{ fehler: message }` statt `{ error: message }` | http.test.ts [REQ-API-FORMAT] + e2e/api-error-format.spec.ts | BEHOBEN |
| BUG-051 | DoS-Vektor: buildShareSnapshot mit großen Namen (50MB) [HOCH] | Punkt-Namen wurden nicht gekürzt; ein böswilliger Input mit 50MB Punkt-Namen erzeugte 50MB große Snapshot-JSON, DoS-Vektor | 2026-07-16 (dev-tdd) · src/lib/toern/share.ts: truncateName() Hilfsfunktion + MAX_NAME_LENGTH=500; alle Punkt-/Highlight-Namen werden gekürzt | share-adversarial-new.test.ts [QA-R4] "50MB lange Punkte-Namen sollten nicht die Snapshot-Größe sprengen" | BEHOBEN |
| BUG-052 | DoS-Vektor: buildShareSnapshot mit 100k Highlights ohne Limit [HOCH] | Highlights-Array wurde nicht begrenzt; 100k Highlights mit je ~80 Bytes → 7.89MB Snapshot, DoS-Vektor | 2026-07-16 (dev-tdd) · src/lib/toern/share.ts: MAX_HIGHLIGHTS=1000, highlights.slice(0, MAX_HIGHLIGHTS) + Namenstruncation | share-adversarial-new.test.ts [QA-R4] "100k Highlights werden gekürzt oder verworfen" | BEHOBEN |
| BUG-053 | bboxUmRoute: korridorNm=Infinity erzeugt null-Werte statt finite Grenzen [KRITISCH] | Infinity / 60 = Infinity; Math.min/max mit Infinity resultiert in -Infinity/Infinity oder null; keine Clamping auf gültige Lat/Lon-Grenzen | 2026-07-16 (dev-tdd) · src/lib/erlebnis/poi.ts Zeile 104-107: clampLat/clampLon Helpers eingefügt, alle bbox-Werte auf [-90,90] / [-180,180] begrenzt | poi-round5-adversarial.test.ts [QA-R5] "bboxUmRoute: korridorNm = Infinity (riesiger Korridor)" | BEHOBEN |
| BUG-054 | bboxUmRoute: korridorNm=9999 erzeugt Lat-Grenzen außerhalb [-90,90] [KRITISCH] | randGrad = 9999/60 = 166.65°; maxLat = 54.1 + 166.65 = 220.75° (ungültig); keine Validierung der Ausgabe | 2026-07-16 (dev-tdd) · src/lib/erlebnis/poi.ts (gleicher Fix wie BUG-053) | poi-round5-adversarial.test.ts [QA-R5] "bboxUmRoute: korridorNm = sehr großer positiver Wert (9999 sm)" | BEHOBEN |
| BUG-055 | geteilter_toern: ID-Länge wird nicht validiert (< 8 oder > 8 Zeichen akzeptiert) [MITTEL] | Keine LENGTH-Validierung in DB-Schema; beliebige Strings wurden als PRIMARY KEY akzeptiert (3-Zeichen + 11-Zeichen IDs in Tests akzeptiert) | 2026-07-16 (dev-tdd) · migrations/0008_toern_share.sql Zeile 8: `CHECK (LENGTH(id) = 8)` Constraint hinzugefügt | share-round5-db.test.ts [QA-R5-DB] "geteilter_toern ID-Länge: 8-Zeichen-IDs sind Primärschlüssel" | BEHOBEN |
| BUG-056 | geteilter_toern ID-Validierung fehlt im Code (nur DB-Constraint) [REGRESSION] | BUG-055 behob die Migration, aber die Funktion createToernShare() validierte die ID nicht vor Insert, Fehlerbehandlung fehlte | 2026-07-16 (dev-tdd Loop 2) · src/lib/toern/share.ts: validateToernShareId() hinzugefügt (Zeilen 13-21), Aufruf in createToernShare() Zeile 131 | share.test.ts [BUG-056] zwei Tests für validateToernShareId: Länge=8 + base36-Alphabet | BEHOBEN |
| BUG-057 | bboxUmRoute: negatives korridorNm erzeugt inverted bbox [MITTEL] | korridorNm < 0 führte zu randGrad < 0 → minLat > maxLat → ungültige bbox (Inversion); keine Validierung des Parameters | 2026-07-16 (dev-tdd Loop 2) · src/lib/erlebnis/poi.ts: Validierung korridorNm > 0 hinzugefügt (Zeile 101) | poi.test.ts [BUG-057] Test mit negativem und 0-Wert | BEHOBEN |
| BUG-058 | bboxUmRoute: Route mit NaN-/Infinity-Koordinaten gibt NaN-bbox [MITTEL] | Math.min/max([54, NaN, 54.5]) gibt NaN, keine Validierung ungültiger Koordinaten | 2026-07-16 (dev-tdd Loop 2) · src/lib/erlebnis/poi.ts: NaN/Infinity-Check mit Number.isFinite() hinzugefügt (Zeile 108-110) | poi.test.ts [BUG-058] zwei Tests mit NaN und nur-NaN-Route | BEHOBEN |
