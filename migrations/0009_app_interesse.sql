-- Interessenten-Vormerkung für den App-Start (REQ-EXP-012).
--
-- NICHT EINSPIELEN, solange die Datenschutzerklärung diese Verarbeitung nicht
-- abdeckt. Das Feature ist zusätzlich hinter einem Flag, das standardmäßig AUS
-- ist (NEXT_PUBLIC_FEATURE_APP_INTERESSE, siehe src/lib/flags.ts).
--
-- Datensparsamkeit ist hier Absicht, nicht Bequemlichkeit:
--   * KEIN Name — für eine Startbenachrichtigung nicht nötig.
--   * KEINE IP-Adresse — wäre ein weiteres personenbezogenes Datum ohne Zweck.
--   * KEIN Tracking, keine Herkunftsanalyse über die grobe Quelle hinaus.
--   * `eingewilligt_am` hält fest, WANN zugestimmt wurde — bei einer Rückfrage
--     der Aufsichtsbehörde ist das der Nachweis.
--   * `abgemeldet_am` statt Löschen: Wer sich abmeldet, soll nicht durch eine
--     spätere Neuanmeldung versehentlich wieder Post bekommen. Die Adresse wird
--     beim Abmelden durch ihren Hash ersetzt (siehe Anwendungscode), sodass
--     kein Klartext übrig bleibt.

CREATE TABLE IF NOT EXISTS app_interesse (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  sprache         TEXT NOT NULL DEFAULT 'de',    -- 'de' | 'en', für die Ansprache
  quelle          TEXT,                          -- grob, z. B. 'preise' | 'toern-share'
  eingewilligt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  abgemeldet_am   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dieselbe Adresse nur einmal aktiv in der Liste.
CREATE UNIQUE INDEX IF NOT EXISTS app_interesse_email_idx
  ON app_interesse(email)
  WHERE abgemeldet_am IS NULL;
