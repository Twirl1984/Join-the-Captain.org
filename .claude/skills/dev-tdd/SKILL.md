---
name: dev-tdd
description: Testgetriebene Entwicklung in diesem Repo — Red-Green-Refactor, kleine Diffs, Clean Code, Übergabe an qa-adversarial. Für die Entwickler-Rolle im dev↔qa-Loop und für jede Feature-/Fix-Arbeit.
---

# dev-tdd — der Entwickler im dev↔qa-Loop

Du baust **testgetrieben** und übergibst an einen unabhängigen QA-Agenten
([[qa-adversarial]]). Prozess-Basis: [[aspice-istqb-workflow]] (REQ-IDs,
`[REQ-…]`-Tags, `npm run trace`). Gates: [docs/GATES.md] — Diff **unter 400
Zeilen** halten (ab 800 blockt das Gate). Lieber mehrere kleine Commits/Branches.

## Red → Green → Refactor (verbindlich, keine Ausnahme)

1. **RED:** Schreibe zuerst einen Test, der die Anforderung kodiert und
   **fehlschlägt**. Titel trägt den `[REQ-…]`-Tag. Lauf ihn, sieh ihn rot.
   - Reicht die Anforderung nicht für einen Test (unklar/widersprüchlich):
     STOPP und konkret nachfragen (REQ-PROC-002), nicht raten.
2. **GREEN:** Minimal implementieren, bis der Test grün ist. Nicht mehr.
3. **REFACTOR:** Aufräumen bei grüner Suite (Namen, Duplikate, tote Zweige).

Bugfixes genauso: **erst der Regressionstest, der den Bug reproduziert** (rot),
dann der Fix (grün). BUGLOG-Eintrag mit BUG-ID + Verweis auf den Test.

## Clean Code (in diesem Repo hart erarbeitet)

- **Pure Logik ohne I/O**, Abhängigkeiten injizieren (fetch/Sampler/DB-Client
  als Parameter) — so ist die Kernlogik offline unit-testbar. Referenz:
  `src/lib/**` (peilung.ts, route-forecast.ts, erlebnis/poi.ts).
- **Kleine Funktionen, sprechende Namen**, ein Zweck pro Funktion.
- **Keine God-Komponenten.** Warnung aus diesem Repo: `NavApp.tsx` ist auf
  ~1700 Zeilen gewachsen — neue UI kommt in eigene Komponenten/Sub-Tools, nicht
  „schnell noch mit rein".
- Typisiert (TS strict), kein `any` als Fluchtweg, kein toter Code, keine
  auskommentierten Blöcke.
- Kommentar nur für Constraints/Warum, nie für „was die nächste Zeile tut".
- Sicherheits-Asymmetrie beachten: verpasste Warnung (FN) wiegt schwerer als
  Fehlalarm (FP) — Warnlogik defensiv, gegen den Backtest (REQ-WET-013).

## Definition of Ready für die QA-Übergabe

Bevor du an [[qa-adversarial]] übergibst:
- `npm run verify` grün (lint, typecheck, alle Unit-Suiten, trace).
- Neue/geänderte Features haben Tests mit `[REQ-…]`-Tag; REQ-Status gepflegt.
- Datenbank-Features: Migration wurde **gegen eine echte DB** ausgeführt
  (`npm run db:migrate`), nicht nur geschrieben.
- Übergabe-Notiz: WAS geändert wurde, WELCHE Tests, und **wo du selbst
  Restrisiko sieht** (die Stelle, die QA zuerst angreifen soll). Ehrlich —
  verschwiegenes Restrisiko findet der QA-Agent sowieso.

## Auf QA-Findings reagieren

- Jedes bestätigte Finding zuerst als **roten Test** festnageln, dann fixen.
- Nicht diskutieren, ob es „wichtig genug" ist — der QA-Agent hat Repro geliefert.
- Nach dem Fix die volle Suite erneut; erst dann zurückgeben.
