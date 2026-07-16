# Feature-Pipeline — gestapelt, dev↔qa-getrieben, bis ~80% dann nächstes

Verbindlicher Ablauf für die inkrementelle Weiterentwicklung. Jedes Feature wird
mit dem [dev↔qa-Loop](.claude/skills/dev-loop/SKILL.md) auf „staging-reif"
gebracht, auf dem Stand des vorigen Features **gestapelt** und auf Staging
gezeigt — dann erst beginnt das nächste. Kein Big-Bang.

## Integrations-Kopf: `mvp_2`

`mvp_2` ist der wandernde Integrations-Branch. Jedes Feature branch't vom
AKTUELLEN `mvp_2` (= „auf dem alten Feature gestaged"), wird gehärtet und
zurück nach `mvp_2` gemerged. `mvp_2` ist immer das, was auf Staging läuft.
Erst wenn der User es freigibt, geht `mvp_2` → `main` (Release).

## „80% / staging-reif" — messbar, kein Bauchgefühl

Ein Feature ist fertig für die nächste Etappe, wenn ALLES gilt:
- `npm run verify` grün (Lint, Typecheck, Unit, `trace`).
- volle **4-Geräte-E2E** grün (chromium, mobile, safari, iphone).
- DB-/Integrations-Features gegen eine **echte** Abhängigkeit verifiziert
  (Postgres in docker), nicht nur geschrieben.
- **keine offenen `kritisch`/`mittel`-Findings** des QA-Agenten.

Die ~20% Rest = verbliebene `gering`-Findings (Politur, seltene Edge-Cases,
Nice-to-have). Die wandern in den **Politur-Backlog** unten und blockieren das
nächste Feature NICHT. Sie werden vor dem `main`-Release abgeräumt.

## Ablauf je Feature (ein Pipeline-Schritt)

1. `git fetch`; Branch `mvp2/<feature>` vom aktuellen `origin/mvp_2`.
2. **dev↔qa-Loop** (`Workflow dev-qa-loop`, `dbSetup:true` bei DB-Features) bis
   zur 80%-Schwelle oder Max-Runden.
3. Bei 80%: `mvp2/<feature>` → `mvp_2` mergen, `mvp_2` pushen.
4. `mvp_2` auf **Staging** deployen (rsync + compose `jtc-org-staging`).
5. Fortschritt + verbliebene `gering`-Findings hier eintragen. **Nicht** auf
   `main`, **nicht** public — das gibt der User frei.
6. Nächstes Feature aus der Queue → zurück zu 1 (branch't vom neuen `mvp_2`).

## Feature-Queue (Reihenfolge, cloud-fähig)

Nur Web-/Backend-Features — iOS/Android brauchen macOS/SDK-Netz und laufen
LOKAL mit dem User, nicht in der Cloud-Routine.

1. [~] Erlebnis-Schicht 2.1–2.4 härten (dev↔qa-Loop läuft) — Basis in `mvp_2`.
2. [ ] REQ-EXP-005 Buchten-Ranking nach vorhergesagter Abend-Windrichtung.
3. [ ] REQ-EXP-003 Community-Bewertung „stimmt noch?" (poi_vote-Auswertung).
4. [ ] REQ-EXP-006 Törn-Vorschläge mit Highlights (Route + POIs + Feste).
5. [ ] REQ-EXP-007 Referral-Monetarisierung (gekennzeichnet, Ranking provisionsfrei).
6. [ ] REQ-EXP-008 Revier-Wiki (LLM-kompilierte Artikel + Linting-Zyklus).
7. [ ] REQ-NAV-022 Törn-Stil & Tagesetappen (Wunsch-Ankunftszeit → Abfahrt).

**Lokal/separat (nicht Cloud-Pipeline):** 2.5 iOS-App (Capacitor, GPS-Bridge,
Simulator-Build), 2.6 Android (TWA/AAB), REQ-NAV-027 AR-Kamera (Premium),
`NavApp.tsx`-Refactor (~1700 Zeilen Clean-Code-Schuld).

## Politur-Backlog (die ~20% je Feature)

_(Pipeline trägt hier die verbliebenen `gering`-Findings je Etappe ein; vor dem
`main`-Release abräumen.)_
