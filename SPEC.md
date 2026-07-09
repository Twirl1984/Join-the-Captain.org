# SPEC — Navigations-App `/navigation` (Branch `claude/weather-navigation-app-enazw3`)

Status: in Arbeit · Kontrollstufe: **on the loop** (reversibel per Feature-Flag,
Fehler sichtbar; Sicherheits-Wording ist in-the-loop → Freigabe durch Menschen).
Plan/Markt: [docs/navigation-app-plan.md](docs/navigation-app-plan.md) ·
Backlog: [docs/backlog-navigation.md](docs/backlog-navigation.md)

## Intent

Das /wetter-Tool zur Navigations-App ausbauen: Seekarte mit Tiefen, Routenplanung,
die nicht über Land führt, GPS-Position mit echten Ankunftszeiten, Strömung, Wind
und Wolkenfelder über die Zeit; Reviere gruppiert (Nordsee/Ostsee/Mittelmeer/Binnen);
Weg in die App-Stores (iOS/Android) vorbereitet. `/wetter` bleibt unverändert.
Die App ist eine **Planungshilfe** — niemals als Ersatz amtlicher Seekarten vermarkten.

## Akzeptanzkriterien (prüfbar)

| # | Kriterium | Prüfung |
|---|---|---|
| A1 | Routen zwischen zwei Wasser-Wegpunkten eines maskierten Reviers schneiden nie Land (in Maskenauflösung ~1 km) — auch nach Glättung | Unit: searoute/masks-Tests (`assertAllWater`, Split→Hvar, Sassnitz→Klintholm) |
| A2 | Wegpunkt an Land/abgeschlossenes Gewässer → 422 mit verständlicher Meldung, nie stille Luftlinie durch Land | Unit route-helpers + API-Smoke + E2E |
| A3 | Revier ohne Maske (Binnensee) → Luftlinie, ehrlich gekennzeichnet (UI + API `routing.hinweis`) | Unit + E2E „Luftlinie" |
| A4 | GPS: Position + Genauigkeit sichtbar; verweigerte Berechtigung → klarer Hinweis; Route ab Position rechnet mit Abfahrt=jetzt | E2E GPS-Suite |
| A5 | Tiefen: EMODnet→GEBCO-Fallback; Flachwasser-Bewertung gefahr/knapp/ok/unbekannt gegen Tiefgang; Check läuft nach Routenberechnung automatisch | Unit depth + E2E Tiefen-Test |
| A6 | Wolkenfelder pro Zeitschritt als halbtransparente Flächen (Opazität=Bedeckung), Playback-Slider bewegt die Zeit | E2E Playback-Test |
| A7 | Reviere als Gruppen (min. Nordsee/Ostsee/Mittelmeer/Binnen), Suche über Label/Gruppe/Hafen | Unit reviere + E2E Suche |
| A8 | Alle API-Fehlerpfade differenziert: 400 Validierung · 413 zu groß · 422 fachlich · 502 Upstream; keine Upstream-Details zum Client | API-Smoke + E2E 422/502 |
| A9 | Tiden-Reviere (Nordsee/Wattenmeer) tragen einen prominenten Gezeiten-Warnhinweis (Masken kennen kein Trockenfallen) | Unit reviere + E2E |
| A10 | `/navigation` steht hinter einem Feature-Flag (Kill-Switch per Env, Default an) | Unit flags + E2E |
| A11 | Neue API-Pfade loggen strukturiert (Dauer, Routing-Engine, Fallback-Quote, Fehlerklasse) — ohne PII/Positionsdaten | Code-Review + Log-Smoke |
| A12 | PWA installierbar (Manifest, Icon); Capacitor-Scaffold mit Store-Checkliste dokumentiert | Build + Review mobile/README |

## Nicht-Ziele (dieser Branch)

Offline-Betrieb, Gezeitenströme, Track/MOB/GPX, AIS, native Store-Builds, Abo/Billing
— bewusst Backlog ([docs/backlog-navigation.md](docs/backlog-navigation.md)), dort
mit Prioritäten aus dem Challenge-Review.

## Definition of Done

Gemäß [AGENTIC_WORKFLOW.md-Playbook]: `npm run verify` grün (Lint, Typecheck, Unit),
E2E grün, CI-Gate aktiv, Feature-Flag vorhanden, Observability für neue Pfade,
keine TODO/FIXME ohne Backlog-Eintrag, Diff menschlich gesichtet (PR-Review).
Evals: N/A (kein LLM-Verhalten im Navigationspfad).
