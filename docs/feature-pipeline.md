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
4. `mvp_2` auf **Staging** deployen — DREI Schritte, der letzte wurde bis
   2026-07-19 vergessen (die Staging-DB hing dadurch 10 Migrationen zurück,
   `/` lieferte 500 wegen fehlender `creator_submissions`):
   ```bash
   rsync -az --delete --exclude .git --exclude node_modules --exclude .next \
     --exclude reports --exclude .env ./ root@194.164.197.23:/srv/jtc-org-staging/repo/
   ssh root@194.164.197.23 'cd /srv/jtc-org-staging/repo && \
     docker compose -p jtc-org-staging -f docker-compose.staging.yml up -d --build'
   # PFLICHT, sonst läuft neuer Code gegen altes Schema:
   ssh root@194.164.197.23 'docker exec jtc-org-staging-web-1 npm run db:migrate'
   ```
   Danach Smoke: Seiten-Status + ein echter DB-Roundtrip (POST/GET `/api/toern/share`).
   Öffentlich auf `:3200` ist Basic-Auth aktiv → 401 ohne Zugangsdaten ist KORREKT.
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

### ERLEDIGT 2026-07-20: gpsPlausibility widersprach sich an der Rundungsgrenze
Gefunden 2026-07-20 durch einen sporadisch roten Property-Test (etwa jeder
20. Lauf). `src/lib/navigation/peilung.ts` gibt `deviation_nm` und `toleranz_nm`
auf zwei Nachkommastellen gerundet aus, faellt das Urteil `plausibel` aber auf
den UNGERUNDETEN Werten. An der Grenze kann die App daher anzeigen
"Abweichung 1,50 sm - Toleranz 1,50 sm" und trotzdem "unplausibel" melden.
Groesse des Effekts: hoechstens 0,005 sm, also rund 9 Meter.

Betreiber-Entscheidung: Urteil auf die gerundeten Werte gestellt. Umgesetzt.
Zur Wahl standen:
- **Urteil auf die gerundeten Werte stellen** - Anzeige und Urteil passen immer
  zusammen, die Warnung wird um bis zu 9 m nachsichtiger. Der bestehende
  Toleranzboden von 0,01 sm (18 m) faengt Rundungsrauschen ohnehin schon ab.
- **So lassen und die Anzeige feiner aufloesen** (drei Nachkommastellen) -
  strenger, aber die Zahlen werden unruhiger.
Der Test prueft jetzt nur noch, was die Funktion wirklich zusichert.

### Übergabe REQ-EXP-005 (Buchten-Windschutz-Ranking)
Reiner Kern gebaut + verifiziert (`src/lib/erlebnis/bucht-schutz.ts`, Flag
`NEXT_PUBLIC_FEATURE_BUCHTEN_RANKING`). Stand der Entscheidungen:
1. **Datenquelle der Öffnungssektoren — ENTSCHIEDEN (User 2026-07-19):** automatische
   Ableitung aus Küstengeometrie/Wassermaske als flächendeckende Basis, darüber
   kuratierte Community-Korrektur für die Fälle, in denen die Geometrie danebenliegt.
   Umsetzung noch offen (Ableitungs-Algorithmus + Korrektur-Datenfeld/-Workflow).
2. **Sektor-Gewichtung — offen:** Soll `oeffnungsbreite_deg` den Score gewichten (der
   ganze Öffnungssektor „exponiert"), oder bleibt es rein richtungsbasiert?
   Aktuell: richtungsbasiert, Breite ist reserviert/ungenutzt (bewusst, s. Code).
Sicherheits-Wording (`WINDSCHUTZ_HINWEIS`, „keine Ankerplatz-Freigabe") ist gesetzt
und muss bei der UI-Verdrahtung in den Footer (in-the-loop-Freigabe).

### Übergabe REQ-EXP-003 (Community-Votum „stimmt noch?") — Wiring offen
Reiner Kern gebaut + verifiziert (`src/lib/erlebnis/community-votum.ts`, Flag
`NEXT_PUBLIC_FEATURE_COMMUNITY_VOTUM`). Regel exakt:
`negativ >= 2 && positiv === 0` → zurückstufen. Offen vor der Verdrahtung:
1. **Vote-Endpoint** (`POST /api/votum`): Auth/Identität nötig? IP-basiert? Doppelstimmen?
   Vorschlag: kein Login, eine Stimme pro Eintrag pro Browser + IP-Rate-Limit.
2. **Zurückstufungs-Aktion:** nur Query-Filter der Empfehlungen (reversibel) ODER
   Status-Mutation `poi.status → "pruefen"` per Job — dann Kadenz + Revert-Regel klären.
   Vorschlag: Query-Filter (reversibel, kein Job, Gegenstimme holt den Eintrag sofort zurück).
3. **Verdrahtung** von `ohneZurueckgestufte` in `listPoisAmKorridor` etc.: automatisch oder opt-in?
   Vorschlag: automatisch.
4. `poi_vote.kommentar` bislang ungenutzt (Kurator-Dashboard-Kandidat).

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
4. [x] F1 — REQ-EXP-005 Buchten-Ranking: reiner Kern + Flag verifiziert, Datenquelle entschieden (Küstengeometrie + kuratierte Community), Sektor-Gewichtung offen ✓ 2026-07-18
5. [x] F2 — REQ-EXP-003 Community-Votum: Regel-Kern + Flag verifiziert, Wiring übergeben ✓ 2026-07-18
6. [x] P4 — depth.ts ins Mutation-Gate + Härtung 75%→86,46% (Kern-Libs gesamt 89,9%); flachwasserCheck voll gedeckt (Rest-Survivor beweisbar äquivalent) ✓ 2026-07-18
7. [x] Integration: alle drei Branches → `mvp_2` gemergt ✓ 2026-07-19
8. [x] REQ-WET-017 Windsymbole umschaltbar (Pfeil ⇄ Windfahne, Wahl gespeichert) ✓ 2026-07-19

## Autolauf-Queue ab 2026-07-20 — MIT PR und Auto-Merge nach `mvp_2`

Entscheidungen des Betreibers vom 2026-07-20 sind eingearbeitet; diese Queue ist
die verbindliche Quelle für die Cloud-Routine. **Pro Lauf GENAU EINE Etappe.**

**Neu gegenüber dem Wochenende:** Die Routine öffnet jetzt eine **Pull Request**
und merged nach **`mvp_2`**, sobald `agentic-gate` grün ist (das Gate läuft auf
ALLEN PRs und fährt dort `chromium + webkit`, also die volle 4-Geräte-Matrix).
`main` bleibt Mensch-Gate. Ist das Gate rot, bleibt die PR offen stehen — lieber
offen als kaputt gemergt.

1. [ ] A1 — **Postgres-Dienst in die CI** (`.github/workflows/agentic-gate.yml`):
   `services: postgres:16` + `DATABASE_URL` + `npm run db:migrate` vor den Tests.
   Schließt die Lücke, dass 21 DB-Tests still übersprungen werden. Zuerst, weil
   es alle folgenden Etappen belastbarer macht.
2. [ ] A2 — **REQ-EXP-005 verdrahten** (Buchten-Windschutz):
   - Öffnungssektor je Bucht **aus der Küstengeometrie ableiten** — die
     Wassermaske und `nearestWaterCell` (`src/lib/navigation/watermask.ts`)
     existieren bereits: rund um die Bucht Richtungen abtasten, offener
     Wassersektor = Öffnung, Mittelrichtung + Breite ableiten. Rein + testbar.
   - **ENTSCHIEDEN:** `oeffnungsbreite_deg` **gewichtet den Score** (der ganze
     Öffnungssektor gilt als exponiert). `windschutzScore` entsprechend
     erweitern, bestehende Tests anpassen, Kommentar/JSDoc mitziehen.
   - Kuratierte Korrektur je Bucht als Datenfeld vorsehen (Community später).
   - UI: Ranking-Liste hinter Flag `NEXT_PUBLIC_FEATURE_BUCHTEN_RANKING`,
     `WINDSCHUTZ_HINWEIS` („keine Ankerplatz-Freigabe") sichtbar im Footer.
3. [ ] A3 — **BUG-002 Schlei läuft zu**: Wassermaske ist mit 1-km-Rasterung für
   enge Förden zu grob (Hafen Kappeln lag im „Land"). Feinere Rasterung oder
   gezielte Nachbearbeitung für schmale Gewässer; Regressionstest mit Kappeln.
4. [ ] A4 — **REQ-NAV-022 Törn-Stil & Tagesetappen (v1)**: zwei Stile —
   „Urlaubstörn" (Ankunft bis 18 Uhr, übernachten, morgens weiter) und
   „Durchfahren" (inkl. Nachtfahrt). Route in Tagesetappen teilen,
   Wunsch-Ankunftszeit → empfohlene Abfahrt (Rückwärtsrechnung über den
   bestehenden Abfahrts-Scan). Reine Logik zuerst, UI danach.

**Bewusst NICHT autonom (Begründung, damit es nicht doch jemand startet):**
- **REQ-EXP-003 Community-Votum** wartet auf ein Konto-System — es gibt in
  KEINEM der beiden Projekte Auth (kein next-auth, keine Nutzertabelle,
  `skipper-login.html` ist eine leere Hülle). Der Betreiber hat entschieden:
  Konto-System wird als **eigenes Projekt geplant** (REQ-AUTH-001, Konzept),
  nicht nachts nebenbei gebaut. Sicherheitskritisch + DSGVO.
- **REQ-EXP-006** baut auf A2 auf → erst danach sinnvoll.
- **REQ-EXP-007 Referral**: Produkt- und Compliance-Entscheidungen offen.
- **REQ-EXP-008 Revier-Wiki**: mehrtägig (Architektur, LLM-Budget, Inhalte).
- **REQ-NAV-027 AR, iOS, Android, NavApp-Refactor**: Kamera/Xcode/Signing bzw.
  zu breiter Diff — lokal mit dem Betreiber.
