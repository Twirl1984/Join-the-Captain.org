# Autonome Feature-Pipeline (lokaler Mac-Treiber)

Ein Feature je Lauf: **Agent baut testgetrieben → deterministisches Gate
urteilt → nur bei Grün Merge nach `mvp_2` + Staging.** Nie automatisch auf `main`.

## Warum lokal (nicht VPS, nicht Cloud)

Nur der Mac hat das volle Werkzeug: `docker` (echte Postgres-DB-Verify), `ssh`
(Staging-Deploy), WebKit (4-Geräte-E2E). Der VPS ist der Live-Host — dort läuft
keine schwere CI. Die Cloud-Routine kann DB/Staging nicht und erreicht die
80%-Schwelle nie. Darum ist der Mac-Cron die robuste Wahl (Nachteil: Mac muss
laufen).

## Robustheit gegen Drift

- **Die Maschine urteilt, nicht der Agent:** der Merge/Deploy hängt an
  `run.sh`s Gate (verify + Build + 4-Geräte-E2E + echte-DB-Migration/Seed +
  Staging-Smoke + `qa-weekend`), nicht an Agenten-Selbstlob.
- **Ein Feature je Lauf**, `flock` gegen Überlappung, persistenter Klon.
- **Rotes Gate → kein Merge/Deploy**, Branch bleibt liegen, Lauf stoppt mit Log.
- **`main`-Release bleibt manuell** (User-Gate). Staging ist die autonome Decke.
- Jeder Lauf schreibt `~/.jtc-pipeline/logs/run-<ts>.log`.

## Erst testen (inert), dann scharf schalten

```bash
# Trockenlauf: baut + Gate, aber KEIN Merge/Deploy
DRY_RUN=1 scripts/pipeline/run.sh

# Scharf (ein Feature vorantreiben, inkl. Staging)
scripts/pipeline/run.sh
```

## Als Cron/launchd (macOS)

`com.jtc.pipeline.plist` ist eine **Vorlage** — bewusst NICHT auto-installiert.
Scharfschalten:

```bash
cp scripts/pipeline/com.jtc.pipeline.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.jtc.pipeline.plist   # aktivieren
launchctl unload ~/Library/LaunchAgents/com.jtc.pipeline.plist # stoppen
```

Standard-Takt der Vorlage: 22:30 + 02:30 Uhr (ein Feature je Lauf; der Rest der
Nacht bleibt frei fürs nächste). Anpassen im `<StartCalendarInterval>`.

## Voraussetzungen

git, node/npm, docker (laufend), ssh-Key zum VPS, `claude` CLI (eingeloggt),
`npx playwright install webkit` einmalig. Config per Env in `run.sh` oben
(VPS, Staging-Pfade, Ports).
