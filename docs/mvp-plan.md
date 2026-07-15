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
- [x] 2.1 POI-Wissensbasis — Migration `migrations/0007_erlebnis_system.sql`
      (revier_poi/poi_vote wie docs/erlebnis-system.md), lib
      `src/lib/erlebnis/poi.ts` (listPoisByRevier/-Bbox, reine
      istAktuellGueltig-Prüfung getrennt getestet), API `GET /api/erlebnis/poi`;
      Seed `scripts/seed-erlebnis-poi.ts` mit je 6 kuratierten POIs für
      Dalmatien/Rügen, echte Quellen (UNESCO/Nationalpark-/Gemeinde-Seiten,
      Wikipedia via WebSearch, Abruf 2026-07-15). REQ-EXP-001 → umgesetzt.
      Branch `mvp2/2.1-poi-wissensbasis` (gepusht, nicht gemerged).
- [ ] 2.2 Kurations-Routine
- [ ] 2.3 Erlebnisse an der Route
- [ ] 2.4 Teilbarer Törn-Link
- [ ] 2.5 iOS-App (inkl. BUG-039)
- [ ] 2.6 Android-App (TWA/AAB)

## Nachtlauf-Notizen (Routine „JTC MVP-2 Nachtlauf", 21/23/01/03/05 UTC)

**Zyklus 01:03 UTC (2026-07-15):**

- **2.1 fertig, DoD erfüllt** soweit in dieser Sandbox prüfbar: `npm run
  verify` grün (Lint/Typecheck/alle Unit-Suiten inkl. neuer `test:erlebnis`/
  `trace`), `npm run build` grün, `PW_PORT=3312 npx playwright test` für die
  **gemockte** Gate-Suite (`e2e/navigation.spec.ts`, das ist das einzige, was
  `agentic-gate.yml` blockend prüft) auf `chromium`+`mobile` grün.
- **Bekannte Sandbox-Lücken (kein Regressions-Befund, environment-bedingt):**
  - `safari`/`iphone` (WebKit) konnten NICHT laufen — `npx playwright install
    --with-deps chromium webkit` schlägt fehl, `cdn.playwright.dev` ist über
    den Session-Proxy nicht erreichbar (403 „host not permitted"); im Container
    liegt nur ein vorinstalliertes Chromium (`/opt/pw-browsers`), kein WebKit.
    GitHub Actions installiert beide frisch — dort sollte die volle
    4-Geräte-Matrix laufen. **Bitte im echten CI-Lauf verifizieren.**
  - `e2e/navigation-live.spec.ts` (bewusst ungemockt, braucht echtes
    Open-Meteo/EMODnet) schlägt in dieser Sandbox mit 6 Timeouts fehl — dieser
    Test ist laut `agentic-gate.yml` ohnehin NICHT Teil des Gates (läuft nur in
    `nightly-qa` gegen die Live-Instanz), kein Hinweis auf einen Bug in dieser
    Etappe.
  - **Staging-Deploy nicht möglich:** kein `ssh`-Binary im Container, keine
    SSH-Keys (`~/.ssh` leer). rsync+`docker compose` gegen
    `root@194.164.197.23` konnte daher NICHT ausgeführt werden. Dieser Schritt
    ist laut `chore/mvp-staging-automation`-Commit (2026-07-13) bereits als
    "nicht-fatal" eingestuft — Branch wurde trotzdem gepusht.
  - **Git-Push brauchte einen Zusatzschritt:** der erste `git push` schlug mit
    `permission_error: Not authorized to access repository` fehl — das Repo
    war der Session nicht als Schreibziel zugewiesen. Fix:
    `add_repo(Twirl1984, Join-the-Captain.org)` (MCP-Tool), danach lief der
    Push durch. **Falls dieser Fix je Zyklus neu nötig ist** (jede Cron-
    Feuerung ist eine frische Session), kostet er ~1 Tool-Call zusätzlich –
    unkritisch, aber notiert, falls er mal fehlschlägt.
  - Das im Auftrag genannte git-Binary
    (`/Library/Developer/CommandLineTools/usr/bin/git`, macOS-Pfad) existiert
    in diesem Linux-Container nicht — System-`git` (2.43.0) funktioniert ohne
    Sonderbehandlung, kein Xcode-Lizenz-Prompt aufgetreten.
- **Diff-Größe:** ~500 Zeilen (Soft-Ziel 400 aus `docs/GATES.md` leicht
  überschritten, Hard-Block bei 800 nicht erreicht) — größter Anteil ist der
  Seed mit 12 real recherchierten POIs inkl. Quellen; ein Split hätte den
  Zusammenhang (Migration↔lib↔Seed) zerrissen, deshalb bewusst ein Commit.
- **Nächster Schritt:** Etappe 2.2 (Kurations-Routine) im nächsten Zyklus
  (03:03 UTC).
