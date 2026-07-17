# Prozess-Metriken (über die Zeit)

Schlanke, KI-unabhängige Gesundheit des Entwicklungsprozesses — wöchentlich per
Cron gemessen (`scripts/process-metrics.sh`), damit wir Schwellwerte an der
Realität justieren statt zu raten. Der **Mutation-Score** ist die wichtigste
Spalte (fangen die Tests echte Bugs?); Coverage steht bewusst NICHT hier.

| Datum | REQs | umgesetzt | mit Tests | REQ-Tags | Testdateien | Bugs | offen | Mutation% |
|---|---|---|---|---|---|---|---|---|
| 2026-07-16 | 60 | 53 | - | 163 | 27 | 44 | 2 | 75.7 (peilung 80 · route-profiles 63) |
