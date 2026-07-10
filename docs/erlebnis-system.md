# Erlebnis-System — Törn-Empfehlungen mit lebender Wissensbasis

Idee (User + Kollege, 2026-07-10): Wer eine Route plant, bekommt **Erlebnisse
entlang des Weges** empfohlen — windgeschützte UND schöne Übernachtungs-Buchten,
Versorgung (Restaurant/Sanitär), Sehenswürdigkeiten und **saisonale Feste** im
Törn-Zeitraum. Grundlage ist eine kuratierte, lebende Wissensbasis (Skill:
`.claude/skills/erlebnis-wissen/SKILL.md`), kein statischer Reiseführer.

Baut auf Vorhandenem auf:
- **Routing/Wetter/Liegezeiten** (`/navigation`, REQ-NAV-*) — der Vorschlags-
  Generator reichert bestehende Routen an, keine zweite Routen-Logik.
- **Research-Scout-Muster** (`docs/research-scout.md`): nächtliche Recherche,
  Auto-Publish mit Confidence + HTTP-Quellen-Check, `community_feedback`,
  `research_log`. Das Erlebnis-System übernimmt diese Guardrails 1:1.

## Datenmodell (Entwurf, Migration folgt bei Umsetzung)

```sql
CREATE TABLE revier_poi (
  id            BIGSERIAL PRIMARY KEY,
  revier_id     TEXT NOT NULL,            -- wie reviere.ts
  typ           TEXT NOT NULL,            -- 'bucht' | 'hafen-highlight' | 'sehenswuerdigkeit' | 'event' | 'versorgung'
  name          TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL, lon DOUBLE PRECISION NOT NULL,
  beschreibung  TEXT NOT NULL,            -- kurz, eigene Worte
  windschutz_sektoren TEXT,               -- z. B. 'N,NO,O' — Info, keine Ankerfreigabe
  saison_von SMALLINT, saison_bis SMALLINT, -- Monat 1-12 (Events/Bademonate)
  gueltig_von DATE, gueltig_bis DATE,     -- konkrete Events (Fest am 14.-16.08.)
  quellen_json  JSONB NOT NULL,           -- [{url, titel, abgerufen_am}] Pflicht!
  erlebnis_links_json JSONB,              -- verlinkte Berichte/Foren (als Meinung)
  confidence    REAL NOT NULL,
  stand_datum   DATE NOT NULL,            -- Alter der Information
  status        TEXT NOT NULL DEFAULT 'entwurf', -- entwurf|live|pruefen|archiviert
  reviewed_am   TIMESTAMPTZ,              -- letzter Kurations-Review
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE poi_vote (                    -- Community-Loop ("stimmt das noch?")
  id BIGSERIAL PRIMARY KEY,
  poi_id BIGINT NOT NULL REFERENCES revier_poi(id),
  stimmt BOOLEAN NOT NULL,                -- true = noch aktuell
  kommentar TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Lebenszyklus

```
Recherche (Routine) ──append──▶ entwurf ──Guardrails ok──▶ live
   ▲                                                        │
   │              Review-Zyklus (ältester zuerst,           │
   └───update─────max. 6 Monate ungereviewt) ◀──────────────┤
                                                            │
Community: ≥2× "stimmt nicht mehr" ohne Gegenstimme ──▶ pruefen ──▶ archiviert
Events: gueltig_bis überschritten ──────────────────────────────▶ archiviert
```

## Törn-Vorschläge (Ausbaustufe 2)

Für Route + Zeitraum: POIs im Korridor (± X sm um den Wasserweg, per
bestehender Distanzrechnung) filtern nach Saison/Gültigkeit/status='live',
je Übernachtungs-Stopp die Bucht-Empfehlung nach Windrichtung des Abends
(vorhandene Wetterdaten!) ranken — „Bucht Y ist bei dem vorhergesagten
NW-Wind geschützt, 0,4 sm Umweg, Fest in Z am Samstag."

## Requirements (geplant — IDs reserviert)

- **REQ-EXP-001** POI-Wissensbasis mit Quellenpflicht und Lebenszyklus
- **REQ-EXP-002** Kurations-Routine (append-and-review, 6-Monats-Deckel)
- **REQ-EXP-003** Community-Bewertung „stimmt noch?" mit Auto-Zurückstufung
- **REQ-EXP-004** Erlebnisse entlang der Route (Korridor-Filter, Saison)
- **REQ-EXP-005** Buchten-Ranking nach vorhergesagter Windrichtung
- **REQ-EXP-006** Törn-Vorschläge mit Highlights (Route + Erlebnisse + Feste)

## Bewusst offen (Entscheidungen vor Umsetzung)

- Erfassungs-UI vs. reine Routine-Befüllung (Start: Routine + Feedback-Karte)
- Moderations-Schwellen (2 Meldungen? gewichtete Votes?)
- Quellen für Events je Revier (Gemeinde-Kalender, Häfen, Törnberichte) —
  je Revier in der ersten Recherche-Runde ermitteln und im Log festhalten
