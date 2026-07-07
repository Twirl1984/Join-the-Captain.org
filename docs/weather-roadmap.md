# Roadmap — Wetter-Tool zum Sicherheits-Assistenten

Stand: 2026-07-02 · Bezug: [weather-route-tool.md](weather-route-tool.md), [weather-test-plan.md](weather-test-plan.md)

Das MVP (Routen-Forecast + Unwetterwarnungen mit Risiko-Regler) ist der Kern.
Diese Punkte bauen es zum **Sicherheits-Assistenten** aus. Reihenfolge nach
Nutzen/Sicherheit; jeder Punkt nennt Datenquelle & Ansatz. Nichts davon ist MVP.

## Stufe 1 — Warnqualität schärfen (direkt am Sicherheits-Kern)
- **Räumlicher/zeitlicher Puffer gegen Beinahe-Treffer:** nicht nur den Leg-Punkt
  sampeln, sondern ein kleines Umfeld (± wenige km / ± 1–3 h) und das Maximum
  werten — eine Zelle kann knapp daneben oder genau auf die Bucht ziehen.
- **Ensemble-Unsicherheit:** Open-Meteo bietet Ensemble-Modelle; Spread → Konfidenz
  der Warnung, statt Einzellauf. Speist die Regler-Kalibrierung.
- **Bessere Gewitter-Wahrheit:** DWD-Warnarchiv / Blitzdaten statt ERA5-`weather_code`
  (unterschätzt Konvektion) → belastbare Gewitter-FP/FN.
- **Böen-Bias-Korrektur:** Backtest zeigt, dass die Modell-Böe echte Böen unterschätzt
  (bei 0.5 ~77 % FN). Perzentil-/Multi-Modell-Korrektur senkt FN ohne FP-Explosion.

## Stufe 2 — Ankerplatz-Empfehlungen
- **Idee:** je Bucht/Ankerplatz die Schutzwirkung gegen die erwartete Windrichtung/
  -stärke bewerten und in Reglerrichtung empfehlen („bei NW 7 Bft: Bucht X geschützt,
  Bucht Y offen — meiden").
- **Daten:** Ankerplatz-Datensatz (OpenSeaMap/Navily-artig: Lage, Grund, Schutz-
  sektoren, Haltegrund). Windrichtung/-stärke kommt bereits aus dem Forecast.
- **Logik:** Schutz = Landabdeckung im Luv-Sektor; Haltegrund × Windstärke → Halt-Risiko.

## Stufe 3 — Strömung & Motorleistung (PS) abgleichen
- **Idee:** Kann das Boot gegen Wind **und Strömung** noch Fahrt machen / den Anker
  halten? Abgleich mit Bootsparametern.
- **Daten:** Open-Meteo Marine liefert `ocean_current_velocity`/`ocean_current_direction`;
  Bootsprofil um **Motor-PS/Schub**, Verdrängung, Lateralfläche, Windangriffsfläche erweitern.
- **Logik:** Wind- + Strömungsvektor vs. erreichbarer Schub → „Motor reicht / grenzwertig /
  nicht ausreichend"; fließt in Warnungen & Ankerplatz-Rat ein.

## Stufe 4 — Ankertaktik & Notfall-Verhalten
- **Landleinen ja/nein:** Empfehlung aus Windstärke/-richtung, Schwell, Buchtenge,
  Platz zum Schwojen (enge Bucht + auflandiger Wind → Landleinen/zweiter Anker).
- **Notfall-Leitfaden je Warnlage:** kurze, handlungsorientierte Hinweise (Gewitteranmarsch:
  Elektronik sichern, Crew unter Deck, Motor klar, Ankerwache; schwerer Sturm: Hafen/
  geschützte Bucht ansteuern, rechtzeitig ablaufen). Kuratierte, seemännisch geprüfte Inhalte —
  **keine** KI-Improvisation bei Sicherheitsinhalten.
- **Ton/Recht:** klare Kennzeichnung als Entscheidungshilfe, nicht als Ersatz für
  Seemannschaft/amtliche Warnungen (Haftungshinweis).

## Stufe 5 — Feedback-Schleife
- Nutzer bewertet, ob die Warnung/ETA gestimmt hat (wie im jtc.de-Bot-Konzept) →
  laufende Nachkalibrierung von Reglern & Schwellen pro Revier.

---

**Testbezug:** Jede Stufe erweitert den Backtest um ihre Wahrheitsquelle und misst FP/FN
bzw. die Trefferqualität (Ankerplatz-Rat, PS-Abgleich) gegen dokumentierte Fälle, bevor sie
live geht — siehe [weather-test-plan.md](weather-test-plan.md).
