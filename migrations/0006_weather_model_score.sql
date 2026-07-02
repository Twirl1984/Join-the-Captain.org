-- 0006_weather_model_score.sql — geschlossener Feedback-Loop: Modell-Güte je Revier
--
-- Der Verifikations-Lauf (scripts/weather-feedback-verify.ts) nimmt Feedbacks
-- mit vollständigem Abfrage-Kontext (weather_feedback.kontext_json), holt für
-- den bewerteten Zeitraum die ERA5-"Wahrheit" und die damaligen Vorhersagen
-- ALLER Modelle, und schreibt den Fehler (MAE) hierher. Aus dem Ranking je
-- Revier folgt die Modell-Empfehlung — das Feedback fließt so messbar zurück.

CREATE TABLE IF NOT EXISTS weather_model_score (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revier      TEXT NOT NULL,             -- z.B. 'ostsee', 'brombachsee'
  model       TEXT NOT NULL,             -- 'best_match' | 'icon_seamless' | ...
  var         TEXT NOT NULL,             -- 'wind' | 'gust'
  mae_kn      DOUBLE PRECISION NOT NULL, -- mittlerer Absolutfehler (kn), laufend gemittelt
  n_samples   INTEGER NOT NULL,          -- Stichprobenumfang (Stunden×Punkte)
  n_feedbacks INTEGER NOT NULL DEFAULT 0,-- wie viele Feedback-Fälle eingeflossen sind
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (revier, model, var)
);

-- Merker am Feedback: wann verifiziert (NULL = noch offen/Route liegt in der Zukunft).
ALTER TABLE weather_feedback
  ADD COLUMN IF NOT EXISTS verifiziert_am TIMESTAMPTZ;
