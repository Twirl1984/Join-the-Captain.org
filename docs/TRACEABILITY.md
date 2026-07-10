# Traceability-Matrix — Anforderungen ↔ Tests

GENERIERT von `npm run trace` (scripts/trace-check.ts) — nicht von Hand editieren.
Stand: Requirements 39 · getaggte Zuordnungen 60.

| Requirement | Status | Verifizierende Tests |
|---|---|---|
| REQ-WET-001 — Routen-Forecast | umgesetzt | `src/lib/weather/__tests__/route-forecast.test.ts`: [REQ-WET-001] planRoute: zwei Wegpunkte → ein Leg, plausible ETA<br>`e2e/navigation-live.spec.ts`: [REQ-WET-001] [REQ-NAV-001] Route live berechnen → Legs erscheinen |
| REQ-WET-002 — Risiko-Regler | umgesetzt | `src/lib/weather/__tests__/warnings.test.ts`: [REQ-WET-002] höhere Sensitivität senkt jede Schwelle monoton<br>`e2e/navigation-live.spec.ts`: [REQ-WET-002] [REQ-NAV-015] Regler ↑ erhöht (oder hält) die Warnungszahl |
| REQ-WET-003 — Sicherheits-Floor | umgesetzt | `src/lib/weather/__tests__/warnings.test.ts`: [REQ-WET-003] Sicherheits-Floor: schwerer Sturm warnt auch bei risikofreudigstem Regler |
| REQ-WET-004 — Leg-Verlaufs-Warnung | umgesetzt | `src/lib/weather/__tests__/departure-scan.test.ts`: [REQ-WET-004] [REQ-WET-005] scanDepartures: empfiehlt Sonntagmorgen statt Samstag im Gewit |
| REQ-WET-005 — Abfahrts-Scan | umgesetzt | `src/lib/weather/__tests__/departure-scan.test.ts`: [REQ-WET-004] [REQ-WET-005] scanDepartures: empfiehlt Sonntagmorgen statt Samstag im Gewit |
| REQ-WET-006 — Boots-Presets & Specs | umgesetzt | `src/lib/weather/__tests__/departure-scan.test.ts`: [REQ-WET-006] boatFromSpecs: direkte Marschfahrt gewinnt gegen PS-Ableitung |
| REQ-WET-007 — Wind-Grenzen des Boots | umgesetzt | `src/lib/weather/__tests__/departure-scan.test.ts`: [REQ-WET-007] planRoute (Jolle): zu wenig Wind erzeugt Flaute-Warnung, endliche Dauer |
| REQ-WET-008 — Strömung in der Fahrt | umgesetzt | `src/lib/weather/__tests__/route-forecast.test.ts`: [REQ-WET-008] Schiebestrom verkürzt, Gegenstrom verlängert die Legdauer |
| REQ-WET-009 — Archiv-Modus | umgesetzt | `src/lib/weather/__tests__/open-meteo.integration.test.ts`: [REQ-WET-009] isArchiveWindow: Vergangenheit → Archiv, Zukunft → Forecast |
| REQ-WET-010 — Wetter-Zeitreise | umgesetzt | `src/lib/weather/__tests__/playback.test.ts`: [REQ-WET-010] Mitte von Leg 1: halber Weg zwischen A und B |
| REQ-WET-011 — Modell-Transparenz & -Wahl | umgesetzt | `e2e/navigation-live.spec.ts`: [REQ-WET-011] Modell-Wahl zeigt eine Begründung |
| REQ-WET-012 — Feedback-Loop | umgesetzt | `e2e/navigation-live.spec.ts`: [REQ-WET-012] Feedback-Flow inkl. Abweichungs-Chips und Kontakt (API gemockt) |
| REQ-WET-013 — FP/FN-Backtest | umgesetzt | `src/lib/weather/__tests__/backtest.test.ts`: [REQ-WET-013] Sweep: FNR fällt monoton, FPR steigt monoton mit der Sensitivität |
| REQ-WET-014 — Himmels-Zustand in der Zeitreise | umgesetzt | `src/lib/weather/__tests__/format.test.ts`: [REQ-WET-014] skyCondition: Bänder klar/heiter/wolkig/bedeckt aus dem Bedeckungsgrad<br>`src/lib/weather/__tests__/format.test.ts`: [REQ-WET-014] skyCondition: klar/heiter sind nachtabhängig (Sonne am Tag, Mond nachts)<br>`src/lib/weather/__tests__/format.test.ts`: [REQ-WET-014] skyCondition: ohne Bedeckungsdaten kein Icon; is_day-Default = Tag<br>`e2e/navigation.spec.ts`: [REQ-WET-014] Zeitreise zeigt Himmels-Icons; wolkenlose Nacht ergibt einen Mond |
| REQ-NAV-001 — Wasserweg-Routing | umgesetzt | `src/lib/navigation/__tests__/searoute.test.ts`: [REQ-NAV-001] Insel im Weg: Route führt außen herum<br>`e2e/navigation-live.spec.ts`: [REQ-WET-001] [REQ-NAV-001] Route live berechnen → Legs erscheinen<br>`e2e/navigation.spec.ts`: [REQ-NAV-001] zwei Wegpunkte → Wasserweg-Route mit Umweg-Punkt, ETA und Legs |
| REQ-NAV-002 — Server-Snap & Unreachable | umgesetzt | `src/lib/navigation/__tests__/searoute.test.ts`: [REQ-NAV-002] Wegpunkt knapp an Land (Hafen!): wird auf nächste Wasserzelle gesnappt<br>`src/lib/navigation/__tests__/searoute.test.ts`: [REQ-NAV-002] Start tief im Landesinneren: unreachable (kein wildes Snappen) |
| REQ-NAV-003 — Tiefen & Flachwasser-Check | umgesetzt | `src/lib/navigation/__tests__/depth.test.ts`: [REQ-NAV-003] flachwasserCheck: gefahr / knapp / ok / unbekannt<br>`e2e/navigation.spec.ts`: [REQ-NAV-003] Flachwasser-Check läuft AUTOMATISCH nach der Berechnung und markiert die kri |
| REQ-NAV-004 — Reviere-Gruppen & Suche | umgesetzt | `e2e/navigation.spec.ts`: [REQ-NAV-004] Revier-Suche:  |
| REQ-NAV-005 — GPS | umgesetzt | `e2e/navigation.spec.ts`: [REQ-NAV-005] GPS aktivieren → Position sichtbar, Route ab Position mit Live-Badge |
| REQ-NAV-006 — Luftlinien-Ehrlichkeit | umgesetzt | `e2e/navigation.spec.ts`: [REQ-NAV-006] Luftlinien-Segment wird ehrlich ausgewiesen |
| REQ-NAV-007 — Nav-Playback | umgesetzt | `e2e/navigation.spec.ts`: [REQ-NAV-007] Playback: Zeit-Slider bewegt die Zeit, Wolkenfelder liegen auf der Karte |
| REQ-NAV-008 — Boots-Presets in Navigation | umgesetzt | `e2e/navigation.spec.ts`: [REQ-NAV-008] Boots-Preset Jolle übernimmt Parameter und setzt den Tiefgang |
| REQ-NAV-009 — Abfahrts-Scan über Wasserweg | umgesetzt | `e2e/navigation.spec.ts`: [REQ-NAV-009] Abfahrts-Scan über den Wasserweg liefert Slots mit Empfehlung |
| REQ-NAV-010 — Sichtbares Land-Snapping | umgesetzt | `e2e/navigation.spec.ts`: [REQ-NAV-010] Land-Klick snappt den Marker sichtbar an die Küste<br>`e2e/navigation.spec.ts`: [REQ-NAV-010] Klick zu weit im Land wird abgelehnt (Punkt verschwindet) |
| REQ-NAV-011 — Kreuz-ETA | umgesetzt | `src/lib/weather/__tests__/route-forecast.test.ts`: [REQ-NAV-011] beatVmgSpeed: positiv, aber langsamer als Halbwind-Fahrt<br>`src/lib/weather/__tests__/route-forecast.test.ts`: [REQ-NAV-011] Jolle ohne Motor gegenan: Leg wird primär KREUZEN mit endlicher Dauer<br>`src/lib/weather/__tests__/route-forecast.test.ts`: [REQ-NAV-011] Yacht mit Motor gegenan: primär Motor, Alternative Kreuzen, Gesamt-Alternati<br>`src/lib/weather/__tests__/route-forecast.test.ts`: [REQ-NAV-011] Halbwind-Kurs: kein Kreuzen, keine Alternative<br>`e2e/navigation.spec.ts`: [REQ-NAV-011] Am-Wind-Leg zeigt Kreuz-Alternative und Gesamt-Alternative |
| REQ-NAV-012 — Tide im Tiefen-Check | umgesetzt | `src/lib/navigation/__tests__/depth.test.ts`: [REQ-NAV-012] Tide-Verrechnung: Niedrigwasser kippt den Flachwasser-Status<br>`e2e/navigation.spec.ts`: [REQ-NAV-012] Flachwasser-Check rechnet die Tide ein und weist sie aus |
| REQ-NAV-013 — Wegpunkt-Verschieben | umgesetzt | `e2e/navigation.spec.ts`: [REQ-NAV-013] Wegpunkt per Ziehen verschieben → Snap-Prüfung greift |
| REQ-NAV-014 — Offline-Grundfähigkeit & TWA-Basis | umgesetzt | `e2e/navigation.spec.ts`: [REQ-NAV-014] Offline: zuletzt geladene Seite bleibt aufrufbar (Service Worker) |
| REQ-NAV-015 — Warn-Empfindlichkeit in Navigation | umgesetzt | `e2e/navigation-live.spec.ts`: [REQ-WET-002] [REQ-NAV-015] Regler ↑ erhöht (oder hält) die Warnungszahl |
| REQ-NAV-016 — Eine App: Navigation & Wetter | umgesetzt | `e2e/navigation-live.spec.ts`: [REQ-NAV-016] /wetter leitet dauerhaft auf /navigation um |
| REQ-NAV-017 — Liegezeit als Dauer und Uhrzeit | umgesetzt | `src/lib/weather/__tests__/api-helpers.test.ts`: [REQ-NAV-017] parseWaypoints: stay_min wird übernommen und gerundet<br>`src/lib/weather/__tests__/api-helpers.test.ts`: [REQ-NAV-017] parseWaypoints: stay_min 0 wird zu undefined (keine Liegezeit)<br>`src/lib/weather/__tests__/api-helpers.test.ts`: [REQ-NAV-017] parseWaypoints: ungültige stay_min werden abgelehnt<br>`src/lib/weather/__tests__/api-helpers.test.ts`: [REQ-NAV-017] staySumError: Summe der Liegezeiten über 7 Tage wird abgelehnt<br>`src/lib/weather/__tests__/route-forecast.test.ts`: [REQ-NAV-017] stay_min: Weiterfahrt = Ankunft + Dauer, layover_h gesetzt<br>`src/lib/weather/__tests__/route-forecast.test.ts`: [REQ-NAV-017] stay_min + depart_at: der spätere Zeitpunkt gewinnt (konservativ)<br>`src/lib/weather/__tests__/route-forecast.test.ts`: [REQ-NAV-017] stay_min 0/undefined: kein Layover, ETA unverändert<br>`e2e/navigation.spec.ts`: [REQ-NAV-017] Dauer ergibt Uhrzeit, Uhrzeit ergibt Dauer, stay_min/depart_at im Request<br>`e2e/navigation.spec.ts`: [REQ-NAV-017] vor der ersten Berechnung: Eingabe wird angenommen, Kopplung angekündigt |
| REQ-NAV-018 — Karte im Vollbild | umgesetzt | `e2e/navigation.spec.ts`: [REQ-NAV-018] Vollbild-Schalter vergrößert die Karte und schließt wieder (Klick & Escape) |
| REQ-SAFE-001 — Erstnutzungs-Disclaimer | umgesetzt | `e2e/navigation.spec.ts`: [REQ-SAFE-001] erscheint beim ersten Besuch, blockiert bis bestätigt, bleibt danach weg |
| REQ-SAFE-002 — Durchgängige Haftungshinweise | umgesetzt | `e2e/navigation-live.spec.ts`: [REQ-SAFE-002] Seite lädt mit Karte, Regler und Attribution<br>`e2e/navigation.spec.ts`: [REQ-SAFE-002] Seite lädt: Gruppen-Dropdown, Suche, Karte, Tiefen-Toggle, Attribution |
| REQ-SAFE-003 — Upstream-Härtung | umgesetzt | `e2e/navigation.spec.ts`: [REQ-SAFE-003] Wetterdienst down (502) → freundliche Meldung statt Absturz |
| REQ-SAFE-004 — API-Schutz | umgesetzt | `src/lib/__tests__/rate-limit.test.ts`: [REQ-SAFE-004] erlaubt bis zum Limit, blockt danach, Fenster läuft ab |
| REQ-PROC-001 — Traceability | umgesetzt | ⚠ FEHLT |
| REQ-PROC-002 — Widerspruchs-Regel | umgesetzt | ⚠ FEHLT |
| REQ-PROC-003 — Verifikationsschleifen | umgesetzt | ⚠ FEHLT |
