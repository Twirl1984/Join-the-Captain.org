# Backlog — Navigations-App (Tickets)

Regel aus dem Agentic-Playbook: **kein TODO/Merkposten ohne Ticket.** Dieses
Dokument ist das Ticket-Register für /navigation; bei Umzug auf GitHub Issues
IDs beibehalten. Prioritäten aus dem Challenge-Review (2026-07-03):
P1 = vor/mit dem nächsten Release · P2 = nächster Zyklus · P3 = danach.

## P1 — Sicherheit & Validierung

- **NAV-1 · Live-Smoke mit echtem Netz — ERLEDIGT (Session 2, 2026-07-03)** — Auf der Test-Instanz: Open-Meteo-
  Erfolgspfad, EMODnet-WMS-Layer sichtbar, EMODnet-REST-Latenz, `JTC_WEATHER_LIVE=1
  npm run test:weather`, e2e/wetter.spec.ts. (Sandbox hatte kein Ausgangs-Netz.)
- **NAV-2 · Wolkenfeld-Optik auf See validieren** — Radius (2,5 km) und Opazität
  mit echten Daten prüfen: wirkt „dunstig", ohne die Karte zuzukleistern?
- **NAV-3 · Open-Meteo-Kostenmodell rechnen** — Timeline-Playback + 60-s-Auto-
  Update gegen Free-Tier-Quota modellieren; Schwelle für API-Plan (~29 €/Mon)
  und Preis-Marge (Captain-Tier minus Store-Abgabe) dokumentieren.

## P2 — Produkt (Reihenfolge nach Sicherheitsrelevanz, Challenge-Review §1)

- **NAV-4 · Offline-Fähigkeit** — K.-o.-Kriterium auf See: Karten-Tile-Cache,
  letzte Forecast-Timeline offline, Routing clientseitig (Masken sind klein
  genug fürs Bundle). Architektur-Entscheidung VOR weiteren Features.
- **NAV-5 · Gezeiten** — Tidenhub/-strom für Nordsee-Reviere (z. B. BSH/„tide
  API"-Quellen prüfen); bis dahin bleibt der Warnhinweis je Revier Pflicht.
- **NAV-6 · Track-Aufzeichnung + Anker-/XTE-Alarm** — Standard-Plotter-Feature,
  sicherheitsrelevant (Ankerwache), stärkstes Retention-Feature.
- **NAV-7 · MOB-Funktion** — ein Button (Position einfrieren, Peilung/Distanz
  live); minimaler Aufwand, maximale Glaubwürdigkeit.
- **NAV-8 · GPX-Import/Export** — Migrationspfad für Navionics-Nutzer.
- **NAV-9 · Feinere Masken für Förden/Schären** — Schlei & Co. laufen bei 1 km
  zu (Kappeln→Schleimünde-Workaround); OSM-Wasserflächen oder 250-m-Küstendaten.
- **NAV-10 · Tiefen ins Routing einbeziehen** — A*-Kosten um Flachwasser-Malus
  erweitern (Tiefen-Raster je Revier vorbereiten), statt nur nachgelagert zu prüfen.

## P3 — Stores & Monetarisierung

- **NAV-11 · Statisches Capacitor-Bundle statt Remote-Wrapper** — Apple-4.2-
  Risiko (Minimum Functionality) entschärfen; früher TestFlight-Probelauf
  GEGEN App Review, bevor P3 eingeplant wird.
- **NAV-12 · IAP-Strategie** — Apple 3.1.1: Abo im App-Binary nur über
  App-Store-Billing; Stripe nur Web. Preisstufen aus navigation-app-plan.md §1.
- **NAV-13 · AIS-Anzeige** — erst mit NMEA-/Hardware-Anbindung sinnvoll.
- **NAV-14 · IJsselmeer-Maskenqualität** — Seen-Datensatz prüft nur Umriss;
  Markermeer-Trennung (Houtribdijk) und Fahrwasser verifizieren.
