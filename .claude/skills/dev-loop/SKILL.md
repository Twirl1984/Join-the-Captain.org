---
name: dev-loop
description: Startet den stehenden dev↔qa-Loop für dieses Repo — ein Entwickler-Agent baut testgetrieben, ein unabhängiger QA-Agent greift adversarisch an (Unit bis E2E), Bugs gehen zurück bis grün. Nutzen, wenn eine Feature-Etappe/ein Branch „durch den Loop" oder „gehärtet" werden soll (auch: „dev-qa-loop", „adversarial testen", „QA-Runde").
---

# dev-loop — der stehende dev↔qa-Loop

So läuft **jede substanzielle Entwicklung** in diesem Repo. Zwei Rollen als
Skills, ein Loop als benannter Workflow:

- [[dev-tdd]] — baut testgetrieben (Red→Green→Refactor), Clean Code, kleine Diffs.
- [[qa-adversarial]] — versucht die Arbeit zu BRECHEN, echte Suite als Wahrheit.
- **Workflow `dev-qa-loop`** (`.claude/workflows/dev-qa-loop.js`) — orchestriert
  QA-Scan → Dev-Fix → Verify, bis zu 10 Runden, Abbruch sobald QA nichts mehr
  findet UND die Suite grün ist.

## Wann welcher Pfad (nicht mit Kanonen auf Spatzen)

| Änderung | Vorgehen |
|---|---|
| Einzeiler, Typo, offensichtlicher Fix | nur [[dev-tdd]] (Regressionstest + Fix) + `npm run verify` — **kein** Loop |
| Feature-Etappe, neue API/DB, UI-Baustein, riskanter Umbau | **voller Loop** (`dev-qa-loop`) |
| Nächtliche/Cron-Routine je Etappe | **voller Loop** |

Der 10-Runden-Adversarial-Loop kostet viele Agenten und echte Testläufe — für
Kleinkram Verschwendung, für echte Features die Absicherung.

## Aufruf

```
Workflow({ name: "dev-qa-loop", args: {
  worktree: "<absoluter Pfad der Arbeitskopie>",
  branch:   "<branch>",
  focus:    "<1–3 Sätze: was gehärtet wird + betroffene Pfade>",
  maxRounds: 10,
  dbSetup:  true,        // wenn DB-Features geprüft werden
  gitBin:   "/Library/Developer/CommandLineTools/usr/bin/git"  // auf diesem Mac
}})
```

Der Loop arbeitet **auf dem angegebenen Working Tree** (Agenten laufen
sequenziell, kein Parallel-Schreibkonflikt). Während er läuft, den Baum nicht
von Hand anfassen.

## Definition of Done einer Etappe

Erst wenn der Loop mit „grün — QA findet nichts mehr" endet: `npm run verify`
grün, volle 4-Geräte-E2E grün, DB-Features gegen echte Postgres verifiziert,
REQ-Status gepflegt, BUGLOG bei Fixes ergänzt. Erreicht der Loop die Max-Runde
ohne Grün, werden die offenen Findings an den User übergeben — **nicht**
durchgewunken.
