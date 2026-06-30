#!/usr/bin/env bash
# Nächtlicher Research-Scout auf dem VPS.
#
# Läuft den Scan in einem Einweg-Node-Container im Compose-Netz der Instanz
# (gleiches Muster wie die Migration in docs/deploy-test-vps.md). Kein Host-Node
# nötig. Per Cron einhängen — siehe docs/research-scout.md.
#
#   Beispiel-Crontab (03:17 Uhr nachts):
#   17 3 * * *  /srv/jtc-org/repo/scripts/research-cron.sh >> /var/log/jtc-research.log 2>&1
set -euo pipefail

# Repo-Verzeichnis = Ordner über diesem Script.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Compose-Projekt + Datei: Prod-Default, per Env überschreibbar (Test-Instanz).
COMPOSE_PROJECT="${JTC_COMPOSE_PROJECT:-jtc-org}"
COMPOSE_FILE="${JTC_COMPOSE_FILE:-docker-compose.yml}"
NETWORK="${JTC_NETWORK:-${COMPOSE_PROJECT}_default}"
DB_URL="${JTC_DB_URL:-postgresql://postgres:postgres@db:5432/jtc_org?sslmode=disable}"

echo "[research-cron] $(date -Is) Start (Projekt=$COMPOSE_PROJECT, Netz=$NETWORK)"

# .env der Instanz durchreichen (ANTHROPIC_API_KEY + RESEARCH_*-Stellschrauben).
ENV_ARG=()
[ -f "$REPO_DIR/.env" ] && ENV_ARG=(--env-file "$REPO_DIR/.env")

docker run --rm \
  --network "$NETWORK" \
  "${ENV_ARG[@]}" \
  -e "DATABASE_URL=$DB_URL" \
  -e "RESEARCH_REPORT_DIR=/app/reports" \
  -v "$REPO_DIR":/app -w /app \
  node:22-slim \
  sh -c "npm ci --no-audit --no-fund --silent && npm run research:run"

echo "[research-cron] $(date -Is) Fertig"
