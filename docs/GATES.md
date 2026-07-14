# Gates — was hier prüft, in welcher Reihenfolge, und warum

Referenz-Muster für die Schwester-Repos (join-the-captain, Certi4Safety).
Leitgedanke: **Jedes Gate existiert wegen eines konkreten Fehlers, den wir
sonst wiederholen** — nicht wegen einer Best-Practice-Liste. Wo ein Gate keine
Evidenz hat, gehört es weg.

## Reihenfolge bei einem PR

```
PR geöffnet
  │
  ├─ diff-size ........ Ist der Diff überhaupt reviewbar?      (blockend ab 800)
  ├─ security-scan .... Secrets? Bekannte Schwachstellen-Muster? (noch nicht blockend)
  └─ verify ........... Lint → Typecheck → Unit → trace → Build → E2E (blockend)
       │
       └─ Merge auf main → agentic-gate läuft ERNEUT auf dem Push
                          → nightly-qa prüft nachts die LIVE-Instanz
```

Zusätzlich außerhalb von GitHub: VPS-Smoke alle 6 h, Verify-Cron sonntags
(Wetter-Feedback gegen ERA5).

## Die Gates einzeln

| Gate | Wann | Blockend? | Warum es existiert (Evidenz in einem Satz) |
|---|---|---|---|
| **diff-size** | PR | ab >800 Zeilen | Reviews finden 70–90 % der Defekte, **solange der Diff klein bleibt**; laut SmartBear/Cisco bricht die Defect-Discovery-Rate ab ~200–400 Zeilen ein, weil Reviewer nur noch überfliegen. Lockfiles/Generiertes zählen nicht — die liest ohnehin niemand. Override per Label `size-override` für begründet große Umbauten. |
| **security-scan / gitleaks** | PR + main-Push | nein (Beobachtung) | Geleakte Credentials sind einer der häufigsten Einbruchswege; einmal gepusht bleibt ein Secret **in der Historie**, auch wenn der Commit später „gefixt" wird. |
| **security-scan / semgrep** | PR + main-Push | nein (Beobachtung) | Findet Muster (XSS-Senken, unsichere Redirects, eval-artige Konstrukte), die Lint und Typecheck **bewusst nicht** prüfen. OSS-Regeln `p/typescript`, `p/react`, `p/security-audit`. |
| **verify → lint + typecheck** | PR + main-Push | ja | TypeScript ist `strict`; der Compiler ist der billigste Test, den es gibt. |
| **verify → Unit-Tests** | PR + main-Push | ja | Die Kernlogik (Routing, Wetter-Warnungen, Peilung) ist bewusst I/O-frei gebaut und damit offline prüfbar — dort liegen die Fehler, die im Browser niemand sieht (z. B. eine GPS-Plausibilitätsprüfung, die immer „passt" sagt, BUG-043). |
| **verify → `npm run trace`** | PR + main-Push | ja | **Das Gate, das über die üblichen Empfehlungen hinausgeht:** Jedes Requirement mit Status „umgesetzt" braucht mindestens einen Test, der es per `[REQ-…]`-Tag referenziert; ein Tag auf ein unbekanntes Requirement bricht ebenfalls. Verhindert die klassische Lücke „Feature gebaut, Requirement nie verifiziert". Generiert `docs/TRACEABILITY.md`. |
| **verify → Build** | PR + main-Push | ja | Next.js scheitert an Dingen, die `tsc` durchlässt (RSC-Grenzen, ungeescapte Entities im JSX). |
| **verify → E2E (Playwright)** | PR + main-Push | ja | 4-Geräte-Matrix (Chrome, Android, Desktop Safari, iPhone). Gerätespezifische Fehler sind real und teuer — WebKit hat uns mehrfach echte Bugs gezeigt (Safe-Area-Vollbild, aufrechter Kompass). Gemockt und damit offline-stabil. |
| **nightly-qa** | 03:17 UTC + manuell | Mail an Owner | Prüft die **Live**-Instanz gegen **echte** Wetter-/Tiefendaten (Referenz-Routen + selbstkalibrierende Archiv-Validierung). Ein grüner PR sagt nichts darüber, ob Open-Meteo heute Nacht das Schema geändert hat. |

## Bewusst NICHT eingesetzt

- **CodeQL** — bei **privaten** Repos kostenpflichtig (GitHub Advanced Security).
  Semgrep-OSS deckt die relevanten Klassen kostenlos ab.
- **Coverage-Schwellwert** — eine Prozentzahl erzwingt Tests, die Zeilen berühren,
  ohne Verhalten zu prüfen. Das `trace`-Gate erzwingt stattdessen Tests, die ein
  **Requirement** prüfen. Das ist die schärfere Bedingung.
- **Auto-Formatter-Gate** — Lint erledigt das; ein eigenes Gate dafür ist Lärm.

## Offene Merkposten

- [ ] `security-scan` nach einer Woche Beobachtung auf **blockend** stellen
      (Fehlalarme vorher kalibrieren; Datum der Aktivierung: 2026-07-13).
- [ ] Dependabot-PRs laufen durch dasselbe Gate — bleiben sie klein, ist das ein
      gutes Signal für die Gate-Qualität.

## Für die Schwester-Repos

Reihenfolge der Einführung, nach Nutzen pro Aufwand:
1. `verify` (Lint + Typecheck + Unit) als **blockendes** Gate — ohne das ist alles andere Kosmetik.
2. **diff-size** — billigstes Gate mit der größten Wirkung auf die Review-Qualität.
3. **Traceability-Gate** (`trace`) — braucht einen Requirements-Katalog (`docs/REQUIREMENTS.md`)
   und `[REQ-…]`-Tags in Testtiteln; danach läuft es von selbst.
4. **security-scan** — erst beobachtend, dann blockend.
5. **E2E-Matrix** — zuletzt, weil am teuersten in Laufzeit und Pflege.
