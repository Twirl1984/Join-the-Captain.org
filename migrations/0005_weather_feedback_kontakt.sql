-- 0005_weather_feedback_kontakt.sql — optionale Kontaktdaten im Wetter-Feedback
--
-- Skipper-Tester dürfen (freiwillig!) Name + E-Mail hinterlassen, damit wir bei
-- Rückfragen zu "Vorhersage lag daneben" nachhaken und Feature-Wünsche
-- beantworten können. Beides nullable — anonymes Feedback bleibt der Default.

ALTER TABLE weather_feedback
  ADD COLUMN IF NOT EXISTS name  TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;
