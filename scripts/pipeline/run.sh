#!/usr/bin/env bash
# run.sh — autonomer Pipeline-Treiber (ein Feature je Lauf, lokal auf dem Mac).
#
# Robustheits-Prinzip: der AGENT schreibt Code + Tests, ein DETERMINISTISCHES
# Gate (dieses Skript) urteilt. Nur bei grünem Gate wird gemergt + auf Staging
# deployt. NIEMALS automatisch auf main — das bleibt die Entscheidung des Users.
#
# Voraussetzungen (lokal): git, node/npm, docker, ssh (Key zum VPS), claude CLI,
# WebKit für Playwright installiert.
#
# Aufruf:  scripts/pipeline/run.sh            # ein Feature vorantreiben
#          DRY_RUN=1 scripts/pipeline/run.sh  # alles außer Merge/Deploy
set -Eeuo pipefail

# ── Konfiguration (per Env überschreibbar) ──────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/Twirl1984/Join-the-Captain.org.git}"
WORK="${PIPELINE_WORK:-$HOME/.jtc-pipeline/repo}"
INTEG_BRANCH="${INTEG_BRANCH:-mvp_2}"
GIT_BIN="${GIT_BIN:-/Library/Developer/CommandLineTools/usr/bin/git}"
GIT_NAME="${GIT_NAME:-Chris Funda}"
GIT_EMAIL="${GIT_EMAIL:-Twirl1984@users.noreply.github.com}"
VPS="${VPS:-root@194.164.197.23}"
STAGING_DIR="${STAGING_DIR:-/srv/jtc-org-staging/repo}"
STAGING_PROJECT="${STAGING_PROJECT:-jtc-org-staging}"
STAGING_COMPOSE="${STAGING_COMPOSE:-docker-compose.staging.yml}"
STAGING_URL="${STAGING_URL:-https://join-the-captain.org:3200}"
STAGING_AUTH="${STAGING_AUTH:-jtc:Toern-Wetter-2026}"
PW_PORT="${PW_PORT:-3312}"
DB_PORT="${DB_PORT:-55432}"
DB_NAME="jtc-pipeline-db"
MAX_ROUNDS="${MAX_ROUNDS:-8}"
LOGDIR="${PIPELINE_LOGDIR:-$HOME/.jtc-pipeline/logs}"
LOCKDIR="$HOME/.jtc-pipeline/lock.d"

mkdir -p "$LOGDIR" "$(dirname "$LOCKDIR")"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOGDIR/run-$TS.log"
exec > >(tee -a "$LOG") 2>&1
say() { echo "[$(date +%H:%M:%S)] $*"; }
fail() { say "ABBRUCH: $*"; exit 1; }

# ── Nur ein Lauf gleichzeitig (portabler mkdir-Lock; flock gibt's auf macOS nicht) ──
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  say "Ein anderer Pipeline-Lauf ist aktiv — beende."; exit 0
fi
cleanup() { rmdir "$LOCKDIR" 2>/dev/null || true; docker rm -f "$DB_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# ── Arbeitskopie sicherstellen (persistent, nicht neu klonen) ────────────────
if [ ! -d "$WORK/.git" ]; then
  say "Klone nach $WORK …"; "$GIT_BIN" clone -q "$REPO_URL" "$WORK"
fi
cd "$WORK"
"$GIT_BIN" config user.name "$GIT_NAME"; "$GIT_BIN" config user.email "$GIT_EMAIL"
"$GIT_BIN" fetch -q origin
"$GIT_BIN" checkout -q "$INTEG_BRANCH"
"$GIT_BIN" reset -q --hard "origin/$INTEG_BRANCH"
"$GIT_BIN" clean -qfdx -e node_modules -e .next

# ── Nächstes offenes Feature aus der Queue lesen ────────────────────────────
FEATURE="$(awk '/^## Feature-Queue/{q=1} q&&/^[0-9]+\. \[ \]/{sub(/^[0-9]+\. \[ \] /,"");print;exit}' docs/feature-pipeline.md || true)"
[ -n "$FEATURE" ] || { say "Queue leer — nichts zu tun."; exit 0; }
SLUG="$(echo "$FEATURE" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-' | cut -c1-40)"
BRANCH="pipe/$SLUG"
say "Nächstes Feature: $FEATURE  → Branch $BRANCH"

npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null 2>&1
"$GIT_BIN" checkout -q -B "$BRANCH" "origin/$INTEG_BRANCH"

# ── 1) Agent baut das Feature testgetrieben (dev↔qa-Loop) ───────────────────
# Permission-Modus ist BEWUSST nicht hartcodiert. Für den unbeaufsichtigten
# Lauf muss der Agent Bash (npm/git/npx/docker) ausführen dürfen — das ist die
# Entscheidung des Users beim Scharfschalten. Empfohlen: eine ENGE Allowlist in
# .claude/settings.json (nur npm/npx/git/docker/tsx), NICHT pauschal alles.
# Setze CLAUDE_PERM_MODE (z.B. "acceptEdits" mit Allowlist, oder bewusst weiter)
# oder lass es leer → dann läuft der Agent im Default-Modus und STOPPT an
# Freigaben (nicht autonom — sicher).
say "Starte Agent (dev-loop) für: $FEATURE  (Perm-Modus: ${CLAUDE_PERM_MODE:-default/interaktiv})"
PROMPT="$(cat "$WORK/scripts/pipeline/agent-prompt.md")
FEATURE: $FEATURE
BRANCH: $BRANCH
WORKTREE: $WORK
MAX_ROUNDS: $MAX_ROUNDS"
if ! claude -p "$PROMPT" ${CLAUDE_PERM_MODE:+--permission-mode "$CLAUDE_PERM_MODE"} >/dev/null 2>&1; then
  say "Agentlauf endete mit Fehlercode — prüfe Log. Branch bleibt liegen."; exit 1
fi
"$GIT_BIN" add -A && "$GIT_BIN" commit -q -m "wip($SLUG): Agentlauf $TS" --allow-empty >/dev/null 2>&1 || true

# ── 2) DETERMINISTISCHES GATE (die Maschine urteilt) ────────────────────────
say "Gate: verify"
npm run -s verify || fail "verify rot"

say "Gate: echte Postgres (Migration + Seed + API-Smoke)"
docker rm -f "$DB_NAME" >/dev/null 2>&1 || true
docker run -d --name "$DB_NAME" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=jtc_org -p "$DB_PORT:5432" postgres:16 >/dev/null
for i in $(seq 1 30); do docker exec "$DB_NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
export DATABASE_URL="postgresql://postgres:postgres@localhost:$DB_PORT/jtc_org?sslmode=disable"
npm run -s db:migrate || fail "db:migrate rot"
npm run -s db:seed:erlebnis >/dev/null 2>&1 || true

say "Gate: Build + 4-Geräte-E2E"
npm run -s build >/dev/null || fail "build rot"
PW_PORT="$PW_PORT" npx playwright test >/dev/null || fail "E2E rot"

if [ "${DRY_RUN:-0}" = "1" ]; then
  say "DRY_RUN — Gate grün, aber KEIN Merge/Deploy. Branch $BRANCH liegt bereit."; exit 0
fi

# ── 3) 80% erreicht → in Integrations-Branch mergen + Staging ───────────────
say "Gate grün → merge nach $INTEG_BRANCH + Staging"
"$GIT_BIN" checkout -q "$INTEG_BRANCH"
"$GIT_BIN" merge --no-ff "$BRANCH" -m "feat($SLUG): $FEATURE (Pipeline, Gate grün $TS)" || fail "Merge-Konflikt — manuell auflösen"
"$GIT_BIN" push -q origin "$INTEG_BRANCH"

rsync -az --delete --exclude .git --exclude node_modules --exclude .next --exclude .env \
  --exclude playwright-report --exclude test-results ./ "$VPS:$STAGING_DIR/"
ssh "$VPS" "cd $STAGING_DIR && docker compose -p $STAGING_PROJECT -f $STAGING_COMPOSE up -d --build" >/dev/null
sleep 8
CODE="$(curl -sk -o /dev/null -w '%{http_code}' -u "$STAGING_AUTH" "$STAGING_URL/navigation")"
[ "$CODE" = "200" ] || fail "Staging-Smoke $CODE"
QA_BASE_URL="$STAGING_URL" QA_BASIC_AUTH="$STAGING_AUTH" npx tsx scripts/qa-weekend.ts || fail "QA gegen Staging rot"

# ── 4) Queue abhaken + Fortschritt festhalten (Branch löschen) ──────────────
sed -i '' "s#^\([0-9]\+\)\. \[ \] $FEATURE#\1. [x] $FEATURE — Pipeline $TS: Gate grün, in $INTEG_BRANCH, auf Staging#" docs/feature-pipeline.md || true
"$GIT_BIN" add docs/feature-pipeline.md && "$GIT_BIN" commit -q -m "docs(pipeline): $FEATURE abgehakt (Gate grün, Staging) $TS" || true
"$GIT_BIN" push -q origin "$INTEG_BRANCH"
"$GIT_BIN" push -q origin --delete "$BRANCH" >/dev/null 2>&1 || true

say "FERTIG: $FEATURE auf $INTEG_BRANCH + Staging. main-Release bleibt manuell (User-Gate)."
