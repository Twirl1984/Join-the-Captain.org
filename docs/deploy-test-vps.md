# Test-Instanz auf dem VPS (eigener Port, Basic-Auth)

Rollt den aktuellen Stand als **isolierte Test-Instanz** auf den Strato-VPS aus,
**ohne** `.de` (oder eine spätere `.org`-Prod) zu berühren. Erreichbar über die
Domain auf einem eigenen Port, hinter **HTTP Basic Auth** + `noindex`.

| Aspekt | Wert |
|---|---|
| Verzeichnis | `/srv/jtc-org-test/repo` |
| Compose-Projekt | `jtc-org-test` (eigene Container/Netzwerk/Volume) |
| Web-Container | intern `127.0.0.1:3101` |
| Öffentlicher Zugang | **`http://join-the-captain.org:3100`** (nginx + Basic-Auth, ohne TLS) |
| DB | eigener `postgres:16`-Container, Volume `jtc_org_test_pgdata` |

## Deploy (auf dem VPS)

```bash
cd /srv/jtc-org-test/repo
cp -n .env.example .env            # Keys optional — Design-Test läuft auch leer
docker compose -p jtc-org-test -f docker-compose.test.yml up -d --build

# DB migrieren + seeden (ohne Host-Node, via Einweg-Container im Compose-Netz):
docker run --rm --network jtc-org-test_default -v "$PWD":/app -w /app node:22-slim \
  sh -c "npm ci --no-audit --no-fund && \
         DATABASE_URL='postgresql://postgres:postgres@db:5432/jtc_org?sslmode=disable' npm run db:migrate && \
         DATABASE_URL='postgresql://postgres:postgres@db:5432/jtc_org?sslmode=disable' npm run db:seed"
```

## Basic-Auth-Gate (nginx davor)

```bash
# Passwort-Datei (User 'jtc'):
HASH=$(openssl passwd -apr1 'DEIN-PASSWORT')
printf 'jtc:%s\n' "$HASH" > /srv/jtc-org-test/.htpasswd

# nginx-Block /etc/nginx/sites-available/jtc-org-test:
#   server { listen 3100; auth_basic "JTC .org — Test";
#            auth_basic_user_file /srv/jtc-org-test/.htpasswd;
#            location / { proxy_pass http://127.0.0.1:3101; ... } }
ln -sf /etc/nginx/sites-available/jtc-org-test /etc/nginx/sites-enabled/jtc-org-test
nginx -t && systemctl reload nginx
```

Reihenfolge beachten: erst den Container auf `127.0.0.1:3101` bringen (gibt Port
3100 frei), **dann** nginx auf `:3100` reloaden — sonst Bind-Konflikt.

> Basic-Auth über **HTTP** ist nur ein leichtes Gate (Zugangsdaten gehen
> unverschlüsselt). Hält neugierige Dritte fern; echte Sicherheit kommt mit dem
> TLS-Prod-Deploy ([DEPLOYMENT.md](DEPLOYMENT.md)).

## Aktualisieren / Aufräumen

```bash
# neuen Stand testen (nach rsync/pull):
docker compose -p jtc-org-test -f docker-compose.test.yml up -d --build

# Test-Instanz komplett entfernen:
docker compose -p jtc-org-test -f docker-compose.test.yml down -v
rm -rf /srv/jtc-org-test
rm -f /etc/nginx/sites-enabled/jtc-org-test /etc/nginx/sites-available/jtc-org-test
systemctl reload nginx
```

## Nachtrag (2026-07-02): HTTPS + Hauptdomain

- Let's-Encrypt-Zertifikat für `join-the-captain.org` (+www), Auto-Renewal via certbot-Timer.
- **`https://join-the-captain.org`** (Port 443, `sites-available/jtc-org-main`) zeigt mit
  demselben Basic-Auth-Gate auf die Test-Instanz — schönerer Link zum Teilen.
- `https://join-the-captain.org:3100` funktioniert parallel weiter (`jtc-org-test`, jetzt `listen 3100 ssl`).
- Port 80 (`jtc-org-http80`): ACME-Challenge + 302 auf die portlose HTTPS-URL.
- Beim späteren **Prod-Deploy** ersetzt der echte `.org`-Block (DEPLOYMENT.md B6/B7) einfach
  `jtc-org-main` — Zertifikat existiert dann schon.
