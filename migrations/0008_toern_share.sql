-- 0008_toern_share.sql — Teilbarer Törn-Link (REQ-EXP-009)
--
-- Kurz-ID statt URL-Param: die geroutete Punktfolge kann lang werden,
-- ein kurzer Code ist teilbar (Crew-Matching-Anreiz, docs/erlebnis-system.md
-- §Abgleich Implementierungsplan). Read-only — kein Editieren über den Link.

CREATE TABLE IF NOT EXISTS geteilter_toern (
  id           TEXT PRIMARY KEY CHECK (LENGTH(id) = 8),  -- genau 8 Zeichen base36 (BUG-050)
  revier_id    TEXT NOT NULL,
  punkte_json  JSONB NOT NULL,            -- [{lat, lon, name}] — geroutete Linie, ausgedünnt
  plan_json    JSONB,                     -- {total_nm, eta, warnings} — Kurzfassung, keine Legs-Details
  highlights_json JSONB,                  -- [{name, lat, lon, typ}] — Erlebnisse entlang der Route
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS geteilter_toern_created_idx ON geteilter_toern(created_at);
