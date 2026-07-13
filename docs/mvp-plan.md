# MVP-Wochenendplan (User-Auftrag 2026-07-10)

**Auftrag:** MVP 1 als Web-Version „zum Appetit machen", MVP 2 vollständig als
iOS- und Android-App — übers Wochenende (11./12.07.) fertigstellen.
Ausführende: Wochenend-Routine (frische Sessions) + ggf. interaktive Sessions.
Prozess verbindlich: `.claude/skills/aspice-istqb-workflow/SKILL.md` (REQ-Tags,
BUGLOG, verify, 4-Geräte-Matrix), `.claude/skills/erlebnis-wissen/SKILL.md`.

## Arbeitsregeln (für die Routine)

**Modell seit 2026-07-13: Staging-Automation.** Die autonome Routine arbeitet
NUR auf Feature-Branches + Staging. Merge auf main und Public-Deploy macht der
User gebündelt nach Review (die erste Routine lief leer, weil headless-Sessions
die dafür nötigen Freigaben nicht erteilen können).

- Je Etappe ein Feature-Branch `mvp/<etappe>`; Definition of Done: verify grün,
  gemockte Playwright-Matrix grün, REQ auf „umgesetzt" + Tests getaggt, BUGLOG
  bei Bugfixes gepflegt. **Branch immer `git push origin mvp/<etappe>`** (Push
  auf Nicht-main ist ungated) — so ist die Arbeit gesichert, auch wenn der
  Staging-Deploy scheitert.
- **Staging-Deploy versuchen, aber NICHT-fatal** (`:3200`, rsync + compose
  jtc-org-staging). Wird er blockiert/scheitert er: im Report vermerken
  („Branch X bereit, Staging-Deploy offen"), NICHT endlos retryen.
- **NIEMALS: Merge/Push auf main, Public-Deploy (jtc-org-test), nginx/
  Credentials/fremde Dienste, Store-Submissions.** Das macht der User.
- Etappen strikt in Reihenfolge; halbfertige Etappen bleiben auf ihrem Branch.
- **Bei Blockern NICHT stumm sterben:** Wenn Setup (clone/npm/git push) scheitert,
  den EXAKTEN Fehler in den Report schreiben und beenden — kein Silent-Retry.
- Jeder Report nennt: erledigte Etappen (Branch-Name), Testzahlen, Bugs
  (BUG-IDs), Blocker, was als Nächstes. Statustafel unten pflegen + committen.

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

> Historie: Die erste (autonome) Wochenend-Routine 11./12.07. lief LEER — headless-
> Sessions können die für Merge/Public-Deploy nötigen Freigaben nicht erteilen.
> Seit 13.07. läuft das Staging-Automation-Modell (siehe Arbeitsregeln oben).

- [x] 1.1 GPX-Export — erledigt 2026-07-10 (Session Fr), auf main + live
- [ ] 1.2 IA-Split
- [ ] 1.3 Jetzt & hier
- [ ] 1.4 Peilung
- [ ] 1.5 Profil-Feld zeitabhängig
- [ ] 2.1 POI-Wissensbasis
- [ ] 2.2 Kurations-Routine
- [ ] 2.3 Erlebnisse an der Route
- [ ] 2.4 Teilbarer Törn-Link
- [ ] 2.5 iOS-App (inkl. BUG-039)
- [ ] 2.6 Android-App (TWA/AAB)
