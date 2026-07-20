# Reel-Ingest — Reisetipps aus Instagram-Reels ins Erlebnis-System

Ziel (User, 2026-07-20): Reels, die der Skipper interessant findet, mit möglichst
wenig Reibung „reinwerfen" → daraus werden (a) POIs für die Routen-App, (b)
Marketing-Vorschläge und (c) Revier-Wiki-Anreicherung. Der Reel-Kanal ist ein
**neuer Stage-1-Ingest** in das bestehende Erlebnis-System (`docs/erlebnis-system.md`),
KEIN neues System. Requirements: **REQ-EXP-010** (Ingest) · **REQ-EXP-011**
(Marketing/Wiki-Output). Guardrails: Skill `erlebnis-wissen` + `discovery.ts`-Muster.

## Leitprinzip (1:1 von discovery.ts übernommen)

> Agent sammelt & entwirft, **Mensch gibt frei.** Kein Auto-Publish. Nur Link/Embed,
> **kein Videofile speichern.**

## Zwei harte Randbedingungen

1. **Kein automatischer Instagram-Zugriff.** Reels sind login-verrammelt (HTTP 403
   ohne Session), und wir raten Inhalte nicht (Quellenpflicht, „erfinde nichts").
   Der Kanal braucht daher einen **Menschen-Einwurf**: Reel-URL **plus** Caption /
   Hashtags / Transkript oder eine kurze Inhaltsbeschreibung. Aus diesem Text
   extrahiert das LLM — nie aus geratenem Videoinhalt.
2. **Recht.** Das heruntergeladene Video wird NICHT weiterverwendet/gespeichert
   (Urheberrecht). Gespeichert wird nur die **extrahierte Faktenlage** + Quelllink
   (offizielles IG-Embed) + Abrufdatum → `revier_poi.quellen_json`. Entspricht der
   Rechts-Leitplanke des Skills `erlebnis-wissen` (aggregiert, keine Zitate/Nicknames).

## Datenfluss

```
Skipper wirft rein:  Reel-URL + Caption/Transkript
        │  (In-App-Seite /tools/reel-ingest, feature-geflaggt)
        ▼
[Extraktion]  src/lib/reel/extract.ts  → callJsonTool (Haiku), geloggt in pipeline_log
        │     Output A: POI-Kandidaten (0..n)
        │     Output B: Marketing-Vorschläge (frei, kein Publish)
        │     Output C: Wiki-Anreicherungs-Snippets (mit Quelle)
        ▼
Inbox:  revier_poi status='entwurf'   ──  Skipper-Freigabe ──▶  status='live'
        ▼
Nutzung:  EXP-004 (POIs entlang Route) · EXP-005 (Buchten-Ranking Abendwind)
          EXP-006 (Schönste-vs-Direkte-Abstecher) · EXP-008 (Revier-Wiki)
```

## Wiederverwendung statt Neubau

| Baustein | Wiederverwendet aus |
|---|---|
| LLM-Aufruf (zentral, geloggt) | `src/lib/anthropic.ts` (`callJsonTool`, `pipeline_log`) |
| Struktur→Inbox→Freigabe-Muster | `src/lib/discovery.ts` (`creator_submissions`-Fluss) |
| Zieltabelle + Lebenszyklus | `revier_poi` (`docs/erlebnis-system.md`, Migration folgt) |
| Kostendeckel je Lauf | `DISCOVERY_MAX_RUN_BUDGET_EUR`-Muster |
| Geo/Revier-Zuordnung | `src/lib/navigation/reviere.ts` (bbox je Revier) |
| Sicherheits-Wording | REQ-SAFE-001/002 (Buchten = keine Ankerfreigabe) |
| Affiliate-Stufenlogik/Kennzeichnung | README + `docs/research-scout.md` (Ranking provisionsfrei) |

## Extraktions-Kontrakt (Entwurf, Tool-Schema)

`extractReel({ url, caption, revierHint? })` → über `callJsonTool` (Haiku):

```jsonc
{
  "pois": [{
    "revier_id": "kroatien-dalmatien",        // zugeordnet, sonst null + Hinweis
    "typ": "bucht|hafen-highlight|sehenswuerdigkeit|event|versorgung",
    "name": "…",
    "geo": { "lat": 0, "lon": 0, "confidence": "hoch|mittel|niedrig" },
    "beschreibung": "kurz, eigene Worte, Du-Form",
    "windschutz_sektoren": "N,NO,O|null",     // INFO, keine Ankerfreigabe
    "saison_von": 5, "saison_bis": 9,
    "gueltig_von": null, "gueltig_bis": null, // nur echte Events
    "confidence": 0.0                          // < Schwelle ⇒ bleibt Entwurf
  }],
  "marketing": {
    "repost_winkel": "…",
    "caption_vorschlag": "…",                 // JTC-Tonalität (Skill jtc-brand-voice)
    "content_luecke": "…",
    "affiliate_anknuepfung": "…"              // Kennzeichnungspflicht, Ranking provisionsfrei
  },
  "wiki": [{ "revier_id": "…", "abschnitt": "…", "satz": "…", "quelle_idx": 0 }],
  "quellen": [{ "url": "https://instagram.com/reel/…", "titel": "…", "abgerufen_am": "YYYY-MM-DD" }]
}
```

Regeln im System-Prompt: nichts erfinden; unsichere Geokodierung als solche
markieren; keine wörtlichen Zitate/Nicknames; Events nur mit Datum; Windschutz
als Info formulieren.

## Guardrails (Definition of Done für die Umsetzung)

- Feature-Flag `NEXT_PUBLIC_FEATURE_REEL_INGEST` (`src/lib/flags.ts`), default aus.
- Nur `status='entwurf'`; Auto-Publish nur, falls je Confidence ≥ Schwelle
  UND erreichbarer Quell-Link (HTTP-Check) — wie erlebnis-wissen; Start: immer Entwurf.
- Harter Kostendeckel + Logging je Lauf (`pipeline_log`).
- Kein Videofile im Repo/DB; nur URL + Abrufdatum.
- Sicherheits-Wording geprüft (REQ-SAFE); Affiliate-Kennzeichnung (README).
- Reine Logik ohne I/O testbar, LLM-Aufruf injizierbar (Sampler-Muster).

## Teststufen (Pflicht bei Umsetzung, ISTQB)

- **Unit** `src/lib/reel/__tests__/extract.test.ts` `[REQ-EXP-010]` — Parsing/Mapping
  auf `revier_poi`-Form mit injiziertem LLM-Stub; Confidence-Schwelle hält Entwurf;
  Quellenpflicht erzwungen (leer ⇒ Ablehnung).
- **Unit** `[REQ-EXP-011]` — Marketing/Wiki-Block ohne DB-Publish; Affiliate-Feld
  trägt Kennzeichnungsmarker.
- **E2E** `e2e/reel-ingest.spec.ts` (gemockt) — Seite hinter Flag, Einfügen →
  Entwurfsliste; ohne Flag nicht erreichbar.

## Bewusst offen (vor Umsetzung entscheiden)

- Confidence-Schwelle + ob je Auto-Publish (Start: nie, immer Entwurf).
- Batch (mehrere Reels/URLs auf einmal) vs. Einzeleingabe.
- Später optional: geteilter Ordner (Dropbox/Drive) + nächtliche Routine statt
  manueller Seite (der Extraktions-Kern bleibt identisch).
- Transkription der Videospur (falls nur Video, keine Caption) — separater,
  rechtlich/technisch eigener Schritt; vorerst Text-Einwurf durch den Skipper.
