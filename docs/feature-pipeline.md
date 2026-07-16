# Feature-Pipeline — gestapelt, dev↔qa-getrieben, bis ~80% dann nächstes

Verbindlicher Ablauf für die inkrementelle Weiterentwicklung. Jedes Feature wird
mit dem dev↔qa-Loop ([dev-tdd](.claude/skills/dev-tdd/SKILL.md) +
[qa-adversarial](.claude/skills/qa-adversarial/SKILL.md)) auf „staging-reif"
gebracht, auf dem Stand des vorigen Features **gestapelt** und auf Staging
gezeigt — dann erst beginnt das nächste. Kein Big-Bang.

**Cloud-Container-Grenze:** kein docker/ssh hier. Jeder Cloud-Lauf liefert nur
einen **Entwurf** (Logik testgetrieben + gemockter E2E auf chromium+mobile)
auf `mvp2/<feature>` — ohne Merge nach `mvp_2`. DB-Verify, 4-Geräte-Matrix und
Merge/Staging (3./4. unten) holt der lokale Schritt (docker+ssh) nach.

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

1. [x] Erlebnis-Schicht 2.1–2.4 härten — konsolidiert in `mvp_2` (Commits `65a11e3`, `c927350`: BUG-046..058 gefixt).
2. [~] REQ-EXP-005 Buchten-Ranking nach Abend-Windrichtung — Entwurf fertig, Branch `mvp2/exp005-buchten-wind-ranking` (nicht gemergt). Status-Eintrag unten.
3. [ ] REQ-EXP-003 Community-Bewertung „stimmt noch?" (poi_vote-Auswertung).
4. [ ] REQ-EXP-006 Törn-Vorschläge mit Highlights (Route + POIs + Feste).
5. [ ] REQ-EXP-007 Referral-Monetarisierung (gekennzeichnet, Ranking provisionsfrei).
6. [ ] REQ-EXP-008 Revier-Wiki (LLM-kompilierte Artikel + Linting-Zyklus).
7. [ ] REQ-NAV-022 Törn-Stil & Tagesetappen (Wunsch-Ankunftszeit → Abfahrt).

**Lokal/separat (nicht Cloud-Pipeline):** 2.5 iOS-App (Capacitor), 2.6 Android (TWA/AAB), REQ-NAV-027 AR-Kamera (Premium), `NavApp.tsx`-Refactor (~1700 Zeilen Clean-Code-Schuld).

## Status je Etappe

### 2. REQ-EXP-005 Buchten-Ranking nach Wind — Entwurf 2026-07-16 (Cloud-Lauf)

Branch `mvp2/exp005-buchten-wind-ranking` (von `origin/mvp_2` @ `c927350`), **nicht gemergt**.

**Fertig:** `src/lib/erlebnis/bucht-ranking.ts` — reine Ranking-Logik, kein I/O (Wetter-Sampler injiziert wie `route-forecast.ts`): `windSektorAusGrad`, `parseWindschutzSektoren`, `beurteileWindschutz`, `rankeBuchtenNachAbendwind` (geschützt → unbekannt → exponiert, stabil, filtert `typ='bucht'`). 20 Unit-/Adversarial-Tests (`[REQ-EXP-005]`/`[QA]`), inkl. Grad-Wrap-Around, Sektorgrenzen, kaputte `windschutz_sektoren`-Strings. Ein Fund im Loop selbst gefixt: NaN/Infinity vom Sampler fiel ohne Guard fälschlich auf „exponiert" statt „unbekannt" (Sicherheits-Asymmetrie). `npm run verify` + `build` grün; `e2e/navigation.spec.ts` (gemockt) grün auf **chromium+mobile** (72/72) — **safari/iphone (WebKit) in diesem Container nicht ladbar**, ehrlich offen. REQUIREMENTS.md: Status `in-arbeit` (bewusst nicht `umgesetzt`).

**Offen für den lokalen Schritt (docker+ssh):** API-Endpunkt + UI-Anbindung im Törnplaner (bewusst nicht in diesem Lauf, Diff-Rahmen + braucht echten Server/reale POI-Daten), DB-Verifikation sobald der Endpunkt existiert, volle 4-Geräte-E2E (safari+iphone ergänzen), Merge → `mvp_2` → Staging, erst danach Status → `umgesetzt`.

**Politur-Backlog:** keine neuen `gering`-Findings — die offenen Punkte oben sind Scope-Rest (API/UI/DB/Staging), kein Politur-Fall.

## Politur-Backlog (die ~20% je Feature)

_(Pipeline trägt hier die verbliebenen `gering`-Findings je Etappe ein; vor dem
`main`-Release abräumen.)_
