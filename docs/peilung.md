# Handy-Peilung & Kreuzpeilung (REQ-NAV-025/026) — Design-Skizze

Idee (User, 2026-07-10): Mit dem Handy ein markantes Objekt anvisieren
(Leuchtturm, Kap, Kirchturm), die Kompass-Richtung übernehmen und auf der
Karte als PEILLINIE eintragen — klassische terrestrische Navigation als
Backup, wenn GPS unplausibel ist (real erlebt: GPS-Daten stimmen teils nicht).

## Ablauf

1. **Peilen:** „Jetzt & hier“-Ansicht → „Peilung“ → Handy waagerecht auf das
   Objekt richten → Knopf drücken → Kompass-Heading wird eingefroren
   (iOS: DeviceOrientationEvent.requestPermission() + webkitCompassHeading;
   Android: absolute orientation alpha).
2. **Objekt zuordnen:** ENTWEDER einen kartierten Hafen aus der Liste wählen ODER — neu — „📍 Karte“ drücken und das gepeilte Objekt FREI auf der Karte antippen (auch an Land, z. B. ein Kirchturm zu Hause). Alternativ auf der Karte das gepeilte Objekt antippen —
   OpenSeaMap-Seezeichen/Leuchttürme sind ideale Kandidaten (bereits als
   Kartenlayer vorhanden; später POIs aus REQ-EXP-001).
3. **Peillinie:** Vom Objekt wird die Gegenrichtung (Peilung ± 180°) als Linie
   gezeichnet. **Zwei Peilungen → Schnittpunkt = Standort**; drei → Fehler-
   dreieck als ehrliche Unsicherheitsanzeige.
4. **GPS-Plausibilisierung (REQ-NAV-026):** Liegt der GPS-Fix deutlich neben
   dem Peilungs-Fix (> Unsicherheitsradius), zeigt die App eine Warnung
   („GPS weicht von der Peilung ab — Position prüfen“). Zusätzlich passive
   Signale: GPS-Sprünge (unrealistische SOG), accuracy_m-Ausreißer.

## Ehrliche Grenzen (ins UI!)

- Handy-Kompass: typ. ±5–10° (Magnetfeld an Bord! Motor/Elektronik stören)
  → Fehlerband an der Peillinie visualisieren, Kalibrier-Hinweis (8er-Bewegung).
- **Missweisung:** Kompass liefert MAGNETISCH — Deklination je Revier
  korrigieren (kleines Modell/Tabelle je Revier-bbox, Quelle WMM) und die
  Korrektur transparent anzeigen.
- Safety-Wording wie immer: Entscheidungshilfe, ersetzt keine Seemannschaft
  (Handpeilkompass, amtliche Karten).

## Einordnung

Gehört in die „Jetzt & hier“-Detailansicht (REQ-NAV-024, MVP 1) als eigenes
kleines Sub-Tool — technisch unabhängig vom Routing, gut isoliert baubar
(reine Client-Geometrie + Kompass-API; testbar mit injizierten Headings).
