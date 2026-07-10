---
name: erlebnis-wissen
description: Lebendes Wissensmanagement für Revier-Erlebnisse (Buchten, Sehenswürdigkeiten, Events) — Kuration nach Append-and-Review, Quellenpflicht, Verfallsdaten, Community-Bewertung. Nutzen bei allen Arbeiten am Erlebnis-System (REQ-EXP-*).
---

# Erlebnis-Wissen — lebende Kuration

Ziel: Törn-Empfehlungen mit Highlights (windgeschützte Übernachtungs-Buchten,
Sehenswürdigkeiten, saisonale Feste) auf einer Wissensbasis, die **aktuell
bleibt** statt zu verrotten. Designdokument: `docs/erlebnis-system.md`.

## Kurations-Prinzip (Append-and-Review, nach Karpathy)

1. **Append:** Neue Fundstücke landen IMMER zuerst in der Inbox
   (`status='entwurf'`) — nie direkt live. Jedes Fundstück trägt: Quelle(n)
   mit URL + Abrufdatum, `stand_datum` (wie alt ist die Information?),
   `gueltig_bis` (Events!) und eine Confidence.
2. **Review:** Ein wiederkehrender Zyklus (Routine, wie Research-Scout) holt
   die ältesten Live-Einträge hoch und prüft: Quelle noch erreichbar? Aussage
   noch plausibel? Saison vorbei? → aktualisieren, zurückstufen oder
   archivieren. Nichts bleibt ungereviewt älter als 6 Monate.
3. **Community schlägt Kurator:** Nutzer-Votes „stimmt noch / stimmt nicht
   mehr" wiegen stärker als jede Recherche. Ab 2 „stimmt nicht mehr"-Meldungen
   ohne Gegenstimme → Eintrag automatisch auf `prüfen`, aus Empfehlungen raus.

## Guardrails (vom Research-Scout übernommen)

- Auto-Publish nur bei Confidence ≥ Schwelle UND erreichbarem Quell-Link
  (HTTP-Check) — Dubioses bleibt Entwurf.
- **Keine erfundenen Fakten:** Events/Öffnungszeiten/Preise nur mit
  Primärquelle (Veranstalter, Gemeinde, Hafenmeister). Erlebnisberichte
  werden als Meinung gekennzeichnet und verlinkt, nie paraphrasiert-anonym.
- Sicherheits-Wording: Buchten-Empfehlungen sind KEINE Ankerplatz-Freigabe —
  Windschutz-Sektoren als Info, Verweis auf Seemannschaft (REQ-SAFE-Wording).

## Rechts-Leitplanken für Community-/Foren-Quellen (verbindlich)

1. **Lizenz vor Eigenbau:** Erst prüfen, ob eine Partner-/API-Quelle existiert
   (Navily & Co. über die Research-Scout-Stufenlogik) — eine eigene
   Bewertungs-Community ist die größte Hürde und NICHT unser Weg.
2. **Eigene Auswertung nur aggregiert:** Scores aus Anzahl/Stimmung von
   Nennungen — niemals wörtliche Zitate, niemals Nicknames/personenbezogene
   Daten übernehmen (DSGVO), Urheberrecht an Beiträgen respektieren.
3. **ToS der Quellen beachten:** Kein pauschales Scraping fremder Foren;
   Zugriffe dokumentieren (research_log-Muster).

## Anbindung

- Datenmodell + Zyklen: `docs/erlebnis-system.md`; Requirements REQ-EXP-*.
- Der Törn-Vorschlags-Generator nutzt das BESTEHENDE Routing (Wasserweg,
  Wetter, Liegezeiten) und reichert Stopps aus `revier_poi` an — keine
  parallele Routen-Logik bauen.
