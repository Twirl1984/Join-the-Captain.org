-- 0004_discovery_agent.sql — Discovery-Agent + Outreach + Affiliate-Anmeldung
--
-- Ergänzt den Research-Scout um einen nächtlichen YouTube-Discovery-Agent
-- (Feature-geflaggt, YouTube-API-Key optional) und baue die Affiliate-Programme
-- von Auto-Publish auf strukturierte Anmeldungs-Liste um.
--
-- KERN:
-- 1. affiliate_programm: Interne Anmeldungs-Liste (status='gefunden'|'aktiv'|…)
--    Auto-Publish von Links nur wenn status='aktiv'
-- 2. topics + creator_submissions: YouTube-Discovery (öffentliche Videos, kein Download)
-- 3. outreach_queue + video_feedback: Outreach-Drafts + Community-Freigabe-Flow
-- 4. run_budget_log: Kosten-Tracking & Stopping-Grund
-- 5. submission_products (STUFE 2): Gadget-Affiliate (Feature-geflaggt)

-- ── affiliate_programm: Strukturierte Anmeldungs-Liste ──────────────
-- Status-Cycle: gefunden → beworben → aktiv → (optional: abgelehnt)
-- Affiliate-Links nur publiziert, wenn status='aktiv' + affiliate_url gefüllt
CREATE TABLE IF NOT EXISTS affiliate_programm (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id              UUID REFERENCES affiliate_tool(id) ON DELETE CASCADE,
  programm_name        TEXT NOT NULL,
  netzwerk             TEXT,              -- z.B. Awin, Impact, direkt
  signup_url           TEXT NOT NULL,     -- URL zum Anmelden
  bedingungen          TEXT,              -- Mindest-Traffic, Genehmigung, …
  status               TEXT NOT NULL DEFAULT 'gefunden'
                       CHECK (status IN ('gefunden','beworben','aktiv','abgelehnt')),
  affiliate_url        TEXT,              -- echter Link, erst nach Beitritt
  notiz                TEXT,              -- Admin-Notizen (z.B. Status des Antragsbrief)
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotenz: ein Programm pro Tool + URL
  UNIQUE NULLS NOT DISTINCT (tool_id, signup_url)
);

CREATE INDEX IF NOT EXISTS affiliate_programm_tool_idx ON affiliate_programm(tool_id);
CREATE INDEX IF NOT EXISTS affiliate_programm_status_idx ON affiliate_programm(status);
CREATE INDEX IF NOT EXISTS affiliate_programm_aktiv_idx ON affiliate_programm(status, affiliate_url)
  WHERE status = 'aktiv' AND affiliate_url IS NOT NULL;

-- ── topics: Themen-Queue für YouTube-Discovery (Segelthemen) ────────────────
-- Nächtlicher Agent wählt 1–2 Topics mit höchster priority + ältestem last_run_at
CREATE TABLE IF NOT EXISTS topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','paused','done')),
  priority      INTEGER NOT NULL DEFAULT 100,  -- je höher, desto vordringlicher
  last_run_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS topics_status_priority_idx ON topics(status, priority DESC, last_run_at);

-- ── Erweiterung von creator_submissions (0001_init nutzte wahrscheinlich
--    feature_request als Pendant; hier explizit für YouTube-Einträge)
-- (Falls creator_submissions noch nicht existiert — wird nachgelagert integriert)
-- Für jetzt: Videos als "discovered" source_type erfassen
--
-- Annahme: Tabelle existiert noch nicht oder wird lokal angelegt für Discovery.
-- Wir bauen sie sauber vom Grund.
CREATE TABLE IF NOT EXISTS creator_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id         UUID REFERENCES topics(id) ON DELETE CASCADE,
  source_type      TEXT NOT NULL DEFAULT 'discovered'
                   CHECK (source_type IN ('discovered','user_submitted','research_lead')),
  -- Bei YouTube: video_id, title, creator, etc.
  video_title      TEXT,
  creator_handle   TEXT,              -- YouTube-Kanal oder sonstiger Creator
  creator_url      TEXT,              -- Link zum Creator
  video_url        TEXT,              -- YouTube-URL
  video_id         TEXT,              -- YouTube-Video-ID für Embedding
  embed_html       TEXT,              -- oEmbed iframe-HTML (Embed nur, kein Download)
  -- AI-generierte Kurz-Zusammenfassung
  ai_summary       TEXT,
  -- Vorgeschlagene Produkte (später manuell zu affiliate_urls verlinkt)
  suggested_products JSONB,           -- [{name, mention_context}]
  language         TEXT,              -- detected oder 'de', 'en'
  relevance_score  NUMERIC(3,2),      -- Haiku-Scoring (0..1)
  published_at     TIMESTAMPTZ,       -- Video-Veröffentlichungsdatum
  view_count       INTEGER,           -- Approximate view count
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','published','rejected')),
  rejection_reason TEXT,              -- Falls rejected
  approved_by      TEXT,              -- User ID / Admin
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_submissions_topic_idx ON creator_submissions(topic_id);
CREATE INDEX IF NOT EXISTS creator_submissions_status_idx ON creator_submissions(status);
CREATE INDEX IF NOT EXISTS creator_submissions_source_idx ON creator_submissions(source_type);

-- ── outreach_queue: Outreach-Drafts zur Freigabe ─────────────────────
-- Flow: draft (AI-generiert) → approved (Admin ok) → sent (n8n/Mail) → discarded (abgelehnt)
-- Kein Auto-Send: erst Draft schreiben, dann Admin prüft + genehmigt, dann Versand.
CREATE TABLE IF NOT EXISTS outreach_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL REFERENCES creator_submissions(id) ON DELETE CASCADE,
  creator_handle    TEXT NOT NULL,
  platform          TEXT DEFAULT 'email',    -- 'email', 'youtube', 'twitter', …
  draft_subject     TEXT,
  draft_body        TEXT NOT NULL,           -- Volltextdraft (Du-Form, JTC-Voice)
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','sent','discarded')),
  reviewed_by       TEXT,                    -- Admin User ID
  reviewed_at       TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_queue_status_idx ON outreach_queue(status);
CREATE INDEX IF NOT EXISTS outreach_queue_submission_idx ON outreach_queue(submission_id);

-- ── submission_products: Gadget-Affiliate (STUFE 2, Feature-geflaggt) ──────
-- Haiku extrahiert erwähnte Produkte aus Video-Beschreibung/Kommentaren.
-- Admin trägt später Amazon-Affiliate-URL ein + bestätigt Kennzeichnung.
CREATE TABLE IF NOT EXISTS submission_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES creator_submissions(id) ON DELETE CASCADE,
  product_name    TEXT NOT NULL,
  mention_context TEXT,                 -- z.B. "Erwähnt im 2:30 Segment"
  affiliate_url   TEXT,                 -- Amazon-URL mit Affiliate-Tag
  status          TEXT NOT NULL DEFAULT 'proposed'
                  CHECK (status IN ('proposed','published','rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submission_products_submission_idx ON submission_products(submission_id);
CREATE INDEX IF NOT EXISTS submission_products_status_idx ON submission_products(status);

-- ── run_budget_log: Kosten-Tracking & Stop-Grund pro Discovery-Lauf ──────
-- Pro nächtliche Ausführung: Kosten in EUR, Anzahl Suchen/Kandidaten, Stop-Grund
CREATE TABLE IF NOT EXISTS run_budget_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_cost_eur        NUMERIC(6,4),     -- echte Haiku-Kosten (berechnet per Token)
  search_calls       INTEGER,          -- YouTube-API-Calls
  candidates_found   INTEGER,          -- Eingehende Videos
  outreach_drafts    INTEGER,          -- Erzeugte Outreach-Drafts
  stopped_reason     TEXT,             -- 'budget_reached' | 'time_budget' | 'completed'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── video_feedback: Community-Reaktion auf freigegebene Videos ──────────
-- Themen-Vergleich: Daumen hoch + Kommentare/Fragen (bestehendes voting nicht doppeln)
CREATE TABLE IF NOT EXISTS video_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES creator_submissions(id) ON DELETE CASCADE,
  user_id         TEXT,                        -- NULL = anonym
  body            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'question'
                  CHECK (type IN ('question','not_understood','praise','issue')),
  helpful_votes   INTEGER NOT NULL DEFAULT 0, -- Daumen hoch (aggregiert)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_feedback_submission_idx ON video_feedback(submission_id);
CREATE INDEX IF NOT EXISTS video_feedback_user_idx ON video_feedback(user_id);

-- Seed: Standard Segeln-Themen (Pro-Tipp: priorität nach Wichtigkeit setzen)
-- Diese können später aktiviert/deaktiviert werden
INSERT INTO topics (slug, title, priority, status)
VALUES
  ('knotenkunde', 'Knotenkunde & Seilerarbeiten', 100, 'active'),
  ('anlegemanöver', 'Anlegemanöver & Steuermittel', 95, 'active'),
  ('crew-sicherheit', 'Crew-Sicherheit & Mann-über-Bord', 90, 'active'),
  ('segeltrimm', 'Segeltrimm & Performance', 85, 'active'),
  ('wetterkunde', 'Wetterkunde & Vorhersagen', 80, 'active'),
  ('anfaenger', 'Knoten für Anfänger', 75, 'active')
ON CONFLICT (slug) DO NOTHING;
