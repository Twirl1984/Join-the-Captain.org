-- 0001_init.sql — Grundschema für join-the-captain.org
-- Vier Bereiche teilen sich Daten: Feature-Loop, Tools, Podcast, Partner.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Runde ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runde (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monat           TEXT NOT NULL,                       -- z.B. "2026-06"
  status          TEXT NOT NULL DEFAULT 'offen'
                  CHECK (status IN ('offen','voting','abgeschlossen')),
  voting_endet_am TIMESTAMPTZ
);

-- Höchstens eine offene Runde gleichzeitig.
CREATE UNIQUE INDEX IF NOT EXISTS runde_eine_offene
  ON runde ((status))
  WHERE status = 'offen';

-- ── Feature-Request ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_request (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id           TEXT NOT NULL,
  autor_name         TEXT NOT NULL DEFAULT 'Crew-Mitglied',
  titel              TEXT NOT NULL,
  journey_phase      TEXT
                     CHECK (journey_phase IN
                       ('vor_buchung','planung','auf_dem_toern','danach')),
  problem            TEXT,
  nutzen             TEXT,
  status             TEXT NOT NULL DEFAULT 'neu'
                     CHECK (status IN
                       ('neu','in_pruefung','voting','build',
                        'affiliate','verworfen','umgesetzt')),
  size               TEXT CHECK (size IN ('S','M','L','XL')),
  dev_tage_min       INTEGER,
  dev_tage_max       INTEGER,
  eur_min            INTEGER,
  eur_max            INTEGER,
  sizing_begruendung TEXT,
  runde_id           UUID REFERENCES runde(id) ON DELETE SET NULL,
  -- Rohtext der Einreichung, damit die Pipeline retrybar bleibt.
  roh_text           TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_request_runde_idx ON feature_request(runde_id);
CREATE INDEX IF NOT EXISTS feature_request_status_idx ON feature_request(status);

-- ── Vote (1 pro User pro Feature) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS vote (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES feature_request(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feature_id, user_id)
);

-- ── Pledge (freiwillige Unterstützung, kein Lieferversprechen) ──────
CREATE TABLE IF NOT EXISTS pledge (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id               UUID NOT NULL REFERENCES feature_request(id) ON DELETE CASCADE,
  user_id                  TEXT NOT NULL,
  betrag_cent              INTEGER NOT NULL CHECK (betrag_cent > 0),
  status                   TEXT NOT NULL DEFAULT 'offen'
                           CHECK (status IN ('offen','bezahlt','erstattet')),
  stripe_payment_intent_id TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pledge_feature_idx ON pledge(feature_id);
CREATE UNIQUE INDEX IF NOT EXISTS pledge_pi_idx
  ON pledge(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ── Affiliate-Tool (geteilt mit Tool-Verzeichnis) ──────────────────
CREATE TABLE IF NOT EXISTS affiliate_tool (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id       UUID REFERENCES feature_request(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  kategorie        TEXT,
  journey_phase    TEXT
                   CHECK (journey_phase IN
                     ('vor_buchung','planung','auf_dem_toern','danach')),
  kurzbeschreibung TEXT,
  beschreibung_md  TEXT,
  affiliate_url    TEXT NOT NULL,
  rating           NUMERIC(2,1),
  icon_key         TEXT,
  pro_contra_json  JSONB,
  veroeffentlicht  BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_tool_phase_idx ON affiliate_tool(journey_phase);
CREATE INDEX IF NOT EXISTS affiliate_tool_pub_idx ON affiliate_tool(veroeffentlicht);

-- ── Tool-Klick-Tracking ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tool_click (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id    UUID NOT NULL REFERENCES affiliate_tool(id) ON DELETE CASCADE,
  referrer   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tool_click_tool_idx ON tool_click(tool_id);

-- ── Podcast-Folge ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS podcast_episode (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titel             TEXT NOT NULL,
  folge_nr          INTEGER NOT NULL,
  beschreibung      TEXT,
  audio_url         TEXT NOT NULL,
  dauer_sek         INTEGER,
  veroeffentlicht_am TIMESTAMPTZ,
  slug              TEXT NOT NULL UNIQUE
);

-- ── Partner / Segler-Entrepreneurs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS partner (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  rolle            TEXT,
  kurzbeschreibung TEXT,
  url              TEXT,
  logo_key         TEXT,
  sortierung       INTEGER NOT NULL DEFAULT 0
);

-- ── Moderations-Log (Crewguard) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS mod_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID REFERENCES feature_request(id) ON DELETE SET NULL,
  verdict    TEXT NOT NULL CHECK (verdict IN ('ok','flag','block')),
  text_probe TEXT,
  grund      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Pipeline-Log (Idempotenz & Retry) ──────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES feature_request(id) ON DELETE CASCADE,
  schritt    TEXT NOT NULL CHECK (schritt IN ('strukturierer','app_scout','sizer')),
  status     TEXT NOT NULL CHECK (status IN ('ok','fehler')),
  ausgabe    JSONB,
  fehler     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ein erfolgreicher Lauf pro (Feature, Schritt) → Idempotenz.
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_log_ok_idx
  ON pipeline_log(feature_id, schritt)
  WHERE status = 'ok';
