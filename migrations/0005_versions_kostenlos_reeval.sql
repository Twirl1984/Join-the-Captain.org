-- 0005_versions_kostenlos_reeval.sql
--
-- Teil B: Kostenlose (nicht-OSS) Alternativen neben Open-Source
-- Teil D: Versions-/Changelog-Tracking + jährliche Neubewertung
--
-- Additiv, idempotent. Erweitert oss_kandidat.typ um 'kostenlos_alternative'
-- und affiliate_tool um Versions-Felder. Keine Deletions.

-- ── oss_kandidat: Kostenlose (nicht-OSS) Alternativen erfassen ──────────
-- typ erweitern: 'alternative' (OSS) | 'forkbar' (OSS zum Forken)
--              | 'kostenlos_alternative' (kostenlos, aber nicht zwingend OSS)
--
-- Existierende Constraint löschen (saubere Erneuerung).
ALTER TABLE oss_kandidat
  DROP CONSTRAINT IF EXISTS oss_kandidat_typ_check;

-- Neue CHECK mit erweitertem typ
ALTER TABLE oss_kandidat
  ADD CONSTRAINT oss_kandidat_typ_check
  CHECK (typ IN ('alternative','forkbar','kostenlos_alternative'));

-- Optional: Feld 'kostenlos' zur expliziten Kennzeichnung
-- (für Reporting/Filter, auch wenn typ='kostenlos_alternative' schon signalisiert)
ALTER TABLE oss_kandidat
  ADD COLUMN IF NOT EXISTS kostenlos BOOLEAN DEFAULT false;

-- ── affiliate_tool: Versions- und Changelog-Tracking ──────────────────
-- Getestete vs. aktuelle Version + Changelog-Hinweise (für Aktualitäts-Checks)
ALTER TABLE affiliate_tool
  ADD COLUMN IF NOT EXISTS getestete_version TEXT,
  ADD COLUMN IF NOT EXISTS aktuelle_version TEXT,
  ADD COLUMN IF NOT EXISTS changelog_hinweis TEXT,
  ADD COLUMN IF NOT EXISTS version_geprueft_am TIMESTAMPTZ;

-- Index für jährliche Neubewertung (beide Tabellen)
CREATE INDEX IF NOT EXISTS affiliate_tool_reeval_idx
  ON affiliate_tool(recherchiert_am)
  WHERE recherchiert_am IS NOT NULL;

-- ── Index für Feature-Request Neubewertung (noch zu definieren in research-Log)
-- research_log braucht ähnlichen Index (wird implizit über status + ziel_typ genutzt)
CREATE INDEX IF NOT EXISTS research_log_reeval_idx
  ON research_log(status, ziel_typ, created_at)
  WHERE status = 'ok';
