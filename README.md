# join-the-captain.org

Das Community- und Medien-Standbein der Segel-Plattform **Join the Captain**.
`.org` vereint vier Bereiche, die sich Daten teilen:

1. **Feature-Loop** (`/community`) — Segler wünschen Features, eine KI
   strukturiert, prüft und schätzt, die Crew votet und unterstützt per Pledge.
2. **Tool-Verzeichnis** (`/tools`) — Affiliate-Apps „Tools für deinen Törn",
   nach Journey-Phase filterbar.
3. **Podcast** (`/podcast`) — Folgen-Liste mit Player.
4. **Segler-Entrepreneurs** (`/entrepreneurs`) — Partner-Netzwerk.

> `.de` bleibt die separate Buchungsplattform und ist **nicht** Teil dieses
> Repos. Der Header verlinkt nur dorthin.

Die Kopplung: Findet der App-Scout im Feature-Loop eine existierende App, wird
daraus ein Eintrag im Tool-Verzeichnis. Beide nutzen dasselbe
`affiliate_tool`-Modell.

---

## Tech-Stack

- **Next.js 15** (App Router) + TypeScript, Route Handlers fürs Backend
- **PostgreSQL** (Supabase-kompatibel), versionierte SQL-Migrationen
- **Stripe** (PaymentIntents) für Feature-Pledges
- **Anthropic API** — `claude-haiku-4-5-20251001` (Moderation, Strukturierung,
  App-Scout), `claude-sonnet-4-6` (Sizing)
- **Plausible** (DSGVO-Analytics, ohne Cookies)
- **Docker** auf Linux-VPS

---

## Schnellstart (lokal)

### 1. Voraussetzungen
- Node 20+ und ein erreichbares PostgreSQL (lokal oder via `docker compose up db`).

### 2. Abhängigkeiten & Umgebung
```bash
npm install
cp .env.example .env      # Werte eintragen (siehe unten)
```

### 3. Datenbank aufsetzen
```bash
npm run db:migrate        # Migrationen einspielen
npm run db:seed           # Demo-Daten: 1 Runde, 3 Features, 6 Tools, 2 Folgen, 4 Partner
```

### 4. Starten
```bash
npm run dev               # http://localhost:3000
```

Ohne API-Keys läuft die Site vollständig: Board, Verzeichnis, Podcast und
Partner zeigen die Seed-Daten. KI-Pipeline und echte Stripe-Zahlungen brauchen
die jeweiligen Keys (siehe unten) — fehlen sie, degradiert die App freundlich
(Pledge wird als `offen` vermerkt, Pipeline-Fehler verlieren keinen Wunsch).

---

## Umgebungsvariablen

Siehe `.env.example`. Wichtigste:

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | PostgreSQL-Verbindung (Pflicht) |
| `ANTHROPIC_API_KEY` | KI-Pipeline (Moderation, Struktur, Scout, Sizing) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Pledges + Webhook |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Analytics aktivieren |
| `NEXT_PUBLIC_SITE_URL` | Basis-URL für SEO/Sitemap/OG |

---

## KI-Pipeline (Feature-Loop)

Bei neuem `feature_request` laufen drei Bots sequenziell. Jeder Schritt ist
**idempotent** (`pipeline_log`, ein OK pro Feature+Schritt), **geloggt** und
**einzeln retrybar** — ein API-Fehler bricht ab, ohne Daten zu verlieren.

1. **Strukturierer** (Haiku): Freitext → `{titel, journey_phase, problem,
   nutzen}`, Status `in_pruefung`.
2. **App-Scout** (Haiku): existiert eine etablierte App? Wenn ja → `affiliate_tool`
   anlegen (`veroeffentlicht=false`), Status `affiliate`, Pipeline endet. Wenn
   nein → weiter.
3. **Sizer** (Sonnet): Aufwand für den JTC-Stack → `{size, dev_tage, eur,
   begruendung}`, Status `voting`, der offenen Runde zugeordnet.

Vorgelagert prüft `moderateText()`: `block` lehnt die Einreichung freundlich ab,
`flag` lässt durch und schreibt ins `mod_log`. Nie auto-bannen.

### Pipeline manuell triggern

**CLI:**
```bash
npm run pipeline:run -- <feature_id>     # ein Feature
npm run pipeline:run -- --all-neu        # alle offenen
```

**Test-Endpoint** (nur außerhalb Produktion):
```bash
curl -X POST http://localhost:3000/api/dev/pipeline \
  -H 'Content-Type: application/json' -d '{"all_neu": true}'
```

End-to-End-Test: einen Wunsch posten und die Pipeline laufen lassen:
```bash
curl -X POST http://localhost:3000/api/features \
  -H 'Content-Type: application/json' \
  -d '{"text":"Ich hätte gern eine App, die mir die beste Ankerbucht im Revier vorschlägt."}'
```

---

## Stripe lokal testen

1. Keys in `.env` setzen (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
2. Webhook-Forwarding starten:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Das ausgegebene `whsec_...` als `STRIPE_WEBHOOK_SECRET` eintragen.
3. Pledge auslösen (Board → „Beitragen" oder per API):
   ```bash
   curl -X POST http://localhost:3000/api/features/<id>/pledge \
     -H 'Content-Type: application/json' -d '{"betrag_cent": 1000}'
   ```
   Das erzeugt einen PaymentIntent; das Pledge steht zunächst auf `offen`.
4. Zahlung bestätigen (Testmodus):
   ```bash
   stripe trigger payment_intent.succeeded
   ```
   Der Webhook setzt das Pledge auf `bezahlt`. **Fortschritt = Summe der
   bezahlten Pledges** — erst jetzt wandert der Progress-Balken.

> **Pledge-Sprache:** Ein Pledge ist freiwillige *Unterstützung* ohne
> Lieferversprechen. In Code und UI strikt „Unterstütze / beitragen /
> Feature-Pledge" — niemals „investieren / Anteil / Rendite". Beträge in Cent.

---

## SEO-Check

- **Pro Tool-/Podcast-Seite:** dynamische `<title>`/`<meta description>`,
  Open-Graph-Tags, JSON-LD (`SoftwareApplication` bzw. `PodcastEpisode`).
- **`sitemap.xml`** und **`robots.txt`** werden generiert (`/sitemap.xml`,
  `/robots.txt`).
- Sprechende Slugs, saubere Heading-Hierarchie, SSR für alle Listen.

Schnell prüfen:
```bash
curl -s localhost:3000/sitemap.xml | head
curl -s localhost:3000/robots.txt
curl -s localhost:3000/tools/navi-seekarten | grep -o 'application/ld+json'
curl -s localhost:3000/tools/navi-seekarten | grep -o '<title>[^<]*</title>'
```

---

## Compliance

- **Affiliate (UWG):** Jeder Affiliate-Link ist sichtbar als „Affiliate · ohne
  Mehrkosten" gekennzeichnet. Klicks laufen **immer** über
  `/api/tools/:id/click` (Tracking + Redirect), nie direkt auf die Ziel-URL.
- **Plausible statt Cookies**, keine PII in URLs/Query-Params; im
  Klick-Tracking wird nur der Referrer-*Host* gespeichert.
- **Externe Links:** `target="_blank" rel="noopener noreferrer"`.

---

## API-Überblick

| Methode & Pfad | Zweck |
|---|---|
| `POST /api/features` | Wunsch einreichen (Moderation + Pipeline) |
| `GET /api/features` | Board der aktuellen Runde, nach Votes sortiert |
| `GET /api/features/:id` | Feature-Detail + Pledge-Liste |
| `POST /api/features/:id/vote` | Vote (Toggle, 1/User) |
| `POST /api/features/:id/pledge` | Feature-Pledge (PaymentIntent) |
| `POST /api/webhooks/stripe` | Pledge-Bestätigung |
| `GET /api/tools?phase=` | Tool-Verzeichnis, optional gefiltert |
| `GET /api/tools/:slug` | Tool-Detail + verwandte Tools |
| `GET\|POST /api/tools/:id/click` | Affiliate-Klick: Tracking + Redirect |
| `GET /api/podcast` | Veröffentlichte Folgen |
| `POST /api/webhooks/discord` | Stub (Bot ist nicht Teil dieser Aufgabe) |

---

## Projektstruktur

```
migrations/        Versionierte SQL-Migrationen
scripts/           migrate, seed, run-pipeline (tsx-CLI)
src/lib/           db, types, anthropic, pipeline, moderation, stripe, data, session
src/app/           App-Router-Seiten + Route Handler (api/)
src/components/     Icons, Header/Footer, Tool-/Feature-Karten, Community-Widgets
docs/design-paket.md  Marken- & Design-Spezifikation
```

---

## Nicht in diesem Scope (Stubs/TODO)

- **Discord-Bot** selbst — nur der Webhook-Endpoint (Stub) ist da.
- **`.de`-Integration** — nur verlinkt.
- **Vollständiges Auth** — ein klar markierter Session-Stub
  (`src/lib/session.ts`) ordnet Votes/Pledges per Cookie zu. Nicht für
  Produktion.
- **Kommentare** auf der Feature-Detail-Seite — Platzhalter.

---

## Build & Docker

```bash
npm run build                 # Produktions-Build (ohne DB/Keys möglich)
docker compose up --build     # App + PostgreSQL
# danach einmalig auf dem Host: npm run db:migrate && npm run db:seed
```
