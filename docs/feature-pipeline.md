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

### Übergabe REQ-EXP-005 (Buchten-Windschutz-Ranking) — Produktentscheidungen offen
Reiner Kern gebaut + verifiziert (`src/lib/erlebnis/bucht-schutz.ts`, Flag
`NEXT_PUBLIC_FEATURE_BUCHTEN_RANKING`, Branch `mvp2/exp-005-buchten`). Vor der
Verdrahtung (UI/API/DB) braucht es zwei Entscheidungen vom Betreiber:
1. **Datenquelle der Öffnungssektoren je Bucht:** (a) automatisch aus Küsten-
   geometrie/Wassermaske ableiten, (b) kuratiertes Feld je Bucht, (c) Community.
2. **Sektor-Gewichtung:** Soll `oeffnungsbreite_deg` den Score gewichten (der
   ganze Öffnungssektor „exponiert"), oder bleibt es rein richtungsbasiert?
   Aktuell: richtungsbasiert, Breite ist reserviert/ungenutzt (bewusst, s. Code).
Sicherheits-Wording (`WINDSCHUTZ_HINWEIS`, „keine Ankerplatz-Freigabe") ist gesetzt
und muss bei der UI-Verdrahtung in den Footer (in-the-loop-Freigabe).

## Wochenend-Autolauf (ab 2026-07-18, in der Chat-Session)

Getrieben aus der Haupt-Chat-Session (eine Engine, nachvollziehbar dort):
jede Etappe läuft als Hintergrund-`dev-qa-loop`; bei Fertigstellung wird die
Session benachrichtigt → verifiziert (eigene Messung, nicht Agenten-Selbstlob)
→ committet → berichtet → startet die nächste Etappe. Heartbeat als Ausfall-
sicherung. Cloud-Pipeline-Routine dafür deaktiviert (kein zweiter Treiber).

**Sicherheitsgeländer:** nie auf `main`, Staging ist die Decke, das deterministische
Gate urteilt, bei unklarer/widersprüchlicher Anforderung STOPP + Übergabe
(REQ-PROC-002), eine Etappe zur Zeit.

**Etappen-Queue (Reihenfolge: erst sicherer Prozess-Ausbau, dann Features):**
1. [x] P1 — peilung.ts Mutation 80,24%→89,92% (25 harte Rest, verifiziert) ✓ 2026-07-18
2. [x] P2 — Property-Tests (fast-check): 23 Invarianten, peilung 89,92%→90,32%, Kern-Libs 91,20% ✓ 2026-07-18
3. [x] P3 — CODEOWNERS für Kern-Libs/Haftungs-Wording/Gates (Ebene-3-Gate) ✓ 2026-07-18
4. [x] F1 — REQ-EXP-005 Buchten-Ranking: reiner Kern + Flag verifiziert (Branch mvp2/exp-005-buchten) ✓ 2026-07-18
5. [x] F2 — REQ-EXP-003 Community-Votum: Regel-Kern + Flag verifiziert (Branch mvp2/exp-003-votum) ✓ 2026-07-18
6. [x] P4 — depth.ts ins Mutation-Gate + Härtung 75%→86,46% (Kern-Libs gesamt 89,9%); flachwasserCheck voll gedeckt (Rest-Survivor beweisbar äquivalent) ✓ 2026-07-18
7. [ ] (weitere Features EXP-006/007/008, NAV-022, F1/F2-Verdrahtung — brauchen Produktentscheidung → STOPP+Übergabe, NICHT autonom gestartet)
