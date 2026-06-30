# Test-Instanz auf dem VPS (eigener Port, isoliert)

Rollt den aktuellen Stand als **isolierte Test-Instanz** auf den Strato-VPS aus,
**ohne** `.de` (oder eine spätere `.org`-Prod) zu berühren. Zugriff per
SSH-Tunnel — nichts wird öffentlich exponiert, kein TLS/DNS nötig.

| Aspekt | Wert |
|---|---|
| Verzeichnis | `/srv/jtc-org-test/repo` |
| Compose-Projekt | `jtc-org-test` (eigene Container/Netzwerk/Volume) |
| Web-Port | `127.0.0.1:3100` (nur lokal, Zugriff per Tunnel) |
| DB | eigener `postgres:16`-Container, Volume `jtc_org_test_pgdata` |

## Deploy (auf dem VPS)

```bash
cd /srv/jtc-org-test/repo
cp -n .env.example .env            # Keys optional — Design-Test läuft auch leer
docker compose -p jtc-org-test -f docker-compose.test.yml up -d --build

# DB migrieren + seeden (ohne Host-Node, via Einweg-Container im Compose-Netz):
docker run --rm --network jtc-org-test_default -v "$PWD":/app -w /app node:22-slim \
  sh -c "npm ci --no-audit --no-fund && \
         DATABASE_URL=postgresql://postgres:postgres@db:5432/jtc_org npm run db:migrate && \
         DATABASE_URL=postgresql://postgres:postgres@db:5432/jtc_org npm run db:seed"

curl -sS -I http://127.0.0.1:3100 | head -1   # erwartet: HTTP/.. 200
```

## Ansehen (vom eigenen Rechner)

```bash
ssh -L 3100:127.0.0.1:3100 root@194.164.197.23
# Browser → http://localhost:3100   (Theme-Toggle, /tools, /community, /podcast)
```

## Aktualisieren / Aufräumen

```bash
# neuen Stand testen (nach rsync/pull):
docker compose -p jtc-org-test -f docker-compose.test.yml up -d --build

# Test-Instanz komplett entfernen:
docker compose -p jtc-org-test -f docker-compose.test.yml down -v
rm -rf /srv/jtc-org-test
```
