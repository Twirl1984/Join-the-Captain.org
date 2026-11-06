# Backlog Törn-Manöver-Duell

- ~~Mutation-Gate~~ **erledigt** (stryker.duell.config.json, Score 94,99 %, Schwelle 85 %, wöchentlicher Workflow). Offen: `router.js` (86,5 %) und Randfälle.
- ~~Lighthouse~~ einmal gemessen (PWA 100, A11y 100, BP 100, Perf 92, SEO 82 gewollt wegen noindex; docs/duell-testplan.md). Wiederholen vor Release; Lighthouse ≥ 12 hat keine PWA-Kategorie mehr.
- **Mehrgeräte-Sync / Server-Backup**: bewusst nicht gebaut (Entscheid 2026-11-06: nur lokales Gerät). Falls später: Postgres-Tabelle +
  Schreibschutz per Skipper-Geheimnis; Login ist REQ-AUTH-001 (eigenes Projekt).
- **Echt-iPhone-Offline-Test automatisieren**: Playwright-WebKit kann keinen SW prüfen → bleibt manuelle Checkliste M1–M6.
