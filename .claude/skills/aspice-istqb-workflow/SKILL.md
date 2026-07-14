---
name: aspice-istqb-workflow
description: Verbindliches Entwicklungs-Vorgehen dieses Repos nach ASPICE/ISTQB — Requirements-IDs, Traceability-Gate, Verifikationsschleifen, Widerspruchs-Regel. Bei JEDER Feature-/Fix-Arbeit in diesem Projekt anwenden.
---

# ASPICE/ISTQB-Workflow — Join the Captain (.org)

Verbindliches Vorgehen für alle Feature- und Fix-Arbeiten (User-Auftrag 2026-07-06).
Anforderungskatalog: `docs/REQUIREMENTS.md` · Matrix: `docs/TRACEABILITY.md` (generiert)
· Teststufen-Referenz: `docs/weather-test-plan.md`.

## Ablauf je Anforderung (SWE.1 → SWE.6 light)

1. **Anforderung erfassen:** Neue/geänderte Anforderung als `REQ-<BEREICH>-<NNN>`
   in `docs/REQUIREMENTS.md` eintragen (Bereiche: NAV, WET, SAFE, PROC; Titel,
   1–3 Sätze, Quelle, Status `in-arbeit`). Nichts bauen, was dort nicht steht.
2. **Widerspruchs-Regel (REQ-PROC-002):** Widerspricht die Anforderung einer
   bestehenden, ist sie mehrdeutig oder kollidieren Features →
   **STOPP und konkrete Rückfrage an den User** (AskUserQuestion mit klaren
   Optionen). Niemals still entscheiden; die Entscheidung im Requirement
   dokumentieren („Quelle: User-Entscheid <Datum>").
3. **Tests zuerst/parallel:** Verifizierende Tests schreiben (Unit `node:test`
   in `src/lib/<feature>/__tests__/`, E2E in `e2e/<feature>.spec.ts`).
   **Jeder Test-Titel trägt den Tag `[REQ-XXX-NNN]`** — das ist die Traceability.
4. **Implementieren:** Geteilte Module wiederverwenden (`src/lib/weather/` ist
   die geteilte Basis für /wetter UND /navigation — keine Logik-Dopplung).
   Reine Logik ohne I/O, Sampler/fetch injizieren (Testbarkeit).
5. **Verifikationsschleifen bis grün (REQ-PROC-003):**
   `npm run verify` (Lint + Typecheck + alle Unit-Suiten + **`npm run trace`**)
   und `PW_PORT=3311 npm run test:e2e`. Kein Push mit bekannten Rotmeldungen.
6. **Review:** Bei größeren Diffs (>~300 Zeilen oder sicherheitsrelevant)
   adversarialer Multi-Agent-Review (Findings von 2 Skeptikern verifizieren,
   nur Bestätigtes fixen) — Muster: docs/navigation-test-notes.md.
7. **Abschluss:** Status im Requirement auf `umgesetzt`, `npm run trace`
   regeneriert die Matrix, explorative Funde in die test-notes, Commit
   (deutsch, mit REQ-IDs im Text) auf den Feature-Branch, Staging-Deploy
   (`:3200`, docker-compose.staging.yml) → User-Abnahme. Kein Merge auf main
   und kein Public-Deploy ohne User-OK.

## ISTQB-Teststufen (Pflichtabdeckung je Feature)

| Stufe | Werkzeug | Pflicht |
|---|---|---|
| Unit (reine Logik) | node:test + tsx | ja, mit REQ-Tag |
| Integration (echte Upstreams) | env-gated (`JTC_WEATHER_LIVE=1`) | bei neuen Datenquellen |
| API/System | curl-Smokes + gemockte E2E-Routen | bei neuen/geänderten APIs |
| E2E Browser | Playwright (Chromium + Mobile) | bei UI-Änderungen |
| Explorativ | Session mit dokumentierten Funden | bei neuen Features |

## Sicherheits-Leitplanken (immer)

- /wetter und /navigation sind **Planungshilfen** — jeder neue Text/Screen
  respektiert REQ-SAFE-001/002 (nicht als Navigationsmittel zugelassen).
- Warnlogik-Änderungen: FN (verpasste Warnung) wiegt schwerer als FP —
  Änderungen gegen den Backtest (REQ-WET-013) prüfen.
- Externe Fetches: Timeout + kein Fehlertext-Leak (REQ-SAFE-003).

## Device-Matrix (REQ-PROC-004, seit 2026-07-10)

E2E laufen über **vier Projekte**: `chromium`, `mobile` (Pixel 7), `safari`
(Desktop Safari), `iphone` (iPhone 14). WebKit-Fallstricke, die uns real
getroffen haben:

- **`page.route()` greift NICHT bei Service-Worker-kontrollierten Requests** —
  die WebKit-Projekte laufen mit `serviceWorkers: "block"`; der SW-Offline-Test
  ist per `test.skip(browserName !== "chromium")` begrenzt. Symptom, wenn man
  es vergisst: Tests laufen unbemerkt gegen die ECHTE API (echte Wetterwerte
  statt Mock-Daten im Snapshot).
- iOS-Safari zoomt in Inputs mit `fontSize < 16px` — alle Eingabefelder
  mindestens 16 px / 44 px Touch-Ziel.

## Validierung gegen echte Daten (scripts/qa-weekend.ts)

- Referenz-Routen in `fixtures/qa-routes.json`: Erwartungs-Korridore werden
  beim ersten Lauf **kalibriert** (Golden-Werte), nie frei geschätzt.
- **Keine unverifizierbaren Fakten** in Fixtures (z. B. benannte Stürme aus
  Agenten-Gedächtnis): Archiv-Checks kalibrieren sich selbst aus derselben
  Messquelle (windigster Tag aus dem Open-Meteo-Archiv → Warnungen erwartet).
- QA-Läufe drosseln (Rate-Limit der eigenen App respektieren, 429-Backoff).
- Läufe gegen Staging (`:3200`, Basic-Auth) UND Live; Exit-Code 1 bei FAIL.

## Bug-Historie (ASPICE SUP.9)

`docs/BUGLOG.md` ist die Problem-Resolution-Liste: Jeder neue Bug bekommt die
nächste BUG-ID, Ursache, Fix-Verweis und einen **Regressionstest mit
[REQ-…]-Tag**; Status BEHOBEN erst nach grünem `verify`. Test-Lücken bleiben
als Merkposten sichtbar, statt still zu verschwinden.

## Multi-Agent-Arbeit (Workflows/Subagenten)

- Audit-/Review-Agenten arbeiten **read-only**: keine Dateien im Repo anlegen
  (Scratch nur unter /tmp) — hinterlassene `test-*.ts`/`QA_*.md` haben schon
  Builds gebrochen.
- Review-Findings werden **adversarial verifiziert** (mehrere Skeptiker-Lenses,
  Mehrheit) — und selbst dann gegengelesen: Closure-Semantik-Fehlurteile kamen
  vor. Defensiv fixen ist ok, Begründung dokumentieren.
- Ergebnisse von Agenten mit Faktenanspruch (Zahlen, Stürme, Fristen) gelten
  als unverifiziert, bis eine Primärquelle sie bestätigt.

## Betriebs-Regeln (hart erarbeitet)

- **Jeder Bash-Call beginnt mit `builtin cd <arbeitsverzeichnis> && pwd`** —
  das CWD resettet nach Hintergrund-Notifications; ein Fix-Lauf landete schon
  im falschen Repo.
- git-Binary bei Xcode-Lizenz-Prompts: `/Library/Developer/CommandLineTools/usr/bin/git`.
- `grep -c` mit 0 Treffern = Exit 1 → bricht `&&`-Ketten (`|| true`).
- Reihenfolge: Feature-Branch → verify + Matrix grün → **Staging** (`:3200`,
  eigenes Compose-Projekt) → QA-Lauf → **User-Freigabe** → main → Public.
  Ohne Freigabe niemals: main-Push, Public-Deploy, Server-Credentials/nginx.
- Xcode/Capacitor: SPM-Projekt (`App.xcodeproj`, kein Workspace); SPM-Checkout
  braucht `GIT_CONFIG_*`-Override für `safe.bareRepository` (nur pro Build,
  nie global).

## CI/CD (Stand 2026-07-10)

- **agentic-gate** (PRs UND Push auf main): verify → Build → gemockte E2E über
  die 4-Geräte-Matrix. Fast-Forward-Merges auf main laufen damit ebenfalls
  durchs Gate.
- **nightly-qa** (03:17 UTC, auch manuell per workflow_dispatch): qa-weekend
  gegen die Live-Instanz + Live-E2E (echtes Open-Meteo). Fehlschlag = Mail an
  den Repo-Owner.
- Ergänzend außerhalb GitHub: VPS-Smoke alle 6 h (qa-smoke.sh) und der
  So-03:30-Verify-Cron (Feedback vs. ERA5).

## Geräte-Berechtigungen (GPS, Kompass, Kamera) — UX-Pflicht

Blockierte Browser-/OS-Berechtigungen sind der häufigste „die App ist kaputt"-
Moment. Verbindlich für JEDES Feature mit Geräte-Berechtigung:

1. **Blockade sauber erkennen und benennen** — nie stumm hängen bleiben
   (`PERMISSION_DENIED` → eigener Status, kein Endlos-„suche …").
2. **Nur den PASSENDEN Klickpfad zeigen**, gerätegenau erkannt
   (iOS-Safari / iOS-Drittanbieter-Browser / Android / Desktop). Eine
   Sammel-Anleitung mit drei Wegen ist bereits zu viel Suche.
   - Fallstrick iOS: Drittanbieter-Browser (Chrome=`CriOS`, Firefox=`FxiOS`,
     Edge=`EdgiOS`) brauchen eine EIGENE Standort-Freigabe in den iOS-App-
     Einstellungen — zusätzlich zu den Ortungsdiensten. Das übersehen fast alle.
3. **„Erneut anfragen"-Knopf** direkt daneben (weiche Ablehnungen lassen sich so
   ohne Reload heilen).
4. **KEIN Deeplink in die OS-Einstellungen aus dem Web** — Apple/Google sperren
   das (`prefs:root=` & Co. sind tot). Einen Button zu bauen, der nichts tut,
   ist schlimmer als keiner. Ehrlich benennen und auf die native App verweisen.
5. **In der nativen App (Capacitor)** ist der Ein-Klick-Sprung in die
   App-Einstellungen erlaubt — dort gehört er hin (iOS-Etappe).
6. **Sensorwerte validieren, nie falsche Defaults schreiben**: Ein Kompass ohne
   Fix meldet gern `0`/Norden. Gültigkeit prüfen (iOS `webkitCompassAccuracy >= 0`,
   Android nur `absolute === true`), sonst NICHTS übernehmen + sichtbaren
   Hinweis zeigen (Kalibrier-Tipp). Eine falsche 0 ist gefährlicher als ein
   leeres Feld — sie sieht aus wie eine Messung.
