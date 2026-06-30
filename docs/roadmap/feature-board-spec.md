# Feature-Board — kanonische Build-Spec

Die zentrale Oberfläche unter `/community`: Segler reichen Feature-Wünsche ein,
eine KI strukturiert/prüft/sized sie, die Community votet, Pledges machen
Unterstützung sichtbar. Drei Ergebnisse: **BUILD**, **AFFILIATE**, **VERWORFEN**.

> Diese Spec ist die SSOT für den Loop. Vieles ist in diesem Repo bereits
> umgesetzt — siehe **Umsetzungsstand** unten. Brand-Voice vor jeder Copy:
> `/mnt/skills/user/jtc-brand-voice/SKILL.md` (Du-Form, kurze Sätze, maritim,
> kein „Ahoi").

## Datenmodell

```
feature_request: id, autor_id, autor_name, titel, journey_phase
  [vor_buchung|planung|auf_dem_toern|danach], problem, nutzen,
  status [neu|in_pruefung|voting|build|affiliate|verworfen|umgesetzt],
  size [S|M|L|XL|null], dev_tage_min, dev_tage_max, eur_min, eur_max,
  sizing_begruendung, runde_id, created_at, updated_at
vote:    id, feature_id, user_id, created_at  (UNIQUE feature_id+user_id)
pledge:  id, feature_id, user_id, betrag_cent,
         status [offen|bezahlt|erstattet], stripe_payment_intent_id, created_at
runde:   id, monat, status [offen|voting|abgeschlossen], voting_endet_am, created_at
affiliate_tool: id, feature_id (nullable), name, slug, kategorie, journey_phase,
  kurzbeschreibung, beschreibung_md, affiliate_url, rating, icon_key,
  pro_contra_json, veroeffentlicht (bool), created_at
tool_click:      id, tool_id, referrer, created_at
podcast_episode: id, titel, folge_nr, beschreibung, audio_url, dauer_sek,
                 veroeffentlicht_am, slug
partner:         id, name, rolle, kurzbeschreibung, url, logo_key, sortierung
```

## KI-Pipeline (3 Bots, sequenziell, Anthropic API)

Bei neuem `feature_request`:

1. **STRUKTURIERER** (`claude-haiku-4-5-20251001`) — Freitext →
   `{titel, journey_phase, problem, nutzen}`, `status=in_pruefung`. Ton: ruhig, Du-Form.
2. **APP-SCOUT** (Haiku) — `{existiert, app_name?, begruendung}`. Wenn ja:
   `affiliate_tool` anlegen (`veroeffentlicht=false`, `feature_id` gesetzt),
   `status=affiliate`, Pipeline endet. Wenn nein: weiter. **Keine Apps erfinden;
   bei Unsicherheit `existiert=false`.**
3. **SIZER** (`claude-sonnet-4-6`) — Aufwand für den JTC-Stack →
   `{size, dev_tage_min/max, eur_min/max, begruendung}`. Bei Unsicherheit
   aufrunden. `status=voting`, der offenen Runde zuordnen.

Jeder Schritt **idempotent + geloggt + retrybar**; API-Fehler bricht ab, ohne
Daten zu verlieren. Vorgelagert `moderateText(text) → {ok|flag|block, grund}`:
`block` = freundlich ablehnen (Du-Form), `flag` = durchlassen + `mod_log`.
**Nie auto-bannen.**

## Pledge (Stripe)

Pledge = freiwillige **Unterstützung** ohne Lieferversprechen. Wording in Code +
UI strikt: „Unterstütze", „beitragen", „Feature-Pledge". **Niemals** „investieren",
„Anteil", „Rendite". PaymentIntent erzeugen, Bestätigung per Webhook, **Fortschritt
= Summe bezahlter Pledges**. Beträge in Cent.

## API-Endpoints

```
POST /api/features            Wunsch einreichen → triggert Pipeline
GET  /api/features            Liste aktuelle Runde, sort by Votes
GET  /api/features/:id        Detail
POST /api/features/:id/vote   1 Vote/User (toggle)
POST /api/features/:id/pledge Stripe PaymentIntent erzeugen
POST /api/webhooks/stripe     Pledge-Status → bezahlt
GET  /api/tools (?phase=)     Tool-Verzeichnis
GET  /api/tools/:slug         Tool-Detail
POST /api/tools/:id/click     Affiliate-Klick: Tracking + Redirect
GET  /api/podcast             Veröffentlichte Folgen
POST /api/webhooks/discord    Stub für späteren Bot
```

## Frontend — Karten & States

Board-Header (Runde + Countdown) · Mini-Stepper (4 Schritte) · Wunsch-Input ·
Karten-Grid `auto-fit, minmax(280px, 1fr)` (Desktop 3 / Tablet 2 / Mobile 1).

- **BUILD:** Sizing-Tag, Gold-Pledge-Progress, Vote- + Beitragen-Button.
- **AFFILIATE:** blaues „Gibt's schon"-Badge, eingebettete App-Sub-Card mit
  Pflicht-Disclaimer „Affiliate-Link · für dich ohne Mehrkosten".
- **VERWORFEN:** faded (opacity 0.7), grauer Badge, Buttons disabled.
- **States:** Hover, Voted (✓), Pledging (inline Betrag-Input), Empty State,
  Loading-Skelette. KI-Crewguard-Footer.

Compliance: jeder Affiliate-Link gekennzeichnet (UWG) + Klick über
`/api/tools/:id/click`; Plausible statt Cookies; keine PII in URLs; externe
Links `target=_blank rel=noopener noreferrer`; WCAG-AA-Kontrast; Touch ≥ 44px.

## Seed-Daten

1 offene Runde + 3 Features (je `build`/`affiliate`/`verworfen`, Du-Form-Copy,
Build-Beispiel „Bordkassen-Splitter mit Foto-Belegen") + 6 `affiliate_tools`
über alle 4 Phasen + 2 Podcast-Folgen + 4 Partner.

---

## Umsetzungsstand (Stand: 2026-06-30)

Der Loop ist in diesem Repo bereits **funktional gebaut** (helles Theme,
Poppins) — siehe `src/app/community`, `src/app/api`, `src/lib/pipeline.ts`,
`scripts/seed.ts`, `migrations/0001_init.sql`, Haupt-[README](../../README.md).

| Bereich | Status |
|---|---|
| Datenmodell + Migrationen | ✅ gebaut |
| KI-Pipeline (3 Bots) + Moderation | ✅ gebaut |
| API-Endpoints | ✅ gebaut |
| `/community`-Board + 3 Kartentypen + States | ✅ gebaut (helles Design) |
| Tool-Verzeichnis + Detail, Podcast, Entrepreneurs | ✅ gebaut |
| Stripe-Pledges + Webhook | ✅ gebaut |
| Seed-Daten | ✅ gebaut |
| **Dark-Redesign des Boards** | 🔜 offen — Design-Mockup liegt noch im **hellen** Theme (`docs/design/quellen/Join the Captain Feature-Board.zip`); die Startseite ist bereits dunkel. Theme-Reichweite ist zu entscheiden. |
| **Discord-Bot selbst** | 🔜 Stub (`/api/webhooks/discord`); Bot-Logik künftig (siehe [community-mvp-4-wochen.md](community-mvp-4-wochen.md)). |
| **Pledge-pro-Feature-Crowdfunding (rechtlich)** | 🔜 Anwalt klären, bevor scharf geschaltet. |
| **Vollständiges Auth** | 🔜 aktuell Session-Stub (`src/lib/session.ts`), nicht produktionsreif. |
