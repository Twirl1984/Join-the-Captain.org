-- REQ-EXP-001: POI-Wissensbasis (Buchten, Sehenswürdigkeiten, Events, Versorgung
-- je Revier) mit Quellenpflicht und Lebenszyklus entwurf→live→prüfen→archiviert.
-- Schema wie in docs/erlebnis-system.md entworfen.

CREATE TABLE revier_poi (
  id                  BIGSERIAL PRIMARY KEY,
  revier_id           TEXT NOT NULL,            -- wie src/lib/navigation/reviere.ts
  typ                 TEXT NOT NULL CHECK (typ IN ('bucht', 'hafen-highlight', 'sehenswuerdigkeit', 'event', 'versorgung')),
  name                TEXT NOT NULL,
  lat                 DOUBLE PRECISION NOT NULL,
  lon                 DOUBLE PRECISION NOT NULL,
  beschreibung        TEXT NOT NULL,
  windschutz_sektoren TEXT,                     -- z. B. 'N,NO,O' — Info, keine Ankerfreigabe
  saison_von          SMALLINT CHECK (saison_von BETWEEN 1 AND 12),
  saison_bis          SMALLINT CHECK (saison_bis BETWEEN 1 AND 12),
  gueltig_von         DATE,
  gueltig_bis         DATE,
  quellen_json        JSONB NOT NULL,           -- [{url, titel, abgerufen_am}] Pflicht!
  erlebnis_links_json JSONB,
  confidence          REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  score               REAL,
  score_basis_json    JSONB,
  stand_datum         DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'live', 'pruefen', 'archiviert')),
  reviewed_am         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_revier_poi_revier_status ON revier_poi (revier_id, status);
CREATE INDEX idx_revier_poi_lat_lon ON revier_poi (lat, lon) WHERE status = 'live';
CREATE INDEX idx_revier_poi_reviewed_am ON revier_poi (reviewed_am) WHERE status = 'live';

CREATE TABLE poi_vote (
  id          BIGSERIAL PRIMARY KEY,
  poi_id      BIGINT NOT NULL REFERENCES revier_poi(id) ON DELETE CASCADE,
  stimmt      BOOLEAN NOT NULL,
  kommentar   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_poi_vote_poi_id ON poi_vote (poi_id);
