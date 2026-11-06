# Backlog Törn-Manöver-Duell

- **Mutation-Gate** (Stryker) für `public/toern-duell/scoring.js`: aktuell Mutationsbeweis nur für die Kartenpunkte-Formel
  (`doe.test.ts`, 16 Mutanten). Stryker-Aufnahme in `stryker.config.json` wäre der CI-Nachweis für die ganze Datei.
- **Lighthouse-PWA** einmal vor Release manuell (kein CI-Gate, da Chrome-Version/Netz).
- **Mehrgeräte-Sync / Server-Backup**: bewusst nicht gebaut (Entscheid 2026-11-06: nur lokales Gerät). Falls später: Postgres-Tabelle +
  Schreibschutz per Skipper-Geheimnis; Login ist REQ-AUTH-001 (eigenes Projekt).
- **Echt-iPhone-Offline-Test automatisieren**: Playwright-WebKit kann keinen SW prüfen → bleibt manuelle Checkliste M1–M6.
