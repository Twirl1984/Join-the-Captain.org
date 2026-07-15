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
- [ ] 2.2 Kurations-Routine
- [ ] 2.3 Erlebnisse an der Route
- [ ] 2.4 Teilbarer Törn-Link
- [ ] 2.5 iOS-App (inkl. BUG-039)
- [ ] 2.6 Android-App (TWA/AAB)

## Nachtlauf-Notizen (Routine „JTC MVP-2 Nachtlauf", ab 2026-07-14 21:00 UTC)

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

**Nächster Schritt:** 2.2 Kurations-Routine (scripts/erlebnis-kuration.ts).
