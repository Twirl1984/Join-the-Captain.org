# MVP-Wochenendplan (User-Auftrag 2026-07-10)

**Auftrag:** MVP 1 als Web-Version „zum Appetit machen", MVP 2 vollständig als
iOS- und Android-App — übers Wochenende (11./12.07.) fertigstellen.
Ausführende: Wochenend-Routine (frische Sessions) + ggf. interaktive Sessions.
Prozess verbindlich: `.claude/skills/aspice-istqb-workflow/SKILL.md` (REQ-Tags,
BUGLOG, verify, 4-Geräte-Matrix), `.claude/skills/erlebnis-wissen/SKILL.md`.

## Arbeitsregeln (für die Routine)

- Je Etappe ein Feature-Branch `mvp/<etappe>`; Definition of Done: verify grün,
  gemockte Playwright-Matrix grün, `qa-weekend` gegen Staging grün, REQ auf
  „umgesetzt" + Tests getaggt, BUGLOG bei Bugfixes gepflegt.
- **Staging zuerst** (`:3200`, rsync + compose jtc-org-staging).
- **Merge auf main + Public-Deploy sind ERLAUBT** (User-Freigabe 2026-07-10
  „übers WE fertig machen"), aber NUR bei 100 % grünem DoD; im Zweifel Branch
  stehen lassen und im Report übergeben. Nie: nginx/Credentials/andere Server-
  Dienste anfassen. Das CI-Gate auf main ist das letzte Netz.
- Etappen strikt in Reihenfolge; halbfertige Etappen NICHT mergen.
- Jeder Report nennt: erledigte Etappen, Bugs (BUG-IDs), was als Nächstes.

## MVP 1 — Web („Appetit machen")

| # | Etappe | Inhalt | REQ |
|---|---|---|---|
| 1.1 | GPX-Export | Route als GPX herunterladen (Button im Ergebnis) | NAV-021 |
| 1.2 | IA-Split | Schlanker Törnplaner (Karte+Punkte+Berechnen+Profil sichtbar); Abfahrts-Scan, Zeitreise, Boot, Feedback als eingeklappte Sub-Tools/Tabs; Leitfaden docs/ux-konzept.md §2. E2E: bestehende testids MÜSSEN erreichbar bleiben (Tabs im Test öffnen). | NAV-024 |
| 1.3 | „Jetzt & hier" | Eigener Bereich ab GPS-Position: aktuelles Wetter am Ort, nächste Häfen, Tiefe unterm Kiel (bestehende APIs) | NAV-024 |
| 1.4 | Peilung | Kompass-Peilung + Kreuzpeilung + GPS-Plausibilisierung nach docs/peilung.md (Fehlerband, Missweisung, Safety-Wording; Heading injizierbar für Tests) | NAV-025/026 |
| 1.5 | Profil-Feld zeitabhängig | A*-Kosten je Kante zur geschätzten Durchfahrtszeit (Zeit-Schätzung über Distanz/heuristicSpeed vom Start aus; Sampler-Fenster beachten) | NAV-023 |

## MVP 2 — Erlebnis-Basis, vollständig als iOS-/Android-App

| # | Etappe | Inhalt | REQ |
|---|---|---|---|
| 2.1 | POI-Wissensbasis | Migration revier_poi/poi_vote (docs/erlebnis-system.md), lib + API (list nach Revier/bbox, status='live'), Seed: je Pilot-Revier (Dalmatien, Rügen) 5–8 kuratierte POIs mit ECHTEN Quellen (Overpass/Wikipedia — Rechts-Leitplanken im Skill!) | EXP-001 |
| 2.2 | Kurations-Routine | Script scripts/erlebnis-kuration.ts (append-and-review: Inbox→Review→live/archiviert; research_log-Muster); als Cron auf dem VPS neben qa-smoke | EXP-002 |
| 2.3 | Erlebnisse an der Route | POIs im Korridor um den gerouteten Wasserweg in der Ergebnis-Ansicht (+ Karte), Saison-/Gültigkeitsfilter | EXP-004 |
| 2.4 | Teilbarer Törn-Link | Route serialisieren (URL-Param oder Kurz-ID in DB), read-only-Ansicht mit Karte + Highlights | EXP-009 |
| 2.5 | iOS-App | feat/ios-capacitor aktualisieren: GPS-Plugin-Bridge (behebt BUG-039), App-Icons aus public/icons, Simulator-Build grün (SPM-Build-Kommando in docs/ios-portierung.md) | — |
| 2.6 | Android-App | TWA-Paket per @bubblewrap/cli gegen https://join-the-captain.org (Manifest existiert); AAB lokal bauen; assetlinks bleibt TEMPLATE bis Play-Konto existiert | — |

**Bewusst NICHT am WE:** Store-Submissions (brauchen User-Konten), REQ-NAV-022
(Tagesetappen — nach MVP 1/2), EXP-003/005/006/007/008.

## Statustafel (von der Routine pflegen!)

- [x] 1.1 GPX-Export — erledigt 2026-07-10 (Session Fr)
- [x] 1.2 IA-Split — GPS/Boot/Abfahrts-Scan als einklappbare Sub-Tools; Branch mvp/ia-split (Zeitreise/Feedback bleiben kontextuelle Ergebnis-Karten)
- [x] 1.3 Jetzt & hier — Sub-Tool ab GPS-Position: aktuelles Wetter (/api/weather/now), Tiefe unterm Kiel, 3 nächste Häfen; Branch mvp/jetzt-hier
- [x] 1.4 Peilung — Kreuzpeilung (2–3 kartierte Objekte, Kompass-Capture, Missweisung editierbar) + GPS-Plausibilitätswarnung; Branch mvp/peilung; Objekt-Wahl per Hafen-Dropdown ODER freiem Kartenklick (mvp/peilung-map)
- [x] 1.5 Profil-Feld zeitabhängig — A*-Kanten werden mit dem Wetter zur geschätzten Durchfahrtszeit bewertet (elapsedH über die Kosten, Segment-Offset); Branch mvp/profil-zeit
- [x] 2.1 POI-Wissensbasis — Migration `0007_erlebnis_poi.sql` (revier_poi/poi_vote, UUID-PKs statt BIGSERIAL-Entwurf, CHECK-Constraints), `src/lib/erlebnis/poi.ts` (reine Saison-/Gültigkeits-/Bbox-Filterlogik + `listRevierPois`), `GET /api/erlebnis/poi`, Seed `scripts/seed-erlebnis-poi.ts` mit 12 ECHT recherchierten POIs (6× Rügen, 6× Dalmatien, Wikipedia/Wikidata-Quellen, Abrufdatum 2026-07-15). REQ-EXP-001 → umgesetzt. Branch `mvp2/poi-wissensbasis`. **Offener Punkt:** typ='bucht'/'versorgung' (Windschutz-Sektoren, Liegeplatz-Details) bewusst NICHT befüllt — braucht Segelrevier-Fachquellen (Navily & Co., "Lizenz vor Eigenbau"), Aufgabe für die Kurations-Routine (2.2).
- [x] 2.2 Kurations-Routine — `src/lib/erlebnis/kuration.ts` (reine Entscheidungslogik: Review-Fälligkeit 6-Monats-Deckel, Event-Ablauf, Auto-Publish-Guardrail Confidence+Erreichbarkeit) + `scripts/erlebnis-kuration.ts` (Review-Zyklus älteste-zuerst + Entwurf-Promotion, HTTP-Erreichbarkeits-Check mit injizierbarem fetch). REQ-EXP-002 → umgesetzt. Branch `mvp2/kurations-routine` (auf `mvp2/poi-wissensbasis` aufbauend). Community-Votes (REQ-EXP-003) bewusst NICHT enthalten — für MVP2 ausgeklammert. Kein UI-Anteil → E2E-Matrix laut ISTQB-Tabelle nicht pflichtig (in 2.1 bereits als Regressions-Check gelaufen, hier nicht wiederholt, da keine navigation-/wetter-nahen Dateien geändert wurden). Skript selbst NICHT gegen eine echte DB gelaufen (Umgebungslücke s. u.).
- [x] 2.3 Erlebnisse an der Route — Korridor-Filter `poiImKorridor`/`bboxUmRoute`/`listPoisAmKorridor` (Vertex-Näherung über die geteilte `haversineNm`-Basis, kein zweiter Routing-Stack), `GET /api/erlebnis/poi` um `route=lat,lon;...&korridorNm=` erweitert, neues Sub-Tool „Erlebnisse entlang der Route" im Ergebnis-Bereich von `/navigation` (Liste + Kartenmarker in `NavMap.tsx`, manuell geladen). REQ-EXP-004 → umgesetzt. Branch `mvp2/erlebnisse-route` (auf `mvp2/kurations-routine` aufbauend). E2E `[REQ-EXP-004]` neu in `e2e/navigation.spec.ts`, 76/82 auf chromium+mobile grün (6 bekannte netzabhängige Fehlschläge in navigation-live.spec.ts, unverändert). **Bewusste Vereinfachung:** kein Auto-Trigger direkt nach der Routenberechnung (anders als der Tiefen-Check) — Nutzer klickt „Erlebnisse laden", um die bestehende `reqSeq`/Timeline/Tiefen-Sequenzierung in `NavApp.tsx` nicht anzufassen (Risiko/Zeit-Abwägung im Nachtlauf).
- [x] 2.4 Teilbarer Törn-Link — Migration `0008_toern_share.sql` (Kurz-ID `geteilter_toern`), `src/lib/toern/share.ts` (reine ID-/Snapshot-Logik + DB), `POST /api/toern/share` + `GET /api/toern/share/:id`, read-only Seite `/toern/[id]` (Vogelperspektive-Karte `ToernShareMap` + Highlights-Liste), „Törn teilen"-Knopf im Ergebnis-Bereich. REQ-EXP-009 → umgesetzt. Branch `mvp2/toern-share` (auf `mvp2/erlebnisse-route` aufbauend). E2E `[REQ-EXP-009]` (Knopf→Link) neu, 78/84 auf chromium+mobile grün (6 bekannte netzabhängige Fehlschläge, unverändert). **Nicht E2E-getestet:** die `/toern/[id]`-Seite selbst (Server Component mit direktem DB-Zugriff, nicht über gemockte `page.route` erreichbar) — ungetestet in diesem Container mangels DB, siehe Umgebungs-Notiz unten.
- [ ] 2.5 iOS-App (inkl. BUG-039) — **BLOCKIERT in diesem Container:** kein Xcode/macOS vorhanden (`xcodebuild`/`swift` nicht installiert, Linux-Container). Ein Simulator-Build ist von hier aus kategorisch nicht möglich — braucht einen macOS-Runner. Nicht versucht/nicht angefasst (feat/ios-capacitor unverändert), keine Ratearbeit.
- [ ] 2.6 Android-App (TWA/AAB) — **BLOCKIERT in diesem Container:** der Netzwerk-Proxy lässt sowohl `https://join-the-captain.org` (Manifest-Quelle für `bubblewrap init`) als auch `https://dl.google.com` (Android-SDK/Build-Tools-Repository) NICHT durch (beide CONNECT-Tunnel mit 403 abgelehnt, geprüft per curl). Ohne SDK-Download ist „AAB lokal bauen" nicht möglich, unabhängig vom TWA-Setup selbst. npm-Registry (für `@bubblewrap/cli` selbst) ist erreichbar, das SDK/Gradle-Toolchain-Download aber nicht. Nicht versucht/nicht angefasst. **Zum Entsperren:** entweder Proxy-Freigabe für `dl.google.com`/`join-the-captain.org` in dieser Umgebung, oder Etappe in einer Umgebung mit vollem Netzzugang fortsetzen.

## Nachtlauf-Notizen (Routine „JTC MVP-2 Nachtlauf", ab 2026-07-14 21:00 UTC)

**⚠️ WICHTIG — bitte morgens zuerst lesen: doppelte 2.1-Umsetzung + Session-Erkenntnis**

Der Zyklus um 01:03 UTC hat REQ-EXP-001 (POI-Wissensbasis) bereits UNABHÄNGIG
umgesetzt und auf Branch `mvp2/2.1-poi-wissensbasis` gepusht — **bevor** dieser
03:04-UTC-Zyklus begann. Dieser Zyklus hatte davon KEINE Kenntnis (leeres
`docs/mvp-plan.md` beim frischen Klon von `main`, wie erwartet, da Feature-
Branches nie gemergt werden) und hat REQ-EXP-001 daraufhin EIGENSTÄNDIG NOCH
EINMAL gebaut, auf `mvp2/poi-wissensbasis`. **Zwei unabhängige, NICHT
kompatible Implementierungen existieren jetzt:**

| | `mvp2/2.1-poi-wissensbasis` (01:03 UTC) | `mvp2/poi-wissensbasis` (dieser Zyklus, 03:xx UTC) |
|---|---|---|
| Migration | `0007_erlebnis_system.sql`, `BIGSERIAL`-PKs, **kein** `IF NOT EXISTS` auf `CREATE TABLE` | `0007_erlebnis_poi.sql`, `UUID`-PKs (`gen_random_uuid()`), `IF NOT EXISTS` |
| Typen | lokal in `poi.ts` definiert, `id: number` | in `src/lib/types.ts` (Codebase-Konvention), `id: string` |
| Umfang | nur 2.1 (List by Revier/Bbox) | 2.1 **+ 2.2 (Kuration) + 2.3 (Korridor-Filter+UI) + 2.4 (Törn-Link)** bauen direkt darauf auf |

**Beide Migrationsdateien heißen `0007_*`, unterschiedlicher Dateiname — kein
Versionskonflikt in `scripts/migrate.ts`, ABER beide legen `revier_poi`/
`poi_vote` an; würden beide angewendet, bricht die zweite (die ohne
`IF NOT EXISTS`) mit „relation already exists". Nicht beide Branches
anwenden.** Meine Folge-Etappen (2.2–2.4) sind gegen MEINE Version gebaut
(nutzen u. a. `listPoisAmKorridor`/`bboxUmRoute`/`listReviewFaelligePois`, die
im 01:03-Branch nicht existieren) — sie lassen sich nicht ohne Weiteres auf
die andere Version umstöpseln. **Empfehlung (keine Entscheidung, nur
Vorschlag):** `mvp2/poi-wissensbasis` → `kurations-routine` → `erlebnisse-route`
→ `toern-share` als zusammenhängende Linie behalten (funktional vollständiger,
UUID passt zum Rest der Codebase, z. B. `feature_request`/`affiliate_tool`
nutzen ebenfalls `UUID`), `mvp2/2.1-poi-wissensbasis` verwerfen oder als
Referenz für abweichende Seed-Recherche danebenlegen — **User entscheidet.**

**Warum das passiert ist:** Trotz der Tool-Beschreibung „fires into THIS
SESSION, resuming the same conversation" bestätigen die eigenen Notizen des
01:03-Zyklus explizit: „jede Cron-Feuerung ist eine frische Session" (dort im
Kontext des `add_repo`-Fixes vermerkt). Das deckt sich mit der Erfahrung
dieses Zyklus — kein Gedächtnis an 21:00/23:00/01:00 UTC. Für den 05:03-Lauf
heißt das: er wird vermutlich EBENFALLS frisch von `main` klonen und hat ohne
Weiteres KEINE automatische Kenntnis der Nacht-Fortschritte auf den
Feature-Branches. Empfehlung für den 05:03-Zyklus (bzw. für den User): vor dem
Gesamtbericht `git ls-remote --heads origin | grep mvp2` prüfen und die
Branch-`docs/mvp-plan.md`-Stände lesen, nicht nur den `main`-Stand.

**Umgebungs-Einschränkungen dieses Containers (gelten für ALLE Zyklen heute Nacht):**
- **Kein `ssh`/`rsync` im Container** — Schritt „Staging aktualisieren" (rsync +
  `docker compose … up -d --build` auf root@194.164.197.23) ist von hier aus
  technisch nicht ausführbar. Migration/lib/API/Seed sind fertig und commitet,
  aber NICHT auf `:3200` sichtbar. Muss manuell oder aus einer Umgebung mit
  SSH-Zugriff nachgeholt werden.
- **Keine lokale/erreichbare Postgres-DB** (kein `docker`-Daemon, keine
  `DATABASE_URL`) — Migration und Seed-Script sind geschrieben, folgen den
  bestehenden Konventionen (`scripts/migrate.ts`/`scripts/seed.ts`-Muster),
  konnten aber in diesem Lauf NICHT gegen eine echte DB ausgeführt/verifiziert
  werden. `npm run verify` prüft das nicht (DB-Pool ist lazy, bricht den Build
  nicht) — die Migration bitte vor dem ersten Staging-Deploy einmal gegen
  `:3200` mit `npm run db:migrate && npm run db:seed:erlebnis` gegenprüfen.
- **WebKit (Safari/iPhone-Projekte) nicht lauffähig** — kein gecachtes WebKit-
  Binary unter `/opt/pw-browsers`, `npx playwright install webkit` schlägt fehl
  (Proxy blockt `cdn.playwright.dev`, „host not permitted"). Die 4-Geräte-
  Matrix aus dem DoD ist hier nur zu 2/4 prüfbar (`chromium`, `mobile`, via
  `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`). `safari`/`iphone` bleiben für
  jeden Etappen-Report heute Nacht ungeprüft — kein Codefehler, reine
  Umgebungslücke dieses Containers.
- Das ebenfalls vorinstallierte Chromium (`chromium-1194`) passt nicht zur im
  Projekt gepinnten `@playwright/test`-Version (erwartet Revision 1228) —
  Tests liefen nur über den bereits vorhandenen `PW_CHROMIUM_PATH`-Hook in
  `playwright.config.ts`, keine Config-Änderung nötig/vorgenommen.
- `git`-Binary lag NICHT unter dem im Auftrag genannten macOS-Pfad
  (`/Library/Developer/CommandLineTools/usr/bin/git`, existiert hier nicht) —
  Linux-`git` unter `/usr/bin/git` verwendet, funktional identisch.

**2.1 DoD-Status:** `npm run verify` grün (Lint, Typecheck, alle Unit-Suiten
inkl. neu `test:erlebnis`, `trace` grün). `npm run build` grün. E2E: 74/80 auf
`chromium`+`mobile` grün, 6 Fehlschläge ausschließlich in
`navigation-live.spec.ts` (braucht echtes Netz zu Open-Meteo, lt. CLAUDE.md
bekannt netzabhängig — unverändert durch diesen Branch, keine Regression).
`safari`/`iphone` ungeprüft (s. o.). Kein UI-Feature in 2.1 → laut
ISTQB-Tabelle (aspice-istqb-workflow/SKILL.md) ist E2E hier ohnehin nicht
pflichtig; als Regressions-Check trotzdem gelaufen.

**Diff-Größe 2.1:** ~638 Zeilen (ohne Lockfile/generierte TRACEABILITY.md) —
über dem 400-Zeilen-Zielwert aus docs/GATES.md, unter dem blockenden 800er-
Limit. Haupttreiber: `scripts/seed-erlebnis-poi.ts` (240 Zeilen, überwiegend
Datensätze der 12 recherchierten POIs, kein Logik-Code). Vor einem echten PR
ggf. in „Migration+lib+API+Tests" und „Seed-Daten" aufteilen, wenn ein
Reviewer das wünscht — heute Nacht bewusst als ein Commit belassen, um den
Zyklus nicht zu verlängern.

**Diff-Größe 2.4:** ~467 Zeilen (ohne Lockfile/generierte TRACEABILITY.md) —
etwas über dem 400-Zeilen-Zielwert, unter dem blockenden 800er-Limit.
Migration+lib+2 API-Routen+Seite+Map-Komponente+Knopf+Tests bilden ein
zusammenhängendes Feature; bei Bedarf vor einem PR in „Backend (Migration+
lib+API)" und „Frontend (Seite+Map+Knopf)" aufteilbar.

**Nächster Schritt:** 2.5 und 2.6 sind beide in diesem Container blockiert
(Details oben in der Statustafel) — geprüft und sauber dokumentiert, nicht
geraten oder simuliert. MVP2 2.1–2.4 sind vollständig umgesetzt und auf
separaten Branches gepusht (mvp2/poi-wissensbasis → mvp2/kurations-routine →
mvp2/erlebnisse-route → mvp2/toern-share, jeweils aufeinander aufbauend).
Für 2.5/2.6 braucht es entweder einen macOS-Runner (iOS) oder eine Umgebung
mit Netzzugang zu dl.google.com + der Live-Domain (Android) — das entscheidet
der User morgens.
