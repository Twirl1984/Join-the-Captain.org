# Backtest-Ergebnisse — Unwetterwarnungen (FP/FN)

Datensatz: **30912** stündliche Samples (archivierte Open-Meteo-Vorhersage vs. ERA5-Wahrheit), über die Revier-Häfen. Echte Stürme: **402**, echte Gewitter (weather_code): **0**.

**FP** = Fehlalarm (gewarnt, nichts passiert · Kosten: unnötig abgesagter Törn).
**FN** = verpasste Warnung (nicht gewarnt, Unwetter trat ein · teuerste Fehlerart).
Regler 0 = risikofreudig (wenige FP, mehr FN) · 1 = vorsichtig (wenige FN, mehr FP).

## Sturm-Warnung je Regler-Stellung

| Regler | Schwelle Böe | FP-Rate | FN-Rate | Precision | Recall |
|---:|---:|---:|---:|---:|---:|
| 0.0 | 40 kn | 0.0% | 99.0% | 30.8% | 1.0% |
| 0.1 | 39 kn | 0.0% | 98.5% | 35.3% | 1.5% |
| 0.2 | 38 kn | 0.0% | 97.5% | 47.6% | 2.5% |
| 0.3 | 36 kn | 0.1% | 94.5% | 50.0% | 5.5% |
| 0.4 | 35 kn | 0.1% | 87.1% | 58.4% | 12.9% |
| 0.5 | 34 kn | 0.2% | 76.9% | 59.2% | 23.1% |
| 0.6 | 33 kn | 0.3% | 67.2% | 55.9% | 32.8% |
| 0.7 | 32 kn | 0.5% | 59.0% | 50.5% | 41.0% |
| 0.8 | 30 kn | 0.9% | 51.0% | 42.4% | 49.0% |
| 0.9 | 29 kn | 1.3% | 38.3% | 38.1% | 61.7% |
| 1.0 | 28 kn | 1.8% | 28.9% | 34.0% | 71.1% |

## Gewitter-Warnung je Regler-Stellung

| Regler | FP-Rate | FN-Rate | Precision | Recall |
|---:|---:|---:|---:|---:|
| 0.0 | 1.3% | 0.0% | 0.0% | 0.0% |
| 0.1 | 1.8% | 0.0% | 0.0% | 0.0% |
| 0.2 | 2.4% | 0.0% | 0.0% | 0.0% |
| 0.3 | 3.2% | 0.0% | 0.0% | 0.0% |
| 0.4 | 4.4% | 0.0% | 0.0% | 0.0% |
| 0.5 | 5.6% | 0.0% | 0.0% | 0.0% |
| 0.6 | 7.4% | 0.0% | 0.0% | 0.0% |
| 0.7 | 9.2% | 0.0% | 0.0% | 0.0% |
| 0.8 | 12.2% | 0.0% | 0.0% | 0.0% |
| 0.9 | 16.8% | 0.0% | 0.0% | 0.0% |
| 1.0 | 25.8% | 0.0% | 0.0% | 0.0% |

## Empfehlung (Default-Regler)

Für die Sturm-Warnung: **sensitivity ≈ 0.95** (FN-Rate 32.3%, FP-Rate 1.6%). Regel: FNR ≤ 0.05 nirgends erreichbar → gewichtetes Kosten-Minimum (FN×5, FP×1).

> Hinweis: Gewitter-Wahrheit stammt aus ERA5-`weather_code` und unterschätzt Konvektion (bekannte Limitierung). Die Sturm-Zahlen (Böen vs. ERA5-Böen) sind belastbar.

## Erkenntnisse (datengetrieben)

- Bei Default 0.5 (34 kn) werden **76.9%** der echten Stürme verpasst (FN) bei nur 0.2% Fehlalarmen — für ein Sicherheits-Tool zu viele Verpasser.
- Selbst bei maximaler Vorsicht (Regler 1.0) bleibt die FN-Rate bei **28.9%**: die (archivierte) Modell-Böe unterschätzt die real gemessene Böe systematisch.
- Konsequenz: (a) Default-Regler eher vorsichtig setzen; (b) mittelfristig Bias-Korrektur der Vorhersage-Böe bzw. besseres Sturm-Kriterium (Multi-Modell / Böen-Perzentil) — genau der Fall für die jtc.de-Validierungsstudie. Der Backtest macht diese Lücke messbar.
