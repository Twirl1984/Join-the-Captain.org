#!/usr/bin/env bash
# process-metrics.sh — schlanke Prozess-Gesundheit, aus dem Repo-Zustand
# gemessen (schnell, kein Test-Lauf außer trace). Hängt eine datierte Zeile an
# docs/process-metrics.md an. Idee: über die Zeit messen → justieren, nicht raten.
#
# Aufruf: scripts/process-metrics.sh [DATUM]   (DATUM optional, sonst git-Commit-Zeit)
set -Eeuo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$(dirname "$0")/..")"

DATUM="${1:-$(git log -1 --format=%cd --date=short 2>/dev/null || date +%F)}"

req_total=$(grep -cE '^\- \*\*REQ-[A-Z]+-[0-9]{3}\*\*' docs/REQUIREMENTS.md 2>/dev/null || echo 0)
req_umgesetzt=$(grep -cE '\(Status: umgesetzt\)' docs/REQUIREMENTS.md 2>/dev/null || echo 0)
bugs=$(grep -cE '^\| BUG-[0-9]{3}' docs/BUGLOG.md 2>/dev/null || echo 0)
bugs_offen=$(grep -E '^\| BUG-[0-9]{3}' docs/BUGLOG.md 2>/dev/null | grep -ciE 'OFFEN' || echo 0)
testfiles=$(find src e2e -name '*.test.ts' -o -name '*.spec.ts' 2>/dev/null | wc -l | tr -d ' ')
tagged=$(grep -rEoh '\[REQ-[A-Z]+-[0-9]{3}\]' src e2e 2>/dev/null | wc -l | tr -d ' ')
# trace liefert "N Requirements · M mit Tests"; robust gegen Fehlen von DB etc.
trace_out=$(npm run -s trace 2>/dev/null | grep -oE 'trace: [0-9]+ Requirements · [0-9]+ mit Tests' | head -1 || echo "trace: - Requirements · - mit Tests")
mit_tests=$(echo "$trace_out" | grep -oE '· [0-9]+ mit Tests' | grep -oE '[0-9]+' || echo "-")
# Mutation-Score (falls Stryker eingerichtet + Report vorhanden), sonst "-".
mutation="-"
[ -f reports/mutation/mutation.json ] && mutation=$(grep -oE '"mutationScore":[0-9.]+' reports/mutation/mutation.json | head -1 | grep -oE '[0-9.]+' || echo "-")

LINE="| $DATUM | $req_total | $req_umgesetzt | $mit_tests | $tagged | $testfiles | $bugs | $bugs_offen | $mutation |"

DOC=docs/process-metrics.md
if [ ! -f "$DOC" ]; then
  cat > "$DOC" <<'HDR'
# Prozess-Metriken (über die Zeit)

Schlanke, KI-unabhängige Gesundheit des Entwicklungsprozesses — wöchentlich per
Cron gemessen (`scripts/process-metrics.sh`), damit wir Schwellwerte an der
Realität justieren statt zu raten. Der **Mutation-Score** ist die wichtigste
Spalte (fangen die Tests echte Bugs?); Coverage steht bewusst NICHT hier.

| Datum | REQs | umgesetzt | mit Tests | REQ-Tags | Testdateien | Bugs | offen | Mutation% |
|---|---|---|---|---|---|---|---|---|
HDR
fi
echo "$LINE" >> "$DOC"
echo "gemessen: $LINE"
