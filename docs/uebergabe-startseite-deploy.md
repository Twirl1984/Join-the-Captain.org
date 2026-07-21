# Übergabe-Prompt — join-the-captain.org: Startseite-Redesign, Dark/Light-Theme & VPS-Deploy

> Stand: 2026-07-21. Diese Datei ist als **Prompt für einen neuen Chat** gedacht
> (copy-paste), damit Kontext und Weiterentwicklung nicht verloren gehen.
> Verifizierte Fakten sind als „✓ verifiziert" markiert; „⚠ prüfen" heißt: auf
> dem VPS/Repo bestätigen, bevor du darauf baust.

---

## Rolle & Auftrag

Du übernimmst die Weiterentwicklung von **join-the-captain.org** (kurz `.org`) —
dem Community-/Medien-Standbein der Segel-Plattform „Join the Captain". Dieser
Workstream drehte sich um das **Startseiten-Redesign**, ein **umschaltbares
Dark/Light-Theme** und das **parallele Deployment neben `.de`** auf dem Strato-VPS.
Halte dich an die Projektregeln in `CLAUDE.md` (ASPICE/ISTQB, Requirements-IDs,
`npm run verify`, Feature-Flags, nie direkt auf `main` pushen, Brand-Voice).

## Projekt-Architektur (Gesamtbild)

- **`.de`** = Buchungsplattform (Repo `Twirl1984/join-the-captain`), separat,
  **nicht** Teil dieses Repos. `.org`-Header verlinkt nur dorthin.
- **`.org`** = dieses Repo (`Twirl1984/Join-the-Captain.org`), Next.js 15 (App
  Router) + TypeScript + PostgreSQL, dockerisiert. Bereiche: Startseite, Tool-
  Verzeichnis (`/tools`), Community-Feature-Loop (`/community`), Podcast, Segler-
  Entrepreneurs, **Wetter** (`/wetter`), **Navigation** (`/navigation`, hinter
  Feature-Flag), Impressum/Datenschutz.
- **Discord** = geplanter zentraler Community-Hub + KI-Bot (Roadmap, noch nicht
  gebaut — nur Webhook-Stub).
- Details: `docs/roadmap/architektur.md`, `docs/design-paket.md`.

## Was in diesem Workstream geliefert wurde ✓

1. **Umschaltbares Dark/Light-Theme** (wie bei certi4safety): `[data-theme]` auf
   `<html>`, semantische CSS-Tokens in `src/app/globals.css` (Dark = Default =
   neues Startdesign, Light als zweiter Skin). Marken-Akzente **Gold `#c8a84b`**
   + Teal `#2f9ec0` bleiben in beiden Skins. Toggle: `src/components/ThemeToggle.tsx`
   (☀/🌙, `localStorage`-Persistenz), Anti-Flicker-Script in `src/app/layout.tsx`,
   `suppressHydrationWarning`. Fonts: **Playfair Display** (Headlines, gold-kursiv)
   + **Outfit** (Body) via `next/font`. Scharfe Ecken (Radius 0). **Legacy-Aliase**
   in globals.css (`--navy-deep`, `--teal`, `--salt-white`…) mappen auf die neuen
   Tokens, damit ältere Seiten automatisch mitziehen.
2. **Startseite neu** (`src/app/page.tsx`): Foto-Hero (`public/assets/photos/`),
   Tool-Verzeichnis mit Journey-Filter-Pills (`src/components/HomeToolFilter.tsx`),
   „Im Fokus · Vor dem Törn · Absicherung", Podcast-Strip, Community-Teaser,
   Entrepreneurs, Affiliate-Disclaimer. Header/Footer/ToolCard aufs neue Design.
3. **Versicherungs-Korrektur**: Versicherung gehört **vor** den Törn → Seed-Tool
   „Skipper-Versicherung" auf `journey_phase = planung` (nicht `danach`);
   Im-Fokus-CTA verlinkt `/tools?phase=planung`. Danach = nur noch Support/Schaden-
   klärung.
4. **Deploy-Infra + Doku**: `docs/DEPLOYMENT.md` (Prod-Deploy parallel zu `.de` +
   Strato-DNS), `docs/deploy-test-vps.md` (isolierte Test-Instanz + HTTPS-Nachtrag),
   `docs/roadmap/*`, `docs/design/*`. **SSL-Fix** für Docker-Postgres:
   `sslmode=disable` in `src/lib/db.ts` + `scripts/migrate.ts`; Compose-Files
   setzen `?sslmode=disable` (Supabase-TLS unberührt).

> ⚠ In ~3 Wochen paralleler Arbeit kam viel dazu (Navigation-App, Wetter-Tool,
> Impressum/Datenschutz, PWA, ASPICE/ISTQB-Prozess). Das Redesign ist im aktuellen
> `main` (`df4c5b8`) integriert; einzelne Commit-SHAs aus dem Redesign-Branch
> stehen nicht mehr 1:1 in der History.

## Aktueller Deploy-Zustand auf dem VPS ✓ (Stand 2026-07-21)

- **VPS:** Strato, IP `194.164.197.23`, Root-SSH. nginx (80/443) + Certbot/Let's
  Encrypt. `.de` Prod läuft unberührt (`https://www.join-the-captain.de/api/health`
  → `{"status":"ok"}`).
- **DNS (Strato):** `A @` + `A www` → `194.164.197.23` gesetzt & propagiert. ✓
- **TLS:** Let's-Encrypt-Zertifikat für `join-the-captain.org` (+www), Auto-Renew.
- **Laufende `.org`-Docker-Instanzen** (jede isoliert: eigenes `/srv/…`, eigenes
  Compose-Projekt, eigene Postgres):
  - `jtc-org-test`  → Container `127.0.0.1:3101`, Verz. `/srv/jtc-org-test/repo`.
  - `jtc-org-staging` → Container `127.0.0.1:3102`.
- **nginx-Blöcke** (`/etc/nginx/sites-enabled/`): `jtc-org-http80` (Port 80: ACME
  + Redirect), `jtc-org-main` (443 → `:3101`, **öffentlich, ohne Basic-Auth**),
  `jtc-org-test` (Port 3100 ssl → `:3101`, **Basic-Auth**), `jtc-org-staging`
  (→ `:3102`).
- **Erreichbar:**
  - `https://join-the-captain.org` → **200, öffentlich (keine Auth)**, bedient die
    Test-Instanz-Container `:3101`.
  - `https://join-the-captain.org:3100` → Basic-Auth (`jtc` / `Toern-org-2026`).
- ⚠ **Zu klären / aufzuräumen:** Es gibt mehrere `.org`-Instanzen/Blöcke
  (test/staging/main), die teils auf denselben Container zeigen. Vor „echtem Prod"
  konsolidieren: ein sauberer Prod-Pfad (`/srv/jtc-org`, eigenes Compose, eigene
  DB) gemäß `docs/DEPLOYMENT.md` B4–B8, und entscheiden, welche Instanz „Prod" ist.

## Offene Entscheidungen & nächste Schritte

1. **Indexierung:** `https://join-the-captain.org` ist aktuell **öffentlich (200)**.
   `layout.tsx`-Metadata hat `robots: { index: true }`. Solange nur **Demo-Seed**
   drauf ist → überlegen, ob **`noindex`-Soft-Launch** (nginx `add_header
   X-Robots-Tag "noindex"` oder Metadata) besser ist, bis echte Inhalte stehen.
   Umschalten ist 1 Zeile + reload/rebuild.
2. **Echte Inhalte:** Betreiber pflegt Tools/Podcast/Partner parallel ein; Demo-
   Seed (`scripts/seed.ts`) ist Platzhalter und ersetzbar/leerbar.
3. **API-Keys** (`ANTHROPIC_API_KEY`, `STRIPE_*`, `SESSION_SECRET`): aktuell nicht
   gesetzt → KI-Feature-Loop & Stripe-Pledges aus. Später per `.env` +
   `docker compose up -d --build` nachziehen. **Merke:** `NEXT_PUBLIC_*` (z. B.
   Stripe-Publishable-Key) wird zur **Build-Zeit** ins Client-Bundle gebacken →
   für Client-Nutzung als Docker-Build-Arg setzen (Dockerfile/Compose ggf. ergänzen).
4. **Prod-Konsolidierung:** sauberen Prod-Deploy gemäß `docs/DEPLOYMENT.md`
   aufsetzen und die Test/Staging-Instanzen aufräumen (`docs/deploy-test-vps.md`
   „Aufräumen").
5. **Feature-Board `/community` Dark-Redesign:** Das Design-Mockup liegt noch im
   **hellen** Theme (`docs/design/quellen/Join the Captain Feature-Board.zip`) —
   dunkel nachziehen. Spec: `docs/roadmap/feature-board-spec.md`.
6. **Discord-Bot** + Pledge-Crowdfunding (rechtlich prüfen): `docs/roadmap/
   community-mvp-4-wochen.md`.

## Operative Merkposten (nicht stolpern)

- **Git-Email-Privacy:** Push wird abgelehnt, wenn Commits die private Gmail tragen
  (`GH007`). Commits müssen die GitHub-Noreply nutzen:
  `174448456+Twirl1984@users.noreply.github.com`. **Kein Force-Push / kein
  `filter-branch`** ohne ausdrückliches OK des Nutzers — der Auto-Mode-Classifier
  blockt History-Rewrites (zu Recht).
- **Feature-Flags** (`src/lib/flags.ts`): Kill-Switch-Muster, Default AN,
  `NEXT_PUBLIC_FEATURE_*` = build-time. `navigationEnabled()` steuert `/navigation`.
- **Prozess (verbindlich):** ASPICE/ISTQB — `docs/REQUIREMENTS.md`,
  `docs/TRACEABILITY.md`, Requirements-IDs Pflicht, Tests tragen `[REQ-…]`,
  `npm run verify` (Lint + Typecheck + Tests + `trace`). Bei Widersprüchen: stoppen
  und den Nutzer fragen (REQ-PROC-002).
- **Sicherheits-Wording:** `/wetter` und `/navigation` sind Entscheidungshilfen —
  keine Formulierungen, die amtliche Seekarten/Seemannschaft ersetzen; Haftungs-
  hinweise in UI-Footern nur nach Freigabe ändern.
- **VPS-Test-Instanz aktualisieren:** lokal `rsync` nach `/srv/jtc-org-test/repo`,
  dann `docker compose -p jtc-org-test -f docker-compose.test.yml up -d --build`,
  bei Daten `npm run db:seed` via Einweg-`node:22-slim`-Container im Compose-Netz
  (Runbook: `docs/deploy-test-vps.md`).

## Wichtige Dateien

- Design/Theme: `src/app/globals.css`, `src/app/layout.tsx`,
  `src/components/{ThemeToggle,SiteHeader,SiteFooter,ToolCard,HomeToolFilter,Icon}.tsx`
- Startseite: `src/app/page.tsx` · Seed: `scripts/seed.ts` · DB: `src/lib/db.ts`
- Deploy: `docs/DEPLOYMENT.md`, `docs/deploy-test-vps.md`,
  `docker-compose.yml`, `docker-compose.test.yml`
- Strategie/Design: `docs/roadmap/*`, `docs/design/*`, `docs/design-paket.md`

## Erste Schritte für dich (empfohlen)

1. `git log --oneline -10` + `npm run verify` lokal grün ziehen.
2. Auf dem VPS `docker ps` + `ls /etc/nginx/sites-enabled/` prüfen und den
   Instanz-/Block-Dschungel (test/staging/main) mit dem Nutzer sortieren.
3. Mit dem Nutzer die zwei Kern-Entscheidungen klären: **(a) index vs. noindex**
   für die öffentliche Domain, **(b)** wann echte Inhalte den Demo-Seed ersetzen.
4. Erst dann sauberen **Prod-Deploy** gemäß `docs/DEPLOYMENT.md` konsolidieren.
