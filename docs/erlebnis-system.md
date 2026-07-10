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
  score         REAL,                     -- Attraktivität (aggregiert, anonymisiert)
  score_basis_json JSONB,                 -- {nennungen, quellen} — nie Zitate/Nicknames
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

## Architektur: LLM-Knowledge-Base nach Karpathy (User-Vorlage IMG_7029)

Das Kurationssystem folgt der 8-Stufen-Pipeline „LLM-Powered Personal Knowledge
Base" (basierend auf Andrej Karpathys Workflow), übersetzt auf JTC:

| Stage | Karpathy | JTC-Umsetzung |
|---|---|---|
| 1 Ingest | Web/Papers/Repos → raw/ | Recherche-Routine sammelt Törnberichte, Hafen-/Gemeinde-Seiten, Event-Kalender je Revier → `revier_poi` (status=entwurf) mit Quellen |
| 2 LLM-Kompilation | LLM liest, fasst, kompiliert | zentraler Anthropic-Client (`src/lib/anthropic.ts`, geloggt) verdichtet Rohfunde zu POI-Einträgen/Wiki-Artikeln |
| 3 Wiki | ~100 Artikel | **Revier-Wiki**: je Revier ein kompilierter Artikel (Buchten, Highlights, Saison) — Quelle der Website-Inhalte |
| 4 Q&A | LLM liest eigenen Index (kein RAG) | Ausbaustufe: „Frag das Revier" — Antworten NUR aus dem kuratierten Wiki, mit Quellenangabe |
| 5 Output | .md/Marp/plots | Website-Seiten (/reviere/…), Törn-Vorschläge, ggf. PDF-Törnplan |
| 6 Linting | Inkonsistenzen, Lücken, Verbindungen | der Review-Zyklus (oben): Widersprüche zwischen Quellen, fehlende Reviere/Saisons, veraltete Einträge |
| 7 Extra Tools | CLI/Suche/Web-UI | scripts/-CLI für Kuratoren + Community-Feedback-Karte |
| 8 Future | Fine-Tuning | offen (erst wenn Wiki-Volumen es rechtfertigt) |

Self-Improving-Loop: Nutzerfragen/Votes (Stage 4/Community) fließen als
Lücken-Signale zurück in Stage 6.

## Monetarisierung (REQ-EXP-007)

- Referral-/Affiliate-Links direkt an den Erlebnissen: Buchten → Buchungs-/
  Buchten-Apps (z. B. Navily, sofern Partner-Programm — Stufenlogik aus
  docs/research-scout.md wiederverwenden: Premium auch ohne Affiliate listen,
  Alternative MIT Programm ergänzen), Häfen → Liegeplatz-Buchung, Events →
  Ticket-Partner, Ausrüstung im Kontext (Landleinen, Ankerzubehör).
- Compliance wie gehabt (README): Affiliate-Kennzeichnung Pflicht; Empfehlung
  bleibt redaktionell — Ranking NIEMALS von Provision beeinflusst (Vertrauen
  ist das Produkt).

## Requirements (geplant — IDs reserviert)

- **REQ-EXP-001** POI-Wissensbasis mit Quellenpflicht und Lebenszyklus
- **REQ-EXP-002** Kurations-Routine (append-and-review, 6-Monats-Deckel)
- **REQ-EXP-003** Community-Bewertung „stimmt noch?" mit Auto-Zurückstufung
- **REQ-EXP-004** Erlebnisse entlang der Route (Korridor-Filter, Saison)
- **REQ-EXP-005** Buchten-Ranking nach vorhergesagter Windrichtung
- **REQ-EXP-006** Törn-Vorschläge mit Highlights (Route + Erlebnisse + Feste)
- **REQ-EXP-007** Referral-Monetarisierung mit Kennzeichnung (Ranking provisionsfrei)
- **REQ-EXP-008** Revier-Wiki: LLM-kompilierte Artikel + Linting-Zyklus (Karpathy Stage 3+6)

## Abgleich mit dem Implementierungsplan „Segel-Crew-Matching App“ (PDF, 2026-07)

Vorstudie in public/features/Routenplanung_Segel_Crew_Matching_App_Implementierungsplan.pdf —
kritisch geprüft am 2026-07-10. Ergebnis in drei Körben:

**Vom Plan bestätigt (bereits gebaut und live):** Raster + A* über
Küstenpolygone (Bausteine 1+2 des Plans = unsere Wassermasken + searoute inkl.
Sichtlinien-Glättung und Sicherheits-Snap), EMODnet/GEBCO-Tiefen mit
Tiefgang-Filter, UI-Disclaimer (REQ-SAFE-001/002). Die vom Plan als „späte
Ausbaustufe, hoch“ eingestufte Segel-Physik (Wind/Polare/Kreuzen) ist bei uns
ebenfalls schon umgesetzt (REQ-NAV-011, REQ-NAV-019) — der Plan ist an diesen
Stellen von unserem Stand überholt.

**Vom Plan übernommen (Anpassungen an unserem Design):**
- **Crew-Matching als Zweck-Ebene:** Route + Highlights sind ein ANREIZ für
  Crew-Bewerbungen („Wir ankern in dieser wunderschönen Bucht!“) → neues
  REQ-EXP-009: teilbarer, read-only Törn-Link (Vogelperspektive + Highlights)
  als Brücke zur .de-Crew-Plattform.
- **„Schönste Route“ korrekt konstruiert:** POIs/Ankerbuchten werden NICHT als
  A*-Kostenbonus eingebaut (negative Kosten brechen die Heuristik-Zulässigkeit),
  sondern als optionale Zwischen-Wegpunkte: Liegt ein hoch bewerteter POI nah
  an der Ideallinie, wird eine ALTERNATIV-Route mit Abstecher angeboten —
  „Schönste vs. Direkte“, die Wahl bleibt beim Skipper (präzisiert REQ-EXP-006).
- **Attraktivitäts-Score:** revier_poi bekommt score REAL + score_basis_json
  (aggregierte, anonymisierte Nennungen — nie wörtliche Zitate mit Nicknames).
- **Konkrete Ingest-Kanäle (Stage 1):** Overpass-API (Leuchttürme, Denkmäler,
  Strände entlang der Küste), OpenSeaMap-Wikipedia-Georeferenzen; Filter
  „von See aus erlebbar“ über Abstand-zur-Küste-Schwelle (Sichtachsen später).
- **Rechts-Leitplanken Foren-Auswertung (DSGVO/ToS/Urheberrecht):** Reihenfolge
  verbindlich — (A) lizenzierte Quelle/Partner-API zuerst prüfen (Navily über
  die Research-Scout-Stufenlogik), (B) eigene Auswertung nur aggregiert +
  anonymisiert, keine Beitrags-Zitate, ToS der Foren respektieren. Details im
  Skill erlebnis-wissen.

**Vom Plan abgewichen (bewusst, mit Begründung):**
- Tech-Stack-Vorschlag (FastAPI + PostGIS + pgRouting/NetworkX) — abgelehnt:
  Routing existiert als getestete TypeScript-Lösung im Next.js-Monolith
  (offline-testbar, ohne zweiten Sprach-Stack). POI-Korridor-Abfragen starten
  mit Postgres + Haversine; PostGIS erst, wenn Datenvolumen es erzwingt.
- Build-vs-Buy (Phase 0 des Plans): Für das ROUTING ist die Entscheidung
  gefallen und geliefert (eigener Feedback-Loop, keine Lizenzkosten, volle
  Integration). Für ANKER-BEWERTUNGEN gilt Weg A zuerst (Partner/Lizenz statt
  eigener Bewertungs-Community — deren Aufbau ist die größte Hürde; unser
  poi_vote bleibt bewusst nur „stimmt noch?“-Kuration).
- Kleine Zusatz-Idee aus dem savvy-navvy-Vergleich: GPX-Export der gerouteten
  Strecke (REQ-NAV-021, geplant) — Skipper nehmen die Route in Plotter/Apps mit.

## Bewusst offen (Entscheidungen vor Umsetzung)

- Erfassungs-UI vs. reine Routine-Befüllung (Start: Routine + Feedback-Karte)
- Moderations-Schwellen (2 Meldungen? gewichtete Votes?)
- Quellen für Events je Revier (Gemeinde-Kalender, Häfen, Törnberichte) —
  je Revier in der ersten Recherche-Runde ermitteln und im Log festhalten
