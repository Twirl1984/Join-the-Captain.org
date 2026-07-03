# Navigation — explorative Test-Sessions (fortlaufend)

Ergänzt die automatisierten Ebenen (57 Unit-/Datenqualitäts-Tests, 22 E2E) um
dokumentierte explorative Funde. Teststrategie: [navigation-app-plan.md](navigation-app-plan.md) §4.

## Session 1 — 2026-07-03 (Erstbau, Sandbox ohne Ausgangs-Netz)

**Setup:** Container ohne Zugang zu Open-Meteo/EMODnet/OpenTopoData (Proxy 403) —
gut geeignet, um alle Offline-/Fehlerpfade real zu erleben.

### Funde (behoben)

1. **Kachelgrenzen-Artefakt in den Wassermasken (kritisch).** Die OSM-Küsten-
   Kacheln stoßen auf runden Breitengraden aneinander (z. B. 43,2°). Fiel eine
   Scanline exakt auf so eine Kante, kippte die Fließkomma-Rundung der Zeilen-
   bereichs-Optimierung (`ceil(95.0000…23) = 96`) — Ergebnis: ein durchgehender
   Land-Streifen quer über die offene Adria, Split war vom Meer "abgeschnitten".
   → maskgen.ts nutzt jetzt eine einzige Wahrheitsquelle (y-Check mit ε-Versatz);
   Regressionstest in maskgen.test.ts; Datenqualitäts-Test (Split→Hvar) grün.
2. **Schlei bei 1 km Auflösung zugelaufen.** Hafen Kappeln lag ohne erreichbare
   Wasserzelle → Einstieg an die Schleimündung verlegt (ehrlicher gegenüber der
   Maskenqualität). Merkposten P2: feinere Masken (OSM-Wasserflächen) für Förden.
3. **react-leaflet wendet `pathOptions.className` nie an** (setStyle ignoriert
   className) → Wolkenfelder hatten keine CSS-Klasse (kein Blur, E2E rot).
   → className als Top-Level-Prop (Erstellungszeit), Opazität weiter dynamisch.

### Geprüfte Grenzfälle (verhalten sich korrekt)

- Wegpunkt tief an Land (Greifswald-Umland) → 422 „Kein Wasserweg … an Land?"
- Kaputtes JSON / 1 Wegpunkt / unbekanntes Revier / lat=999 → 400 mit klarem Text
- Startzeit +30 Tage → 422 (7-Tage-Horizont), Vergangenheit → Archiv-Modus (geerbt)
- Upstream tot (Open-Meteo, EMODnet+GEBCO) → 502 mit freundlicher UI-Meldung,
  kein Stacktrace zum Client (nur Server-Log)
- GPS verweigert → klarer Hinweis statt Endlos-„suche Satelliten"; GPS gestoppt
  → letzter Fix bleibt sichtbar (kein Kartenspringen)
- Start == Ziel, Route komplett im offenen Wasser (Glättung → 2 Punkte),
  getrennte Becken (unreachable), Wegpunkt außerhalb der Revier-bbox (Luftlinie
  mit ehrlicher Kennzeichnung) — alles per Unit-Test festgenagelt
- Binnenrevier ohne Maske (Brombachsee) → Luftlinie + Hinweis, nie stiller Fehler

### Offen / Merkposten

Alle verbliebenen Merkposten sind Tickets in [backlog-navigation.md](backlog-navigation.md)
(NAV-2 Wolkenoptik, NAV-9 Förden, NAV-14 IJsselmeer, …); NAV-1 (Live-Smoke) ist
durch Session 2 erledigt. e2e/wetter.spec.ts braucht echtes Netz (bewusst
ungemockt als Live-Vertrag); e2e/navigation.spec.ts ist vollständig gemockt.

## Session 2 — 2026-07-03 (Live-Verifikation mit echtem Netz, lokal)

**Setup:** Lokaler `next start` mit vollem Internet — holt die in Session 1
offenen Live-Punkte nach.

### Live bestätigt

- **EMODnet-REST antwortet in ~0,2 s** (Adria 84,4 m, Schleimündung 6,2 m — plausibel).
- **Landvermeidung real:** Split → Hvar routet sichtbar durch die Splitska vrata
  (2 Zwischenpunkte, 22 sm); Hafen-Snap „Split (ACI Marina)" greift.
- **A*-Performance:** 63-sm-Route quer durch Dalmatien (9 Punkte) in < 0,1 s.
- **Flachwasser-Check im Watt (Nordfriesland):** „△ knapp: 2 m Tiefe bei 54.612, 8.355"
  an 3 Routenpunkten, inkl. Haftungshinweis — genau das erwartete Verhalten.
- **Playback-Overlay** mit echten Winddaten (8–12 kn Symbole entlang der Route).
- `JTC_WEATHER_LIVE=1`-Suite: 56/56 grün (echte Open-Meteo-Calls).

### Multi-Agent-Review (adversarial, 48 Agenten): 22 Findings → 6 bestätigt → gefixt

| Finding | Fix |
|---|---|
| Fetch ohne Timeout: depth-API, depth.ts-Default, GEBCO-Fallback (DoS-Vektor) | `AbortSignal.timeout(8 s)` je Quelle |
| Wetter-Fetches ohne Timeout (route/departure/timeline/navigation) | zentral in `open-meteo.fetchJson`: 15 s |
| Stale-Fetch-Races: Tiefen-/Timeline-Antworten alter Routen rendern nach Wechsel | `reqSeq`-Token in NavApp; reset()/calculate() invalidieren |
| `radiogroup` mit `aria-pressed`-Kindern (Screenreader-Semantik) | `role="radio"` + `aria-checked` (NavApp + WetterApp) |

16 Findings adversarial widerlegt (u. a. A*-Endpunkt-Dedup, thin()-Randfälle,
Marker-Icon-Updates — react-leaflet setzt Icons bei Prop-Wechsel korrekt).

Nach den Fixes: Unit 50+54 grün · Typecheck 0 · Build ok · E2E 44/44.

## Session 3 — 2026-07-03 (Challenge-Loop: adversariales Review + Architektur-Challenge)

**Setup:** Zwei Reasoning-Agenten haben den Branch gegen das Agentic-Playbook
challengt (Code adversarial mit ausgeführten Repros; Produkt/Architektur gegen
Navionics/PredictWind + Store-Guidelines). 14 Code-Findings, alle geprüft —
Überschneidungen mit Session 2 (reqSeq, Timeouts, ARIA) wurden zusammengeführt,
die Live-validierten Werte (8 s Depth-Timeout) haben gewonnen.

### Kritische Funde (behoben, mit Regressionstests)

1. **Ausdünnen brach die Wasser-Garantie (KRITISCH).** `thin()` warf Punkte der
   geprüften Wasserroute weg, ohne die NEUEN Segmente zu prüfen — Repro: 4 von
   11 Segmenten kreuzten Land, als „wasserweg" markiert. → wassersicheres
   Ausdünnen (Punkt fällt nur, wenn das entstehende Segment im Wasser bleibt);
   Deckel ist jetzt weich, die Garantie hart.
2. **Segment-Abtastung übersah Landecken (HOCH).** Punktweises Sampling in
   halber Zellweite akzeptierte Eck-Schnitte mit kurzer Sehne (~0,5 km Land).
   → exakter Gitter-Traversal (Amanatides-Woo-Supercover), Eck-Durchgänge
   konservativ wie der A*-Diagonalschutz.
3. **Stale-Closure in der Live-ETA (HOCH).** Das 60-s-Interval fror GPS-Position/
   Wegpunkte vom Einschalt-Zeitpunkt ein. → calcRef-Muster.
4. **Expansion sprengte das Sampling-Limit (HOCH).** 25 Wegpunkte × 11 Punkte
   → ~264 Open-Meteo-Locations. → Sampling auf 25 Stützpunkte gedeckelt,
   Routen-Geometrie bleibt voll aufgelöst.
5. **Einzel-Revier-Lauf zerstörte die Masken-Registry (HOCH).** → Registry wird
   aus dem Verzeichnisinhalt generiert.
6. Weitere behobene Funde: Geolocation-Watch-Leak + Zombie-Status, GPS-Pfeil um
   90° verdreht, „Tiefe unbekannt" zählte als ✓ (jetzt Warnkategorie inkl.
   Trockenfall-Hinweis, Abtastdichte ~alle 2 sm, Check läuft automatisch),
   Body-Limit vertraute dem content-length-Header (jetzt echte Länge +
   Rate-Limits 30/min Route, 120/min Depth), nearestWaterCell nahm die erste
   statt der nächsten Zelle, Tiefgang-Eingabe fraß „0.5", Tiefgang > 20 wurde
   still ignoriert (jetzt geklemmt).
7. **Snap-Radius physisch statt in Zellen** (~1,5 km): Fund über den neuen
   Brombachsee-Smoke — Ramsberg lag 1,2 km neben dem groben 1-km-Seepolygon.

### Architektur-/Produkt-Challenge (Kernaussagen → Backlog)

- Offline ist das K.-o.-Kriterium auf See (NAV-4); Gezeiten fehlen für Watt-
  Reviere (NAV-5, bis dahin Warnhinweis je Revier — umgesetzt); Remote-Wrapper
  riskiert Apple-4.2-Ablehnung (NAV-11); Open-Meteo-Kosten ungerechnet (NAV-3).
- DoD-Lücken geschlossen: SPEC.md, CI-Gate (agentic-gate.yml), Feature-Flag
  (NEXT_PUBLIC_FEATURE_NAVIGATION), strukturierte Logs ohne Positionsdaten,
  ESLint als Guardrail, Merkposten → Tickets.
