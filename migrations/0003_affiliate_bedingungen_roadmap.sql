-- 0003_affiliate_bedingungen_roadmap.sql
--
-- Lehre aus der Praxis (Beispiel Navionics → Garmin): Viele Tools haben KEIN
-- eigenes Affiliate-Programm, sind aber über den Mutterkonzern/ein Netzwerk
-- monetarisierbar. Und jedes Programm hat BEDINGUNGEN (Mindest-Traffic,
-- Genehmigung, Provision, Auszahlschwelle), die klar sein müssen — erfüllen wir
-- sie noch nicht, wird daraus eine Dev-Aufgabe (z.B. Besucher zählen).

-- ── affiliate_tool: Programm über Partner + Bedingungen ─────────────
-- Status um 'ueber_partner' erweitern (kein eigenes Programm, aber via
-- Mutterkonzern/Netzwerk monetarisierbar). Der Default-Name des Inline-CHECK
-- aus 0002 ist deterministisch '<tabelle>_<spalte>_check'.
ALTER TABLE affiliate_tool
  DROP CONSTRAINT IF EXISTS affiliate_tool_affiliate_programm_status_check;
ALTER TABLE affiliate_tool
  ADD CONSTRAINT affiliate_tool_affiliate_programm_status_check
  CHECK (affiliate_programm_status IN
    ('hat_programm','kein_programm','ueber_partner','unbekannt'));

ALTER TABLE affiliate_tool
  -- Teilnahmebedingungen: Mindest-Traffic, Genehmigung, Provision, Auszahlung …
  ADD COLUMN IF NOT EXISTS affiliate_bedingungen TEXT,
  -- Erfüllen wir die Bedingungen schon? NULL = noch nicht geprüft/unklar.
  ADD COLUMN IF NOT EXISTS affiliate_voraussetzungen_erfuellt BOOLEAN;

-- ── roadmap_item: Dev-Aufgaben (auto + manuell) ─────────────────────
-- Findet der Scout eine Affiliate-Bedingung, die wir noch nicht erfüllen
-- (z.B. Mindest-Besucherzahl → Traffic-Zählung bauen), entsteht hier ein
-- Eintrag. Die Community-Pipeline (feature_request) bleibt davon getrennt;
-- das hier ist die INTERNE Entwickler-Roadmap.
CREATE TABLE IF NOT EXISTS roadmap_item (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titel         TEXT NOT NULL,
  beschreibung  TEXT,
  quelle        TEXT NOT NULL DEFAULT 'research_scout'
                CHECK (quelle IN ('research_scout','community','manuell')),
  kategorie     TEXT,   -- z.B. 'affiliate_voraussetzung','tracking','feature'
  bezug_tool_id UUID REFERENCES affiliate_tool(id) ON DELETE SET NULL,
  prioritaet    TEXT NOT NULL DEFAULT 'mittel'
                CHECK (prioritaet IN ('niedrig','mittel','hoch')),
  status        TEXT NOT NULL DEFAULT 'offen'
                CHECK (status IN ('offen','in_arbeit','erledigt','verworfen')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotenz: dieselbe Aufgabe nicht doppelt anlegen.
  UNIQUE (titel)
);

CREATE INDEX IF NOT EXISTS roadmap_item_status_idx ON roadmap_item(status);
CREATE INDEX IF NOT EXISTS roadmap_item_kategorie_idx ON roadmap_item(kategorie);
