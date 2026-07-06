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
