-- 0007_erlebnis_poi.sql — POI-Wissensbasis (REQ-EXP-001)
--
-- Datenmodell nach docs/erlebnis-system.md: kuratierte Erlebnisse (Buchten,
-- Sehenswürdigkeiten, Events, Versorgung) je Revier mit Quellenpflicht und
-- Lebenszyklus entwurf → live → prüfen → archiviert (Append-and-Review,
-- .claude/skills/erlebnis-wissen/SKILL.md).
--
-- Abweichung vom Entwurf in erlebnis-system.md: UUID-PKs statt BIGSERIAL,
-- CHECK-Constraints statt freiem TEXT für Enums — folgt dem Muster der
-- bestehenden Migrationen (0004_discovery_agent.sql).

CREATE TABLE IF NOT EXISTS revier_poi (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revier_id             TEXT NOT NULL,             -- wie reviere.ts, z.B. 'ruegen' | 'kroatien-dalmatien'
  typ                   TEXT NOT NULL
                        CHECK (typ IN ('bucht','hafen-highlight','sehenswuerdigkeit','event','versorgung')),
  name                  TEXT NOT NULL,
  lat                   DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon                   DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
  beschreibung          TEXT NOT NULL,
  windschutz_sektoren   TEXT,                       -- z.B. 'N,NO,O' — Info, keine Ankerfreigabe
  saison_von            SMALLINT CHECK (saison_von BETWEEN 1 AND 12),
  saison_bis            SMALLINT CHECK (saison_bis BETWEEN 1 AND 12),
  gueltig_von           DATE,                       -- konkretes Event-Datum (nur wenn verifiziert)
  gueltig_bis           DATE,
  quellen_json          JSONB NOT NULL,             -- [{url, titel, abgerufen_am}] — Pflicht, min. 1 Eintrag
  erlebnis_links_json    JSONB,                      -- verlinkte Berichte/Foren (als Meinung gekennzeichnet)
  confidence            REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  score                 REAL,                        -- Attraktivität (aggregiert, anonymisiert) — NULL bis Community-Daten vorliegen
  score_basis_json       JSONB,                       -- {nennungen, quellen} — nie Zitate/Nicknames
  stand_datum           DATE NOT NULL,               -- Alter der Information
  status                TEXT NOT NULL DEFAULT 'entwurf'
                        CHECK (status IN ('entwurf','live','pruefen','archiviert')),
  reviewed_am           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT revier_poi_quellen_nicht_leer CHECK (jsonb_array_length(quellen_json) > 0)
);

CREATE INDEX IF NOT EXISTS revier_poi_revier_status_idx ON revier_poi(revier_id, status);
CREATE INDEX IF NOT EXISTS revier_poi_status_idx ON revier_poi(status);
-- Bbox-Abfragen (Korridor um die Route, REQ-EXP-004): Start mit einfachem
-- Index auf lat/lon; PostGIS erst, wenn Datenvolumen es erzwingt (Entscheidung
-- docs/erlebnis-system.md).
CREATE INDEX IF NOT EXISTS revier_poi_lat_lon_idx ON revier_poi(lat, lon);
-- Review-Zyklus: älteste zuerst, max. 6 Monate ungereviewt (REQ-EXP-002)
CREATE INDEX IF NOT EXISTS revier_poi_review_faellig_idx ON revier_poi(reviewed_am)
  WHERE status = 'live';

CREATE TABLE IF NOT EXISTS poi_vote (                 -- Community-Loop ("stimmt das noch?", REQ-EXP-003)
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id        UUID NOT NULL REFERENCES revier_poi(id) ON DELETE CASCADE,
  stimmt        BOOLEAN NOT NULL,                    -- true = noch aktuell
  kommentar     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poi_vote_poi_idx ON poi_vote(poi_id);

CREATE OR REPLACE FUNCTION revier_poi_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS revier_poi_updated_at ON revier_poi;
CREATE TRIGGER revier_poi_updated_at
  BEFORE UPDATE ON revier_poi
  FOR EACH ROW
  EXECUTE FUNCTION revier_poi_set_updated_at();
