# Deployment — `.org` parallel zu `.de` auf dem Strato-VPS

Wie `join-the-captain.org` (Next.js + PostgreSQL, dockerisiert) **neben** der
bestehenden `.de`-Buchungsplattform auf demselben Strato-VPS läuft, ohne `.de`
anzufassen. Plus die nötigen **Strato-DNS-Einstellungen**.

## Ausgangslage (VPS)

- **Strato-VPS**, IP `194.164.197.23`, Root-SSH.
- **nginx** terminiert alles auf Port 80/443, TLS via **Certbot/Let's Encrypt**.
- **`.de` (Prod):** statisches Frontend unter `/srv/jtc/repo`, Node-API auf
  `127.0.0.1:3001` (systemd `jtc-api`), SQLite. Staging liegt parallel auf `:8082`
  / API `:3002` — bewährtes Muster für „parallel, ohne Prod anzufassen".

## Prinzip: strikte Isolation gegen `.de`

| Aspekt | `.de` (Prod) | `.org` (neu) |
|---|---|---|
| Domain | join-the-captain.de / .com | **join-the-captain.org** |
| Verzeichnis | `/srv/jtc/repo` | **`/srv/jtc-org/repo`** |
| Laufzeit | Node, systemd `jtc-api` | **Docker Compose** (`web` + `db`) |
| App-Port | `3001` | **`3000`** (nur an `127.0.0.1` gebunden) |
| Datenbank | SQLite (Datei) | **PostgreSQL** (eigener Container + Volume) |
| nginx | server_name `.de/.com` | **eigener Server-Block** server_name `.org` |
| TLS | Let's Encrypt `.com` | **eigenes Let's-Encrypt-Zertifikat `.org`** |
| Env | `api/.env` | **`/srv/jtc-org/repo/.env`** |

→ Kein gemeinsamer Port, kein gemeinsames Verzeichnis, keine gemeinsame DB,
kein gemeinsames Zertifikat. **`.de` bleibt unberührt.**

---

## A) Strato-DNS (zuerst — DNS braucht Vorlauf)

Strato-Kundenlogin → **Domainverwaltung** → `join-the-captain.org` →
**„DNS verwalten" / „Nameserver & DNS"** → eigene Einträge:

| Typ | Host | Wert | Zweck |
|---|---|---|---|
| `A` | `@` (leer / Domain selbst) | `194.164.197.23` | Root → VPS |
| `A` | `www` | `194.164.197.23` | www → VPS |
| `AAAA` | `@` und `www` | *(IPv6 des VPS)* | optional, falls VPS IPv6 hat (`ip -6 addr` auf dem VPS) |
| `CAA` | `@` | `0 issue "letsencrypt.org"` | optional, härtet Zertifikatsausstellung |

Hinweise zu Strato:
- Steht die Domain noch auf **Domain-Parking / Strato-Standard-Website**, erst
  auf **eigene DNS-Verwaltung** umstellen und Strato-Default-A-Records entfernen —
  sonst zeigt die Domain weiter auf die Parking-Seite.
- Den **Root-A-Record** stellt man bei Strato im **Experten-/A-Record-Bereich** ein.
- **TTL** während der Umstellung niedrig (z. B. 3600).
- **MX / E-Mail** unverändert lassen, falls Strato-Mail genutzt wird — die
  Website-Records oben berühren E-Mail nicht.
- Propagation bis zu einige Stunden. Prüfen:
  `dig join-the-captain.org +short` → muss `194.164.197.23` zeigen. **Erst dann**
  Certbot (Schritt B6), sonst schlägt die Domain-Validierung fehl.

---

## B) Schritte auf dem VPS (als root)

```bash
ssh root@194.164.197.23
```

**B1 — Voraussetzung Docker.** Prüfen / ggf. installieren:
```bash
docker --version && docker compose version   # vorhanden? sonst:
# apt-get update && apt-get install -y docker.io docker-compose-plugin
```

**B2 — Repo klonen** (eigenes Verzeichnis, nicht `/srv/jtc`):
```bash
mkdir -p /srv/jtc-org
git clone https://github.com/Twirl1984/Join-the-Captain.org.git /srv/jtc-org/repo
cd /srv/jtc-org/repo
```

**B3 — `.env` anlegen** (`cp .env.example .env`) und setzen:
```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/jtc_org   # App↔db-Container
NEXT_PUBLIC_SITE_URL=https://join-the-captain.org
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=join-the-captain.org
ANTHROPIC_API_KEY=sk-ant-...        # echte Keys
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SESSION_SECRET=<langer-zufallswert>
```

> ⚠️ **`NEXT_PUBLIC_*` ist build-time in Client-Komponenten.** Next.js backt
> `NEXT_PUBLIC_*` beim `next build` ins Client-Bundle. Werte, die in echten
> Client-Komponenten landen (z. B. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
> Plausible-Events), müssen **schon beim Build** gesetzt sein, sonst sind sie
> leer. `NEXT_PUBLIC_SITE_URL` und die Plausible-`data-domain` werden hier
> serverseitig zur Renderzeit gelesen und funktionieren auch zur Laufzeit.
> Empfehlung: vor dem Build die `NEXT_PUBLIC_*`-Werte als Build-Args/Env
> bereitstellen (das Dockerfile/`docker-compose.yml` lässt sich dafür um
> `ARG`/`build.args` ergänzen — sag Bescheid, ich mache das sauber).

**B4 — Production-Härtung der Compose-Datei** (empfohlen, vor `up`):
- `web`-Port nur lokal binden: `"127.0.0.1:3000:3000"` (nginx terminiert öffentlich).
- `db`-Port **nicht** öffentlich mappen (oder nur `127.0.0.1:5432:5432` für die
  einmalige Host-Migration, danach schließen).
- Beiden Services `restart: unless-stopped` geben (Boot-Persistenz).

**B5 — Build, Start, DB migrieren + seeden:**
```bash
docker compose up -d --build           # web → 127.0.0.1:3000, db intern

# Migration/Seed brauchen Dev-Deps (tsx) → am einfachsten vom Host gegen die
# (temporär auf 127.0.0.1:5432 gemappte) DB:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jtc_org \
  npm ci && npm run db:migrate && npm run db:seed
# danach den db-Port in docker-compose.yml wieder schließen + `docker compose up -d`
```

**B6 — nginx-Server-Block** `/etc/nginx/sites-available/jtc-org`
(reiner Reverse-Proxy auf den Next-Container; Stripe-Webhook läuft über
denselben `location /`):
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name join-the-captain.org www.join-the-captain.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade            $http_upgrade;
        proxy_set_header Connection         'upgrade';
        proxy_set_header Host               $host;
        proxy_set_header X-Real-IP          $remote_addr;
        proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/jtc-org /etc/nginx/sites-enabled/jtc-org
nginx -t && systemctl reload nginx
```

**B7 — TLS** (erst nachdem `dig` auf die VPS-IP zeigt):
```bash
certbot --nginx -d join-the-captain.org -d www.join-the-captain.org
```
Certbot ergänzt automatisch den 443-Block + HTTP→HTTPS-Redirect.

**B8 — Stripe-Webhook** im Stripe-Dashboard auf
`https://join-the-captain.org/api/webhooks/stripe` setzen, `whsec_...` in `.env`
übernehmen, `docker compose up -d` neu laden.

---

## C) Neuen Stand ausrollen (wiederholbar)

```bash
cd /srv/jtc-org/repo
git pull
docker compose up -d --build
# bei DB-Änderungen zusätzlich: npm run db:migrate (gegen die DB)
```

Optional später: Deploy-Script analog zu `.de` (`scripts/deploy.sh`) oder
GitHub-Actions, das ein Image baut/pusht und der VPS nur `pull` macht.

## D) Smoke-Test

```bash
curl -sS -I https://join-the-captain.org            # 200/308
curl -sS https://join-the-captain.org/sitemap.xml | head
curl -sS https://join-the-captain.org/robots.txt
```
`.de` gegenprüfen (muss unverändert laufen):
`curl -sS https://www.join-the-captain.de/api/health`.
