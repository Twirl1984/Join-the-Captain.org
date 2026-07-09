# Discovery-Agent — YouTube-Video-Entdeckung + Outreach

Der **Discovery-Agent** ergänzt die Plattform um eine nächtliche,
**automatisierte Video-Entdeckung** für Segel-Themen auf YouTube — mit
strukturierter Qualitätsbewertung, **Outreach-Drafts** (kein Auto-Send) und
Community-Freigabe.

**Kern-Prinzip:** Agent sammelt & entwirft, Mensch gibt frei. Kein Auto-Send,
kein Auto-Publish.

## Spezifikation & Sicherheit

- **Embed-only:** oEmbed (iframe-HTML), kein Download.
- **YouTube-Daten:** Nur via offizielle YouTube Data API (mit Quota).
  - Feature-geflaggt (ENV `YOUTUBE_DISCOVERY_ENABLED=false`, Standard).
  - API-Key optional; ohne Key bleibt die Quelle inaktiv.
  - Nur **öffentliche Video-Metadaten** (Titel, Beschreibung, Published_at).
  - Top-Kommentare nur via **offizielle API**, keine PII in Klartexlogs.
- **Budget-Harte Grenzen:**
  - `MAX_RUN_BUDGET_EUR` (0.25 EUR/Lauf, default) → Haiku-Kosten.
  - `MAX_DAILY_BUDGET_EUR` (0.25 EUR/Tag, informativ).
  - **Stop & Teilergebnis** bei Erreichen (kein Overshooting).
- **Outreach:** Nur als **Draft** (kein Auto-Send). Admin-Freigabe zwingt
  menschliche Kontrolle vor Versand via n8n/Mail.
- **DSGVO:** Nur öffentliche Daten. Outreach erst nach Freigabe.
- **Affiliate:** Immer gekennzeichnet (`rel="sponsored nofollow"`).

## Flow — nächtlicher Ablauf

1. **Trigger:** Cron-Job (z. B. täglich 2 Uhr) ruft `npm run discovery:run` auf.

2. **Thema-Auswahl:**
   - Wähle 1–2 `topics` mit höchster `priority` + ältestem `last_run_at`.
   - Status muss `active` sein (kann über Admin pausiert werden).

3. **YouTube-Suche** (wenn `YOUTUBE_DISCOVERY_ENABLED=true` + `YOUTUBE_API_KEY` vorhanden):
   - YouTube Data API: `search.list(q=topic.title, type=video, part=snippet, maxResults=3)`.
   - Pro Video: `videos.list(id=video_id, part=snippet,statistics,contentDetails)`.
   - Top 1–2 Kommentare via `commentThreads.list` (öffentlich, @channel-weise).

4. **oEmbed-Metadaten** (gratis, über `youtube.com/oembed`):
   - Title, author_name, author_url, embed (iframe-HTML).
   - **Keine Download-URL generieren.**

5. **Haiku-Strukturierung** (Token-budgetiert):
   - Input: Video-Metadaten + Beschreibung + Top-Kommentare.
   - Aufgaben:
     - Relevanz-Scoring (0..1, wie gut passt zum Thema).
     - Sprache-Erkennung (de/en/andere).
     - Kurz-Summary (1-2 Sätze, Du-Form, Seglersprache).
     - **Produkt-Extraktion** (z. B. „Navionics erwähnt um 5:30").
   - Output: `StructuredVideo` (JSON).

6. **Relevanz-Filter:**
   - Nur `relevance_score ≥ DISCOVERY_MIN_RELEVANCE` (0.6, default) speichern.
   - Niedrigere Scores: stillschweigend überspringen.

7. **Speichern** (Transaktion):
   - `creator_submissions.insert` (source_type='discovered', status='pending').
   - `outreach_queue.insert` (draft_subject, draft_body, status='draft').
   - `submission_products.insert` (falls Haiku Produkte erkannt, status='proposed').

8. **Budget-Log:**
   - `run_budget_log.insert` (ai_cost_eur, search_calls, candidates_found,
     outreach_drafts, stopped_reason).
   - `stopped_reason`: 'completed' | 'budget_reached' | 'error'.

9. **Thema-Update:**
   - `topics.last_run_at := now()`.

## Admin-Freigabe-Flow

### 1. Pending Submissions Review

**Route:** `GET /api/discovery/submissions?status=pending`

Zeigt alle noch nicht freigegebenen Videos.

```json
{
  "submissions": [
    {
      "id": "uuid",
      "topic_id": "uuid",
      "video_title": "Anlegemanöver perfekt — 5 Tipps",
      "creator_handle": "@SeglerMüller",
      "creator_url": "https://youtube.com/@SeglerMüller",
      "embed_html": "<iframe ...></iframe>",
      "ai_summary": "Fünf praktische Anlegetechniken für Anfänger und Fortgeschrittene...",
      "suggested_products": [
        { "name": "Garmin", "mention_context": "GPS-Navigation erwähnt" }
      ],
      "relevance_score": 0.87,
      "status": "pending",
      "created_at": "2026-06-30T02:15:00Z"
    }
  ]
}
```

**Action:** `PATCH /api/discovery/submissions/[id]`

```json
{
  "action": "approve",
  "id": "submission-uuid"
}
```

→ `status='approved'`, `approved_by=user_id`, `approved_at=now()`.

Oder:

```json
{
  "action": "reject",
  "id": "submission-uuid",
  "reason": "Zu technisch für Anfänger, nicht ins Thema passend"
}
```

→ `status='rejected'`, `rejection_reason=…`.

### 2. Outreach-Queue Review

**Route:** `GET /api/discovery/outreach?status=draft`

Zeigt alle Outreach-Drafts (einem `creator_submissions.approved` zugeordnet).

```json
{
  "queue": [
    {
      "id": "outreach-uuid",
      "submission_id": "submission-uuid",
      "creator_handle": "@SeglerMüller",
      "platform": "email",
      "draft_subject": "Join the Captain — Video zu \"Anlegemanöver\"",
      "draft_body": "Hallo @SeglerMüller!\n\n…",
      "status": "draft",
      "created_at": "2026-06-30T02:16:00Z"
    }
  ]
}
```

**Action:** `PATCH /api/discovery/outreach/[id]`

Editieren (nur wenn draft):

```json
{
  "id": "outreach-uuid",
  "action": "edit",
  "draft_body": "Überarbeiteter Text…",
  "draft_subject": "Neue Subject-Zeile"
}
```

Freigeben:

```json
{
  "id": "outreach-uuid",
  "action": "approve"
}
```

→ `status='approved'`, `reviewed_by=user_id`, `reviewed_at=now()`.

Ablehnen:

```json
{
  "id": "outreach-uuid",
  "action": "discard"
}
```

→ `status='discarded'`.

## Stufe 2: Gadget-Affiliate (Feature-geflaggt)

Falls `DISCOVERY_GADGET_AFFILIATE_ENABLED=true`:

Haiku extrahiert Produktnamen aus Beschreibung + Kommentaren → `submission_products`
(status='proposed').

Admin trägt finale **Amazon-Affiliate-URL** ein + bestätigt Kennzeichnung
(`rel="sponsored nofollow"`) → `status='published'`.

Keine Auto-Affiliate.

**Route (future):** `PATCH /api/discovery/submissions/[id]/products/[prod_id]`

```json
{
  "affiliate_url": "https://amazon.de/s?k=Garmin&tag=jtc-21",
  "status": "published"
}
```

## Datenmodell (Migration `0004_discovery_agent.sql`)

| Tabelle | Zweck |
|---|---|
| `topics` | Segel-Themen für die Video-Suche (slug, title, status, priority, last_run_at). |
| `creator_submissions` | Videos/Creator-Inhalte (source_type='discovered', status='pending'\|'approved'\|'published'\|'rejected'). |
| `outreach_queue` | Outreach-Drafts zur Freigabe (draft_subject, draft_body, status='draft'\|'approved'\|'sent'\|'discarded'). |
| `submission_products` | Erkannte Produkte je Video (status='proposed'\|'published'\|'rejected'). Stufe 2. |
| `run_budget_log` | Budget- & Kosten-Log pro Lauf (ai_cost_eur, search_calls, candidates_found, stopped_reason). |
| `video_feedback` | Community-Freigabe-Reaktion (type='question'\|'not_understood'\|'praise'\|'issue', helpful_votes). |
| `affiliate_programm` | Neu: Strukturierte Anmeldungs-Liste für Affiliate-Programme (status='gefunden'\|'beworben'\|'aktiv'\|'abgelehnt'). |

## Stellschrauben (`.env`)

```env
# YouTube-Discovery (Feature-geflaggt, standard=deaktiviert)
YOUTUBE_DISCOVERY_ENABLED=false      # true = aktiv (braucht YOUTUBE_API_KEY)
YOUTUBE_API_KEY=                     # Google API-Key für YouTube Data API (optional)

# Budget & Limits
DISCOVERY_MAX_RUN_BUDGET_EUR=0.25    # Hard cap pro Lauf (Haiku-Kosten)
DISCOVERY_MAX_DAILY_BUDGET_EUR=0.25  # Informativ
DISCOVERY_MAX_CANDIDATES=3           # Videos pro Thema
DISCOVERY_MIN_RELEVANCE=0.6          # Min. Relevance-Score (0..1)

# (Optional) Stufe 2: Gadget-Affiliate
DISCOVERY_GADGET_AFFILIATE_ENABLED=false
```

## Lokal testen

```bash
npm run db:migrate              # zieht 0004 automatisch
npm run discovery:run           # einmaliger Agent-Durchlauf
```

Ohne `YOUTUBE_API_KEY` oder mit `YOUTUBE_DISCOVERY_ENABLED=false`: Agent läuft
durch, erstellt aber keine YouTube-Kandidaten (Stub-Modus). Hilfreich zum Testen
der Admin-Interfaces.

## Nächtlich auf dem VPS

```bash
# Prod-Instanz (Projekt jtc-org). Test-Instanz: ENV setzen.
crontab -e
# 02:30 Uhr nachts:
30 2 * * *  cd /srv/jtc-org/repo && npm run discovery:run >> /var/log/jtc-discovery.log 2>&1
```

Oder via n8n-Webhook (nach Outreach-Freigabe zum Versand).

## Verhältnis zu anderen Modulen

| Modul | Quelle | Trigger | Review | Status-Zyklus |
|---|---|---|---|---|
| **Research-Scout** | Web-Suche (Affiliate, OSS) | Cron | Community | gefunden → publiziert |
| **Discovery-Agent** | YouTube Data API | Cron | **Admin** | pending → approved → published |
| **App-Scout** | Modellwissen (Pipeline-Schritt 2) | sofort | redaktionell | nu → in_pruefung |

Discovery-Agent ergänzt den Research-Scout um ein **Video-Medium** mit
**Admin-Freigabe-Workflow** (kein Auto-Publish).

## Offene Fragen

1. **YouTube API-Key:** Muss ein Mensch später unter
   [Google Cloud Console](https://console.cloud.google.com) beschaffen + in `.env`
   eintragen.
2. **Mail-Integration (n8n):** Versand genehmigter Outreaches via n8n oder
   ähnlich. Voraussetzung für `outreach_queue.status='sent'`.
3. **Affiliate-Admin-Panel:** Noch zu bauen (React-Komponente unter
   `/admin/affiliate` + `/admin/discovery`).
