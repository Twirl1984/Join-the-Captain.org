-- 0002_research_scout.sql — Nächtlicher Research-Scout
--
-- Erweitert den App-Scout (Schritt 2 der Pipeline, nur Modellwissen) um eine
-- tiefere, web-gestützte Nacht-Recherche. Drei Aufgaben pro offenem Thema:
--   1. Affiliate-Programm finden  – reales Programm/Netzwerk + Link zu einem Tool.
--   2. Open-Source-Alternativen   – fertige OSS, die ein Problem schon löst.
--   3. Forkbare OSS-Basis         – OSS, die JTC für einen Eigenbau weiterentwickeln
--                                   und konkurrenzfähig machen kann.
--
-- Funde werden auto-publiziert (Brief-Entscheid: kein händisches Review). Die
-- Community ist die Review-Schicht: über community_feedback kann sie melden, was
-- nicht stimmt — bei Schwellwert depubliziert das System und reiht das Thema zur
-- erneuten Nacht-Recherche wieder ein.

-- ── affiliate_tool: Recherche-Felder ────────────────────────────────
ALTER TABLE affiliate_tool
  ADD COLUMN IF NOT EXISTS affiliate_programm_status TEXT
    CHECK (affiliate_programm_status IN ('hat_programm','kein_programm','unbekannt')),
  ADD COLUMN IF NOT EXISTS affiliate_netzwerk TEXT,        -- z.B. Awin, Impact, direkt
  ADD COLUMN IF NOT EXISTS recherche_quellen_json JSONB,   -- belegende URLs
  ADD COLUMN IF NOT EXISTS recherche_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS recherchiert_am TIMESTAMPTZ;    -- NULL = noch offen

-- Offene Affiliate-Themen (noch nie recherchiert) schnell finden.
CREATE INDEX IF NOT EXISTS affiliate_tool_offen_idx
  ON affiliate_tool(recherchiert_am)
  WHERE recherchiert_am IS NULL;

-- ── oss_kandidat: gefundene Open-Source-Software ─────────────────────
-- typ='alternative'  → fertige OSS, löst das Problem direkt (Empfehlung).
-- typ='forkbar'      → Basis für einen JTC-Eigenbau (weiterentwickeln).
CREATE TABLE IF NOT EXISTS oss_kandidat (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id               UUID REFERENCES feature_request(id) ON DELETE CASCADE,
  tool_id                  UUID REFERENCES affiliate_tool(id) ON DELETE SET NULL,
  typ                      TEXT NOT NULL CHECK (typ IN ('alternative','forkbar')),
  name                     TEXT NOT NULL,
  repo_url                 TEXT NOT NULL,
  lizenz                   TEXT,
  sterne                   INTEGER,
  journey_phase            TEXT
                           CHECK (journey_phase IN
                             ('vor_buchung','planung','auf_dem_toern','danach')),
  beschreibung             TEXT,
  -- Nur bei typ='forkbar': wie konkurrenzfähig macht uns das ggü. bestehenden Apps?
  wettbewerbs_einschaetzung TEXT,
  -- Lizenz-Sorgfalt: Ziel sind EIGENE, VERKAUFBARE Apps. Copyleft (AGPL/GPL)
  -- würde Offenlegung des Quellcodes erzwingen → für Closed-Source meiden.
  lizenz_risiko            TEXT CHECK (lizenz_risiko IN ('niedrig','mittel','hoch','unklar')),
  fork_kommerziell_ok      BOOLEAN,   -- darf in einer verkauften Closed-Source-App genutzt werden?
  lizenz_hinweis           TEXT,      -- dokumentierte Begründung der Lizenzfolgen
  quellen_json             JSONB,
  confidence               NUMERIC(3,2),
  veroeffentlicht          BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ein Repo höchstens einmal pro Feature (Idempotenz bei Re-Runs).
  UNIQUE (feature_id, repo_url)
);

CREATE INDEX IF NOT EXISTS oss_kandidat_feature_idx ON oss_kandidat(feature_id);
CREATE INDEX IF NOT EXISTS oss_kandidat_typ_idx ON oss_kandidat(typ);
CREATE INDEX IF NOT EXISTS oss_kandidat_pub_idx ON oss_kandidat(veroeffentlicht);

-- ── research_log: Idempotenz & Retry (analog pipeline_log) ───────────
-- Eigene Tabelle statt pipeline_log zu erweitern: entkoppelt vom Submit-Flow
-- und hält dessen CHECK-Constraint unangetastet.
CREATE TABLE IF NOT EXISTS research_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ziel_typ   TEXT NOT NULL CHECK (ziel_typ IN ('affiliate_tool','feature')),
  ziel_id    UUID NOT NULL,
  schritt    TEXT NOT NULL CHECK (schritt IN ('affiliate_programm','oss')),
  status     TEXT NOT NULL CHECK (status IN ('ok','fehler')),
  ausgabe    JSONB,
  fehler     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ein erfolgreicher Lauf pro (Ziel, Schritt) → erledigte Themen werden nicht
-- erneut recherchiert. Löschen dieser Zeile (durch Community-Feedback) reiht
-- das Thema wieder ein.
CREATE UNIQUE INDEX IF NOT EXISTS research_log_ok_idx
  ON research_log(ziel_typ, ziel_id, schritt)
  WHERE status = 'ok';

-- ── community_feedback: Review durch die Crew ───────────────────────
-- signal='melden'    → "stimmt nicht / toter Link / falsche Empfehlung".
-- signal='hilfreich' → positives Signal (für spätere Sortierung).
CREATE TABLE IF NOT EXISTS community_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ziel_typ   TEXT NOT NULL CHECK (ziel_typ IN ('affiliate_tool','oss_kandidat')),
  ziel_id    UUID NOT NULL,
  user_id    TEXT NOT NULL,
  signal     TEXT NOT NULL CHECK (signal IN ('melden','hilfreich')),
  grund      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ein Signal pro User pro Ziel (kein Mehrfach-Melden).
  UNIQUE (ziel_typ, ziel_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_feedback_ziel_idx
  ON community_feedback(ziel_typ, ziel_id);
