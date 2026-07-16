# CLAUDE.md — join-the-captain.org

## Agentic Engineering — Projektregeln
- **Verify-Entrypoint:** `npm run verify` (Lint + Typecheck + alle Unit-Tests).
  E2E: `npm run build && npm run test:e2e` (e2e/navigation.spec.ts ist gemockt und
  läuft offline; e2e/wetter.spec.ts braucht echtes Netz zu Open-Meteo).
- **Definition of Done:** Ein Feature-Branch ist erst mergefähig, wenn `verify`
  grün ist und die Checkliste aus SPEC.md/AGENTIC-Playbook erfüllt ist
  (Spec, Tests, Guardrails, Observability, Reversibilität, keine TODO ohne
  Backlog-Eintrag, Kontrollstufe benannt, Diff menschlich gesichtet).
- **Nie direkt auf main pushen.** Feature-Branch → PR → CI-Gate (agentic-gate) → Merge.
- **Reversibilität:** neue nutzerseitige Features hinter Feature-Flag
  (`src/lib/flags.ts`, Env `NEXT_PUBLIC_FEATURE_*`).
- **LLM-Calls** nur über `src/lib/anthropic.ts` (zentraler Client, geloggt in
  `pipeline_log`) — keine direkten SDK-Aufrufe verstreuen.

## Projekt-Kontext
- Next.js 15 (App Router) + TypeScript, PostgreSQL, deutschsprachige Codebasis
  (Kommentare/UI Deutsch). Struktur je Feature: `src/app/<feature>/` +
  `src/components/<feature>/` + `src/lib/<feature>/` mit `__tests__/` (node:test)
  + `e2e/<feature>.spec.ts` — Referenzbeispiele: `wetter`, `navigation`.
- Tests laufen mit `node --import tsx --test` — pure Logik ohne I/O halten,
  fetch/Sampler injizieren (siehe lib/weather/route-forecast.ts, lib/navigation/depth.ts).
- **Sicherheits-Wording:** /wetter und /navigation sind Entscheidungshilfen.
  Formulierungen, die amtliche Seekarten/Seemannschaft ersetzen könnten, sind
  tabu; Haftungshinweis bleibt in UI-Footern (in-the-loop: Änderungen daran
  vorher freigeben lassen).
- Affiliate-Compliance, Pledge-Sprache und weitere Regeln: README.md.

## Prozess (verbindlich)
- Vorgehen nach ASPICE/ISTQB: `.claude/skills/aspice-istqb-workflow/SKILL.md` — Requirements-IDs Pflicht (`docs/REQUIREMENTS.md`), Tests tragen `[REQ-…]`-Tags, `npm run trace` ist Teil von `verify`.
- **Substanzielle Entwicklung läuft über den dev↔qa-Loop:** Skill `.claude/skills/dev-loop/SKILL.md` startet den benannten Workflow `dev-qa-loop` (Rollen `dev-tdd` + `qa-adversarial`) — Entwickler baut testgetrieben, ein unabhängiger QA-Agent greift adversarisch an (Unit→E2E über 4 Geräte, DB gegen echte Postgres), bis grün. Einzeiler/Trivialfixes brauchen nur `dev-tdd` + `verify`, keinen Loop.
- Bei widersprüchlichen/unklaren Anforderungen: stoppen und den User konkret fragen (REQ-PROC-002).
