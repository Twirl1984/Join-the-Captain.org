# Anforderungskatalog — JTC Wetter & Navigation

Stand: 2026-07-06 · Schema: `REQ-<BEREICH>-<NNN>` (NAV Navigation · WET Wetter-Kern ·
SAFE Sicherheit/Recht · PROC Prozess) · Vorgehen: [.claude/skills/aspice-istqb-workflow](../.claude/skills/aspice-istqb-workflow/SKILL.md)

**Traceability-Konvention:** Jeder `test()`-/`test.describe()`-Titel, der ein
Requirement verifiziert, trägt den Tag `[REQ-XXX-NNN]`. `npm run trace`
(scripts/trace-check.ts) prüft: jedes Requirement mit Status **umgesetzt** hat
≥ 1 getaggten Test; kein Tag zeigt ins Leere. Ergebnis-Matrix:
[TRACEABILITY.md](TRACEABILITY.md) (generiert — nicht von Hand editieren).

Status: `umgesetzt` (Test-Pflicht) · `in-arbeit` · `geplant` (kein Test nötig).

---

## WET — Wetter-Kern (geteilt von /wetter und /navigation)

- **REQ-WET-001** Routen-Forecast (Status: umgesetzt) — Für ≥2 Wegpunkte werden je Etappe Distanz, Kurs, Wind, Böen, Welle, Fahrt und ETA berechnet (planRoute, injizierter Wetter-Sampler). Quelle: Kernauftrag 2026-06-30.
- **REQ-WET-002** Risiko-Regler (Status: umgesetzt) — Warn-Empfindlichkeit 0..1 verschiebt Sturm-/Gewitter-/Wellen-Schwellen monoton; Default ist der datengestützt-konservative Betriebspunkt. Quelle: User 2026-07-02 (FP/FN).
- **REQ-WET-003** Sicherheits-Floor (Status: umgesetzt) — Böen ≥ 47 kn (9 Bft) warnen unabhängig von der Reglerstellung. Quelle: User 2026-07-02 („Wirbelstürme selten aber heftig").
- **REQ-WET-004** Leg-Verlaufs-Warnung (Status: umgesetzt) — Warnflags werden über Abfahrt/Mitte/Ankunft jedes Legs ODER-verknüpft geprüft (Böe = Maximum); eine Zelle am Leg-Rand darf nicht durchrutschen. Quelle: Testfund 2026-07-02.
- **REQ-WET-005** Abfahrts-Scan (Status: umgesetzt) — Stündliche Kandidaten im Zeitfenster; Slots mit Warnungen werden gemieden (Malus dominiert Komfort), Empfehlung = bester warnungsfreier Slot; all_windy wird ausgewiesen. Quelle: User 2026-07-02 („Sa oder So auslaufen").
- **REQ-WET-006** Boots-Presets & Specs (Status: umgesetzt) — Anklickbare Standardboote (Jolle…45 ft) mit Ableitung Rumpfgeschwindigkeit/Marschfahrt aus Länge/Verdrängung/PS; Felder editierbar. Quelle: User 2026-07-02.
- **REQ-WET-007** Wind-Grenzen des Boots (Status: umgesetzt) — Unterschreitet der Mittelwind das Boots-Minimum (Segeln) oder überschreitet er das Bootslimit, warnt die Etappe; ohne Motor kein Motor-Fallback (Kriechfahrt, kein Crash). Quelle: User 2026-07-02 (Brombachsee-Jollen).
- **REQ-WET-008** Strömung in der Fahrt (Status: umgesetzt) — Fahrt über Grund = Fahrt durchs Wasser + Stromkomponente längs Kurs (SOG ≥ 0,3 kn); Anzeige je Leg. Quelle: User 2026-07-03.
- **REQ-WET-009** Archiv-Modus (Status: umgesetzt) — Startzeiten bis ~5 Jahre zurück nutzen archivierte Vorhersagen (Validierung „hätte das Tool gewarnt?"); Kennzeichnung in Antwort und UI. Quelle: User 2026-07-02.
- **REQ-WET-010** Wetter-Zeitreise (Status: umgesetzt) — Stündliche Zeitreihen (Wind/Böen/Richtung/Wolken/Flags) an Routenpunkten; Karten-Overlay mit Windpfeilen, Gewitter, Bedeckung und interpolierter Bootsposition. Quelle: User 2026-07-02.
- **REQ-WET-011** Modell-Transparenz & -Wahl (Status: umgesetzt) — Wettermodell wählbar (best_match/ICON/ECMWF/GFS) mit sichtbarer Begründung; gemessene Revier-Empfehlung aus dem Feedback-Loop wird angeboten. Quelle: User 2026-07-02/03.
- **REQ-WET-012** Feedback-Loop (Status: umgesetzt) — Feedback speichert die komplette bewertete Abfrage (Route/Zeit/Regler/Modell/Boot/Plan) + strukturierte Abweichungen; Verify-Lauf misst alle Modelle gegen ERA5 und schreibt das Revier-Ranking. Quelle: User 2026-07-02/03.
- **REQ-WET-013** FP/FN-Backtest (Status: umgesetzt) — Warnqualität wird gegen historische Wahrheit (ERA5) je Reglerstufe gemessen (FPR/FNR, windstärke-gewichtete Empfehlung). Quelle: User 2026-07-02 (ISTQB-Auftrag).

## NAV — Navigations-App

- **REQ-NAV-001** Wasserweg-Routing (Status: umgesetzt) — Routen zwischen Wegpunkten führen über Wasser (A* auf Revier-Wassermaske + Sichtlinien-Glättung), nie über Land der Maske. Quelle: navigation-app-plan 2026-07-03.
- **REQ-NAV-002** Server-Snap & Unreachable (Status: umgesetzt) — Wegpunkte ≤ 1,5 km neben dem Wasser werden zur nächsten Wasserzelle gesnappt; getrennte Becken/ferne Landpunkte liefern 422 mit verständlicher Meldung. Quelle: navigation-app-plan.
- **REQ-NAV-003** Tiefen & Flachwasser-Check (Status: umgesetzt) — Tiefe je Routenpunkt aus EMODnet (Fallback GEBCO) mit Status ok/knapp/gefahr gegen den Tiefgang; Check läuft automatisch nach der Berechnung; Planungsdaten-Hinweis. Quelle: navigation-app-plan.
- **REQ-NAV-004** Reviere-Gruppen & Suche (Status: umgesetzt) — Reviere hierarchisch (Nordsee/Ostsee/Mittelmeer/Binnen) mit Such-Feld (Name/Gruppe/Hafen). Quelle: navigation-app-plan.
- **REQ-NAV-005** GPS (Status: umgesetzt) — Eigene Position anzeigen/folgen, Route ab Position mit Live-ETA (Auto-Update), klare Fehlerpfade bei verweigerter Berechtigung. Quelle: navigation-app-plan.
- **REQ-NAV-006** Luftlinien-Ehrlichkeit (Status: umgesetzt) — Segmente außerhalb der Maske/ohne Wasserweg werden sichtbar als Luftlinie gekennzeichnet, nie stillschweigend. Quelle: navigation-test-notes.
- **REQ-NAV-007** Nav-Playback (Status: umgesetzt) — Zeitreise-Overlay (inkl. Wolkenfelder) auf der Navigationskarte. Quelle: User 2026-07-06 Runde 3.
- **REQ-NAV-008** Boots-Presets in Navigation (Status: umgesetzt) — Die Standardboote inkl. „ohne Motor"/Wind-Grenzen sind in /navigation wählbar und fließen in die ETA-Berechnung der Route-API ein; Preset setzt einen Tiefgang-Default. Quelle: User-Review Staging 2026-07-06.
- **REQ-NAV-009** Abfahrts-Scan über Wasserweg (Status: umgesetzt) — Der Abfahrts-Scan (REQ-WET-005) läuft in /navigation über die GERouteten Wasserweg-Punkte (ein Routing, ein Wetter-Fetch); Slot-Klick übernimmt die Startzeit. Quelle: User-Review Staging 2026-07-06.
- **REQ-NAV-010** Sichtbares Land-Snapping (Status: umgesetzt) — Karten-Klick an Land setzt den Marker sichtbar auf die nächste Wasserstelle (≤ 1,5 km, Hinweis); weiter im Land wird der Klick mit Meldung abgelehnt. Häfen-Klicks unverändert; Binnenrevier ohne Maske: unverändert. Quelle: User-Entscheid 2026-07-06.
- **REQ-NAV-011** Kreuz-ETA (Status: umgesetzt) — Liegt der Kurs in der No-Go-Zone (Segel-Modus), werden BEIDE Varianten ausgewiesen: Kreuzen (VMG-basiert) und Motor; ohne Motor ist Kreuzen primär. Folge-ETAs rechnen deterministisch auf der Primär-Variante. Quelle: User-Entscheid 2026-07-06 („beide anzeigen").
- **REQ-NAV-012** Tide im Tiefen-Check (Status: umgesetzt) — Der Flachwasser-Check rechnet den Open-Meteo-Wasserstand (sea_level_height_msl) konservativ ein (Niedrigstwasser über das gesamte Törnfenster — strenger als ±3 h um die Ankunft) und weist das Tide-Delta aus; Kartennull-Unsicherheit bleibt dokumentiert, Marge unangetastet. Quelle: User-Review 2026-07-06.

- **REQ-NAV-013** Wegpunkt-Verschieben (Status: umgesetzt) — Gesetzte Wegpunkte lassen sich per Ziehen (Klicken-und-Halten) auf der Karte verschieben; beim Loslassen greift dieselbe Wasser-Snap-Prüfung wie beim Setzen (snappt ≤ 1,5 km, lehnt tiefe Landpunkte ab und stellt die alte Position wieder her). Quelle: User 2026-07-07.
- **REQ-NAV-014** Offline-Grundfähigkeit & TWA-Basis (Status: umgesetzt) — Ein Service Worker cached App-Shell, statische Assets und die Karten-Kacheln der letzten Nutzung (begrenzt), sodass die zuletzt geladene Ansicht offline aufrufbar bleibt; API-Antworten werden bewusst NICHT gecacht (keine veralteten Wetterdaten als aktuell). Erfüllt zugleich das Install-Kriterium für den Play-Store-Weg (TWA). Quelle: User-Entscheid 2026-07-07; NAV-4 (Offline = K.-o. auf See).

- **REQ-NAV-015** Warn-Empfindlichkeit in Navigation (Status: umgesetzt) — Der Risiko-Regler (REQ-WET-002) ist in /navigation bedienbar und wirkt auf Route, Abfahrts-Scan und Zeitreise. Quelle: User 2026-07-08.
- **REQ-NAV-016** Eine App: Navigation & Wetter (Status: umgesetzt) — /navigation ist die einzige App (inkl. Modell-Wahl mit Revier-Empfehlung, Feedback-Karte, Liegezeiten, Archiv-Badge aus /wetter); /wetter leitet dauerhaft auf /navigation um (bestehende Links bleiben gültig). REVIDIERT den Entscheid „/wetter bleibt" vom 2026-07-06. Quelle: User-Entscheid 2026-07-08.
- **REQ-NAV-017** Liegezeit als Dauer und Uhrzeit (Status: umgesetzt) — An Zwischenstopps kann die Liegezeit als Dauer (Stunden/Minuten) ODER als Weiterfahrt-Uhrzeit eingegeben werden; beide Eingaben sind über die berechnete Ankunft bidirektional gekoppelt. Der Server versteht stay_min (Weiterfahrt = Ankunft + Dauer; ist zusätzlich depart_at gesetzt, gilt der spätere Zeitpunkt). Quelle: User 2026-07-08.

## SAFE — Sicherheit & Recht

- **REQ-SAFE-001** Erstnutzungs-Disclaimer (Status: umgesetzt) — /navigation blockiert bis zur aktiven Bestätigung: Open-Source-Daten, nicht als Navigationsmittel zugelassen, nur unterstützend; amtliche Seekarten/Warnungen/Seemannschaft Pflicht. Quelle: User 2026-07-06.
- **REQ-SAFE-002** Durchgängige Haftungshinweise (Status: umgesetzt) — Der Planungshilfe-Hinweis steht in Seiten-Attribution, Manifest, Impressum und Store-Texten. Quelle: User 2026-07-06.
- **REQ-SAFE-003** Upstream-Härtung (Status: umgesetzt) — Externe Fetches (Open-Meteo/EMODnet/GEBCO) haben harte Timeouts; Upstream-Fehlertexte erreichen nie den Client (nur Server-Log). Quelle: Review 2026-07-03.
- **REQ-SAFE-004** API-Schutz (Status: umgesetzt) — Öffentliche Wetter-/Nav-APIs sind ratenbegrenzt und größenbegrenzt (Body-Limit, Wegpunkt-Limit). Quelle: Public-Launch 2026-07-04.

## PROC — Prozess

- **REQ-PROC-001** Traceability (Status: umgesetzt) — Anforderungen tragen IDs; verifizierende Tests taggen sie im Titel; `npm run trace` bricht bei Lücken und toten Tags; die Matrix wird generiert. Quelle: User 2026-07-06 (ASPICE/ISTQB).
- **REQ-PROC-002** Widerspruchs-Regel (Status: umgesetzt) — Bei widersprüchlichen oder unklaren Anforderungen wird die Arbeit gestoppt und der User konkret gefragt; keine stillen Entscheidungen. Verankert im Skill. Quelle: User 2026-07-06.
- **REQ-PROC-003** Verifikationsschleifen (Status: umgesetzt) — Vor Push/Staging: `npm run verify` (Lint, Typecheck, Unit, Trace) + E2E grün; bei größeren Diffs adversarialer Multi-Agent-Review. Quelle: Projektkonvention seit 2026-07-02.
