-- 0004_weather_feedback.sql — Nutzer-Feedback zum Wetter-Routen-Tool
--
-- Feedback-Schleife wie im jtc.de-Bot-Konzept: Nutzer bewerten nach dem Törn
-- (oder direkt nach der Planung), ob die Vorhersage gestimmt hat, wie zufrieden
-- sie sind, und was fehlt. Speist später die Nachkalibrierung (Regler-Default,
-- Schwellen je Revier) und die Feature-Wünsche.
--
-- kontext_json hält die Planung fest (Wegpunkte, Startzeit, Regler, Quelle),
-- damit ein "Vorhersage war falsch" später gegen die Archiv-Daten geprüft
-- werden kann (Backtest-Anschluss).

CREATE TABLE IF NOT EXISTS weather_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT,                    -- Session-User (wie vote/pledge), nullable: anonym erlaubt
  zufriedenheit SMALLINT CHECK (zufriedenheit BETWEEN 1 AND 5),
  vorhersage_ok BOOLEAN,                 -- true = passte · false = lag daneben · null = keine Angabe
  freitext      TEXT,                    -- Wünsche / was war falsch (max. 2000, App-seitig gekappt)
  kontext_json  JSONB,                   -- {waypoints, startTime, sensitivity, source, eta}
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weather_feedback_created
  ON weather_feedback (created_at DESC);
