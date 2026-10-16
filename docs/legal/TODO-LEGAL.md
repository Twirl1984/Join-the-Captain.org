# Abmahn-Audit 2026-10-16 — Stand .org (Branch legal/org-abmahn-audit)

Seite ist offline (nginx 503). Wieder online erst nach „Entscheidung nötig“.

## Erledigt (Code, getestet: `src/lib/__tests__/legal-hygiene.test.ts`)
- O-01: `AffiliateLabel` („Werbung“) vor allen Provisionslinks, CTA „Zum Anbieter (Werbung)“, `rel="sponsored nofollow noopener noreferrer"`, Footer-/Startseitentext neu
- O-02: Claims „Geprüfte Tools, ehrliche Empfehlungen“, „Kein Marketing-Lärm“ entfernt (UI, Meta, i18n); neue Seite `/so-waehlen-wir-aus`
- O-03: sichtbares „JTC“ → „Join the Captain“
- O-04 (teilweise): Versicherungs-Bullets „Laut Anbieter …“, „bis 5.000 €“/„Tagesgenau“ entfernt
- O-05 (teilweise): Impressum ohne ODR; Footer-Link vorhanden
- O-07: Stripe.js wird nicht geladen; `next/font` self-hosted; Plausible (cookielos) ist einziger Dritt-Request

## Noch offen (größere Features / Entscheidung)
- O-04: Migration `claims_source_url`/`claims_checked_at` + „Stand: Datum“ je Tool; Hinweis „Keine Versicherungsberatung“ unter der Box
- O-05: **USt-IdNr.** ergänzen (Nummer nennen), Variante D.1, EN „Legal Notice (Impressum)“; § 18 Abs. 2 MStV für Blog
- O-06: Datenschutzseite aus Verarbeitungsinventar neu (Anthropic, Stripe, Plausible, Hosting-Logs, Klick-Tracking `/api/tools/*/click`, Session-Cookie, Mail); `docs/processing-inventory.md`
- O-08: Community-Nutzungsbedingungen, „Inhalt melden“ (`/api/reports`), KI-Hinweis vor Absenden (Anthropic USA)
- O-09: Pledge-Flow (Endbetrag, Checkbox, Button „Jetzt zahlungspflichtig unterstützen“, Bedingungen) — anwaltlich: Gegenleistung ja/nein
- O-10/O-11: Reiseblog-Preise nur mit „Stand“; `docs/media-licenses.md`; `/preise` PAngV/USt; EN-Footer; BFSG-Bewertung; Newsletter nur DOI
- Playwright `e2e/no-third-party.spec.ts` (alle Sitemap-Routen ohne Interaktion) — braucht Build/Server
