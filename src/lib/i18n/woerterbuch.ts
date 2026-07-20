// Wörterbücher Deutsch/Englisch (REQ-I18N-001).
//
// Aufbau: flache Schlüssel nach dem Muster <bereich>.<sache>. Bewusst flach —
// verschachtelte Objekte sehen ordentlicher aus, machen aber das Nachschlagen
// und die Suche nach einem Text im Code umständlicher.
//
// REGEL: Hier stehen nur FUNKTIONALE Texte (Bedienung, Beschriftungen,
// Fehlermeldungen). Haftungs-, Impressums- und Datenschutztexte gehören NICHT
// hierher — sie bleiben deutsch im Quelltext der jeweiligen Seite, weil eine
// maschinelle Übersetzung juristischer Formulierungen ein Haftungsrisiko wäre
// (REQ-SAFE-002). Eine englische Fassung braucht juristische Prüfung.

import type { Sprache, Woerterbuch } from "./sprache";

const de: Woerterbuch = {
  // Kopfbereich und Navigation
  "kopf.navigation": "Navigation",
  "kopf.tools": "Werkzeuge",
  "kopf.wissen": "Wissen",
  "kopf.podcast": "Podcast",
  "kopf.community": "Community",
  "kopf.startseite": "Startseite",
  "kopf.wetter": "Wetter",
  "kopf.entrepreneurs": "Entrepreneurs",
  "kopf.zur_buchung": "Zur Buchung",
  "kopf.menue_oeffnen": "Menü öffnen",

  // Fußbereich (ohne den Affiliate-Pflichthinweis — der bleibt deutsch)
  "fuss.beschreibung":
    "Geprüfte Tools, ehrliche Empfehlungen und Stimmen aus der Szene. Von Seglern für Segler — von der Planung bis nach dem Anlegen.",
  "fuss.bereiche": "Bereiche",
  "fuss.mehr": "Mehr",
  "fuss.nav_wetter": "Navigation & Wetter",
  "fuss.support": "Support",
  "fuss.zur_buchung_de": "Zur Buchung (.de)",
  "fuss.impressum": "Impressum",
  "fuss.datenschutz": "Datenschutz",

  // Törnplanung — die Kernbedienung
  "nav.berechnen": "Route über Wasser berechnen",
  "nav.berechne_laeuft": "Berechne …",
  "nav.mindestens_zwei": "Mindestens 2 Wegpunkte setzen — auf die Karte oder einen Hafen tippen.",
  "nav.revier_suchen": "Revier suchen (Name, Gruppe oder Hafen)",
  "nav.tiefgang_label": "Tiefgang (m) — für den Flachwasser-Check",
  "nav.gpx_titel": "Route als GPX für Plotter/Apps herunterladen",
  "nav.teilen_titel": "Read-only Link zum Teilen erzeugen",
  "nav.zuruecksetzen": "Zurücksetzen",
  "nav.revier": "Revier",
  "nav.startzeit": "Startzeit",
  "nav.tiefgang": "Tiefgang",
  "nav.punkte_gesetzt": "{n} Punkte gesetzt",
  "nav.route_berechnen_hinweis": "Setze mindestens zwei Punkte auf der Karte.",
  "nav.wasserweg": "Wasserweg",
  "nav.luftlinie": "Luftlinie",
  "nav.gesamt": "Gesamt",
  "nav.ankunft": "Ankunft",
  "nav.karte_vollbild": "Karte im Vollbild",
  "nav.gpx_export": "GPX exportieren",
  "nav.toern_teilen": "Törn teilen",
  "navseite.eyebrow": "JTC-Eigenbau · Beta",

  // Geteilter Törn — Aufruf zum Selbstplanen (REQ-EXP-010)
  "share.cta_titel": "Plane deinen eigenen Törn",
  "share.cta_text":
    "Route über den Wasserweg, Wetter entlang der Strecke und Ankunftszeit je Etappe — kostenlos und ohne Anmeldung.",
  "share.cta_knopf": "Törn planen",
  "share.geteilter_toern": "Geteilter Törn",
  "share.erlebnisse": "Erlebnisse entlang der Route",
  "share.readonly_hinweis": "Diese Ansicht ist read-only.",
  "navseite.titel": "Navigation & Wetter",
  "navseite.einleitung":
    "Seekarte mit Tiefen, Route, die automatisch um Land herumführt, deine GPS-Position und echte Ankunftszeiten — dazu Strömung, Wind und Wolkenfelder über die Zeit.",

  // Wetter
  "wetter.wind": "Wind",
  "wetter.boeen": "Böen",
  "wetter.temperatur": "Temperatur",
  "wetter.niederschlag": "Niederschlag",
  "wetter.wellen": "Wellen",
  "wetter.ueber_die_zeit": "Wetter über die Zeit",
  "wetter.abspielen": "Abspielen",
  "wetter.pause": "Pause",

  // Tiefe und Sicherheit (Bedienung — nicht der Haftungstext selbst)
  "tiefe.pruefen": "Tiefe prüfen",
  "tiefe.ok": "ausreichend Wasser",
  "tiefe.knapp": "knapp",
  "tiefe.gefahr": "zu flach",
  "tiefe.unbekannt": "keine Tiefendaten",

  // Allgemeine Zustände
  "allg.laedt": "Lädt …",
  "allg.fehler": "Etwas ist schiefgelaufen.",
  "allg.erneut_versuchen": "Erneut versuchen",
  "allg.abbrechen": "Abbrechen",
  "allg.schliessen": "Schließen",
  "allg.mehr_anzeigen": "Mehr anzeigen",
  "allg.keine_daten": "Keine Daten vorhanden.",

  // Fehlermeldungen, die Nutzer wirklich sehen
  "fehler.kein_wasserweg":
    "Zwischen diesen Punkten führt kein durchgehender Wasserweg. Prüfe, ob beide im selben Revier liegen.",
  "fehler.netz": "Keine Verbindung. Prüfe dein Netz und versuche es erneut.",
  "fehler.wetter_nicht_verfuegbar": "Wetterdaten sind gerade nicht verfügbar.",

  // Playback und Wetterlayer
  "nav.playback_pick_hint": "🎯 Tippe auf der Karte das Objekt an, das du anpeilst (Peilung {n}).",
  "nav.depth_layer_toggle": "Tiefen-Layer (EMODnet)",
  "nav.depth_map_legend_water": "— Wasserweg",
  "nav.depth_map_legend_straight": "- - Luftlinie",
  "nav.playback_title_v2": "Wetter über die Zeit",
  "nav.playback_title_v1": "Wolken & Wind über die Zeit",
  "nav.playback_symbols_arrows": "⇢ Pfeile",
  "nav.playback_symbols_flags": "⇢ Windfahnen",
  "nav.playback_time_input_label": "Zeitpunkt im Playback",
  "nav.playback_legend_v2":
    "Graue Flächen = Wolkenfelder (je dichter, desto dunstiger) · Windfahnen = Richtung & Stärke (Halbstrich 5 kn, Strich 10 kn, Wimpel 50 kn, Schaft zeigt zur Herkunft) · Zahl = Knoten, ° = Temperatur · 🌦️/🌧️/⛈️ Regen (leicht/mäßig/stark) · ☀️/🌙 klar (Tag/Nacht), 🌤️ heiter, ⛅ wolkig, ☁️ bedeckt · ⚡ Gewitter · ⛵ ungefähre Bootsposition zu diesem Zeitpunkt.",
  "nav.playback_legend_v1":
    "Graue Flächen = Wolkenfelder (je dichter, desto dunstiger) · Pfeile = Wind · ☀️/🌙 klar (Tag/Nacht), 🌤️ heiter, ⛅ wolkig, ☁️ bedeckt · ⚡ Gewitter · ⛵ ungefähre Bootsposition zu diesem Zeitpunkt.",

  // GPS und Position
  "nav.gps_title": "Meine Position (GPS)",
  "nav.gps_activate": "GPS aktivieren",
  "nav.gps_stop": "GPS stoppen",
  "nav.gps_status_off": "aus",
  "nav.gps_status_active": "aktiv",
  "nav.gps_status_searching": "suche Satelliten …",
  "nav.gps_status_blocked": "Standort ist für diese Seite/den Browser blockiert.",
  "nav.gps_status_unavailable": "GPS hier nicht verfügbar.",
  "nav.gps_help_title": "So schaltest du den Standort frei:",
  "nav.gps_help_ios_safari_1": "Einstellungen → Datenschutz & Sicherheit → Ortungsdienste einschalten",
  "nav.gps_help_ios_safari_2": "Gleich darunter: Safari-Websites → \"Beim Verwenden\"",
  "nav.gps_help_ios_safari_3": "Hierher zurück, Seite neu laden, \"GPS aktivieren\" tippen",
  "nav.gps_help_ios_third_1": "Einstellungen → Datenschutz & Sicherheit → Ortungsdienste einschalten",
  "nav.gps_help_ios_third_2":
    "Einstellungen → {browser} → Standort → \"Beim Verwenden der App\" (diesen Schritt übersehen die meisten)",
  "nav.gps_help_ios_third_3": "Hierher zurück, Seite neu laden, \"GPS aktivieren\" tippen",
  "nav.gps_help_android_1": "Schloss-Symbol in der Adresszeile → Berechtigungen → Standort → Zulassen",
  "nav.gps_help_android_2":
    "Falls das fehlt: Android-Einstellungen → Apps → dein Browser → Berechtigungen → Standort",
  "nav.gps_help_android_3": "Seite neu laden, \"GPS aktivieren\" tippen",
  "nav.gps_help_desktop_1": "Schloss-Symbol links in der Adresszeile → Standort → Zulassen",
  "nav.gps_help_desktop_2": "Seite neu laden, \"GPS aktivieren\" tippen",
  "nav.gps_retry": "Standort erneut anfragen",
  "nav.gps_help_note":
    "Ein direkter Link in die Einstellungen ist Webseiten von Apple/Google gesperrt — in unserer App fürs iPhone/Android kommt der Ein-Klick-Knopf.",
  "nav.gps_follow": "Karte folgt meiner Position",
  "nav.gps_start_at": "Route startet an meiner Position (Abfahrt = jetzt → echte Ankunftszeiten)",
  "nav.gps_auto_update": "ETA automatisch aktualisieren (alle 60 s)",

  // Jetzt & hier — aktuelle Bedingungen
  "nav.jetzt_title": "Jetzt & hier — Position, Wetter, Häfen",
  "nav.jetzt_hint":
    "Aktiviere oben \"Meine Position (GPS)\", um aktuelles Wetter, die Tiefe unter dem Kiel und die nächsten Häfen an deiner Position zu sehen.",
  "nav.jetzt_revier_suggestion": "Du bist am nächsten an {revier} ({distance_nm} sm).",
  "nav.jetzt_switch": "Dorthin wechseln",
  "nav.jetzt_position_label": "Position",
  "nav.jetzt_load": "Bedingungen laden",
  "nav.jetzt_loading": "Lade …",
  "nav.jetzt_refresh": "Aktualisieren",
  "nav.jetzt_error": "Bedingungen gerade nicht verfügbar — bitte später erneut.",
  "nav.jetzt_weather_label": "Wetter:",
  "nav.jetzt_gusts": "Böen",
  "nav.jetzt_wave": "Welle",
  "nav.jetzt_current": "Strom",
  "nav.jetzt_warning_prefix": "⚠",
  "nav.jetzt_gale": "Sturm",
  "nav.jetzt_thunderstorm": "Gewitter",
  "nav.jetzt_high_wave": "hohe Welle",
  "nav.jetzt_warning_caution": "— Vorsicht.",
  "nav.jetzt_under_keel": "Unter dem Kiel:",
  "nav.jetzt_depth": "m Wassertiefe",
  "nav.jetzt_harbors_label": "Nächste Häfen:",

  // Peilung
  "nav.bearing_title": "Peilung — Standort-Backup (wenn GPS spinnt)",
  "nav.bearing_howto_strong": "Handy aufrecht halten und mit der Kamera-Rückseite auf das Objekt zielen",
  "nav.bearing_howto_rest":
    ", dann „Kompass“ tippen. Peile 2–3 markante Objekte an — der Schnitt der Peilungen ergibt deinen Standort. Klassische Seemannschaft als Rückfall, wenn die GPS-Position unplausibel wirkt.",
  "nav.bearing_pick_object": "Objekt wählen …",
  "nav.bearing_hint":
    "Keine Referenzpunkte in der Nähe — wähle ein passendes Revier oder aktiviere GPS.",
  "nav.bearing_declination_label": "Missweisung (° Ost, grobe Näherung)",

  // Route und Wegpunkte
  "nav.route_title": "Route",
  "nav.route_gps_startpoint": "Start: Meine Position",
  "nav.route_map_hint": "Karte oder Hafen anklicken — die Route weicht Land automatisch aus.",
  "nav.route_remove_label": "Wegpunkt {n} entfernen",
  "nav.route_arrival_time": "Ankunft",
  "nav.route_arrival_pending": "Dauer und Uhrzeit werden nach \"Route berechnen\" gekoppelt.",
  "nav.route_stay_label": "Liegezeit",
  "nav.route_depart_label": "Weiterfahrt ab",

  // Abfahrt
  "nav.departure_label": "Abfahrt (bis 7 Tage voraus)",
  "nav.departure_mode_label": "Fahrmodus",
  "nav.departure_sail": "Segeln (Motor wenn nötig)",
  "nav.departure_sail_title":
    "So viel wie möglich segeln — Motor nur bei Flaute oder hart am Wind",
  "nav.departure_motor": "Motor",

  // Boot
  "nav.boat_title": "Boot anpassen (optional)",
  "nav.boat_hull_speed": "→ Rumpfgeschwindigkeit {speed} kn",
  "nav.boat_cruise_motor": "Marschfahrt {speed} kn",
  "nav.boat_no_motor": "ohne Motor",
  "nav.boat_wind_min": "min {wind} kn Wind",
  "nav.boat_wind_max": "max {wind} kn",
  "nav.boat_preset_note": "Preset setzt auch den Tiefgang",

  // Warn-Empfindlichkeit
  "nav.sensitivity_title": "Warn-Empfindlichkeit",
  "nav.sensitivity_risk": "Risikofreudig — wenige Fehlalarme",
  "nav.sensitivity_caution": "Vorsichtig — keine verpasste Warnung",
  "nav.sensitivity_explanation":
    "Fehlalarm (FP) heißt: unnötig in den Hafen. Verpasste Warnung (FN) heißt: ungewarnt im Sturm — schwere Stürme (≥ 9 Bft) warnen deshalb immer, unabhängig vom Regler.",

  // Routen-Profil
  "nav.profile_title": "Routen-Profil",
  "nav.profile_shortest": "Kürzester",
  "nav.profile_shortest_hint": "reiner Wasserweg, ohne Wetter",
  "nav.profile_sail": "Segel-schnell",
  "nav.profile_sail_hint": "meidet Flaute, kreuzt durch die No-Go-Zone",
  "nav.profile_motor": "Motor-schnell",
  "nav.profile_motor_hint": "Marschfahrt, hohe Welle bremst",
  "nav.profile_comfort": "Komfort",
  "nav.profile_comfort_hint": "meidet Seegang und Starkwind, auch per Umweg",
  "nav.profile_weather_hint":
    "Wetter-bepreister Weg zur Abfahrtszeit — Planungshilfe, ersetzt keine laufende Wetterbeobachtung unterwegs.",

  // Abfahrts-Scan
  "nav.scan_title": "Beste Abfahrt finden",
  "nav.scan_label": "spätester Start",
  "nav.scan_button": "Abfahrt empfehlen (über Wasserweg)",

  // Tiefe
  "nav.depth_title": "Tiefen entlang der Route",
  "nav.depth_check_loading": "Prüfe …",
  "nav.depth_check_button": "Erneut gegen {tiefgang} m Tiefgang prüfen",

  // Erlebnisse
  "nav.experiences_title": "Erlebnisse entlang der Route",
  "nav.experiences_desc":
    "Buchten, Sehenswürdigkeiten und Versorgung im Korridor um den Wasserweg — kuratiert mit Quellenangabe, keine amtliche Freigabe.",
  "nav.experiences_load": "Erlebnisse laden",
  "nav.experiences_loading": "Lädt …",

  // Feedback
  "nav.feedback_title": "Dein Feedback",
  "nav.feedback_question": "Hat die Vorhersage gepasst?",
  "nav.feedback_ok": "👍 passte",
  "nav.feedback_not_ok": "👎 lag daneben",
  "nav.feedback_satisfaction": "Wie zufrieden bist du?",
  "nav.feedback_star_label": "{n} von 5 Sternen",
  "nav.feedback_text_placeholder": "Was war falsch, was wünschst du dir noch?",
  "nav.feedback_name_label": "Name (optional)",
  "nav.feedback_email_label": "E-Mail (optional, für Rückfragen)",
  "nav.feedback_sending": "Sende …",
  "nav.feedback_submit": "Feedback senden",
  "nav.feedback_thanks": "Danke! Dein Feedback fließt in die Kalibrierung der Warnungen ein.",
  "nav.feedback_contact": "Direkter Draht:",
};

const en: Woerterbuch = {
  // Header and navigation
  "kopf.navigation": "Navigation",
  "kopf.tools": "Tools",
  "kopf.wissen": "Knowledge",
  "kopf.podcast": "Podcast",
  "kopf.community": "Community",
  "kopf.startseite": "Home",
  "kopf.wetter": "Weather",
  "kopf.entrepreneurs": "Entrepreneurs",
  "kopf.zur_buchung": "Book a trip",
  "kopf.menue_oeffnen": "Open menu",

  // Footer (excluding the mandatory affiliate notice — that stays German)
  "fuss.beschreibung":
    "Tested tools, honest recommendations and voices from the scene. By sailors, for sailors — from planning to after you have moored.",
  "fuss.bereiche": "Sections",
  "fuss.mehr": "More",
  "fuss.nav_wetter": "Navigation & weather",
  "fuss.support": "Support",
  "fuss.zur_buchung_de": "Book a trip (.de)",
  "fuss.impressum": "Legal notice",
  "fuss.datenschutz": "Privacy policy",

  // Passage planning — the core controls
  "nav.berechnen": "Calculate route over water",
  "nav.berechne_laeuft": "Calculating …",
  "nav.mindestens_zwei": "Place at least 2 waypoints — tap the chart or a harbour.",
  "nav.revier_suchen": "Search sailing area (name, group or harbour)",
  "nav.tiefgang_label": "Draught (m) — for the shallow-water check",
  "nav.gpx_titel": "Download the route as GPX for plotters and apps",
  "nav.teilen_titel": "Create a read-only link to share",
  "nav.zuruecksetzen": "Reset",
  "nav.revier": "Sailing area",
  "nav.startzeit": "Departure time",
  "nav.tiefgang": "Draught",
  "nav.punkte_gesetzt": "{n} waypoints set",
  "nav.route_berechnen_hinweis": "Place at least two waypoints on the chart.",
  "nav.wasserweg": "Route over water",
  "nav.luftlinie": "Straight line",
  "nav.gesamt": "Total",
  "nav.ankunft": "Arrival",
  "nav.karte_vollbild": "Full-screen chart",
  "nav.gpx_export": "Export GPX",
  "nav.toern_teilen": "Share passage",
  "navseite.eyebrow": "Built by JTC · Beta",

  // Shared passage — call to action (REQ-EXP-010)
  "share.cta_titel": "Plan your own passage",
  "share.cta_text":
    "Route over water, weather along the way and an arrival time for every leg — free and without signing up.",
  "share.cta_knopf": "Plan a passage",
  "share.geteilter_toern": "Shared passage",
  "share.erlebnisse": "Places along the route",
  "share.readonly_hinweis": "This view is read-only.",
  "navseite.titel": "Navigation & weather",
  "navseite.einleitung":
    "Nautical chart with depths, a route that automatically avoids land, your GPS position and realistic arrival times — plus current, wind and cloud cover over time.",

  // Weather
  "wetter.wind": "Wind",
  "wetter.boeen": "Gusts",
  "wetter.temperatur": "Temperature",
  "wetter.niederschlag": "Precipitation",
  "wetter.wellen": "Waves",
  "wetter.ueber_die_zeit": "Weather over time",
  "wetter.abspielen": "Play",
  "wetter.pause": "Pause",

  // Depth and safety (controls — not the liability notice itself)
  "tiefe.pruefen": "Check depth",
  "tiefe.ok": "sufficient water",
  "tiefe.knapp": "tight",
  "tiefe.gefahr": "too shallow",
  "tiefe.unbekannt": "no depth data",

  // General states
  "allg.laedt": "Loading …",
  "allg.fehler": "Something went wrong.",
  "allg.erneut_versuchen": "Try again",
  "allg.abbrechen": "Cancel",
  "allg.schliessen": "Close",
  "allg.mehr_anzeigen": "Show more",
  "allg.keine_daten": "No data available.",

  // Error messages users actually see
  "fehler.kein_wasserweg":
    "There is no continuous route over water between these points. Check that both lie within the same sailing area.",
  "fehler.netz": "No connection. Check your network and try again.",
  "fehler.wetter_nicht_verfuegbar": "Weather data is currently unavailable.",

  // Playback and depth layer
  "nav.playback_pick_hint": "🎯 Tap the object on the chart you are taking a bearing on (bearing {n}).",
  "nav.depth_layer_toggle": "Depth layer (EMODnet)",
  "nav.depth_map_legend_water": "— Route over water",
  "nav.depth_map_legend_straight": "- - Straight line",
  "nav.playback_title_v2": "Weather over time",
  "nav.playback_title_v1": "Cloud & wind over time",
  "nav.playback_symbols_arrows": "⇢ Arrows",
  "nav.playback_symbols_flags": "⇢ Barbs",
  "nav.playback_time_input_label": "Time in forecast",
  "nav.playback_legend_v2":
    "Grey shading = cloud cover (darker = more obscured) · Barbs = direction & strength (pennant = 50 kn, full barb = 10 kn, half barb = 5 kn, shaft points toward the source) · Number = knots, ° = temperature · 🌦️/🌧️/⛈️ rain (light/moderate/heavy) · ☀️/🌙 clear (day/night), 🌤️ partly cloudy, ⛅ cloudy, ☁️ overcast · ⚡ thunderstorm · ⛵ approximate boat position at this time.",
  "nav.playback_legend_v1":
    "Grey shading = cloud cover (darker = more obscured) · Arrows = wind · ☀️/🌙 clear (day/night), 🌤️ partly cloudy, ⛅ cloudy, ☁️ overcast · ⚡ thunderstorm · ⛵ approximate boat position at this time.",

  // GPS and position
  "nav.gps_title": "My position (GPS)",
  "nav.gps_activate": "Enable GPS",
  "nav.gps_stop": "Stop GPS",
  "nav.gps_status_off": "off",
  "nav.gps_status_active": "active",
  "nav.gps_status_searching": "searching for satellites …",
  "nav.gps_status_blocked": "Location is blocked for this page or browser.",
  "nav.gps_status_unavailable": "GPS is unavailable here.",
  "nav.gps_help_title": "How to enable location:",
  "nav.gps_help_ios_safari_1": "Settings → Privacy & Security → Location Services → turn on",
  "nav.gps_help_ios_safari_2": "Below that: Safari Websites → \"Allow While Using\"",
  "nav.gps_help_ios_safari_3": "Return here, reload the page, tap \"Enable GPS\"",
  "nav.gps_help_ios_third_1": "Settings → Privacy & Security → Location Services → turn on",
  "nav.gps_help_ios_third_2":
    "Settings → {browser} → Location → \"Allow While Using the App\" (most people miss this step)",
  "nav.gps_help_ios_third_3": "Return here, reload the page, tap \"Enable GPS\"",
  "nav.gps_help_android_1": "Lock icon in the address bar → Permissions → Location → Allow",
  "nav.gps_help_android_2": "If not available: Android Settings → Apps → your browser → Permissions → Location",
  "nav.gps_help_android_3": "Reload the page, tap \"Enable GPS\"",
  "nav.gps_help_desktop_1": "Lock icon on the left of the address bar → Location → Allow",
  "nav.gps_help_desktop_2": "Reload the page, tap \"Enable GPS\"",
  "nav.gps_retry": "Request location again",
  "nav.gps_help_note":
    "Direct links to settings are blocked for websites by Apple and Google — our native app for iPhone and Android features a one-click button.",
  "nav.gps_follow": "Chart follows my position",
  "nav.gps_start_at": "Route starts at my position (departure = now → real arrival times)",
  "nav.gps_auto_update": "Update ETA automatically (every 60 s)",

  // Now & here — current conditions
  "nav.jetzt_title": "Now & here — position, weather, harbours",
  "nav.jetzt_hint":
    "Enable \"My position (GPS)\" above to see current weather, water depth beneath the hull and nearest harbours at your position.",
  "nav.jetzt_revier_suggestion": "You are nearest to {revier} ({distance_nm} nm).",
  "nav.jetzt_switch": "Switch there",
  "nav.jetzt_position_label": "Position",
  "nav.jetzt_load": "Load conditions",
  "nav.jetzt_loading": "Loading …",
  "nav.jetzt_refresh": "Refresh",
  "nav.jetzt_error": "Conditions unavailable at the moment — please try again later.",
  "nav.jetzt_weather_label": "Weather:",
  "nav.jetzt_gusts": "Gusts",
  "nav.jetzt_wave": "Wave",
  "nav.jetzt_current": "Current",
  "nav.jetzt_warning_prefix": "⚠",
  "nav.jetzt_gale": "Gale",
  "nav.jetzt_thunderstorm": "Thunderstorm",
  "nav.jetzt_high_wave": "high waves",
  "nav.jetzt_warning_caution": "— Exercise caution.",
  "nav.jetzt_under_keel": "Under the keel:",
  "nav.jetzt_depth": "m water depth",
  "nav.jetzt_harbors_label": "Nearest harbours:",

  // Bearing
  "nav.bearing_title": "Bearing — position backup (if GPS fails)",
  "nav.bearing_howto_strong": "Hold the phone upright and aim the back of the camera at the object",
  "nav.bearing_howto_rest":
    ", then tap “Compass”. Take bearings on 2–3 prominent objects — where the bearings cross is your position. Classic seamanship as a fallback when the GPS position looks implausible.",
  "nav.bearing_pick_object": "Choose an object …",
  "nav.bearing_hint": "No reference objects nearby — select a suitable sailing area or enable GPS.",
  "nav.bearing_declination_label": "Magnetic variation (° East, rough estimate)",

  // Route and waypoints
  "nav.route_title": "Route",
  "nav.route_gps_startpoint": "Start: My position",
  "nav.route_map_hint": "Click the chart or a harbour — the route automatically avoids land.",
  "nav.route_remove_label": "Remove waypoint {n}",
  "nav.route_arrival_time": "Arrival",
  "nav.route_arrival_pending": "Duration and time will be linked after \"Calculate route\".",
  "nav.route_stay_label": "Lay time",
  "nav.route_depart_label": "Continue from",

  // Departure
  "nav.departure_label": "Departure (up to 7 days ahead)",
  "nav.departure_mode_label": "Mode of passage",
  "nav.departure_sail": "Sail (motoring if needed)",
  "nav.departure_sail_title": "Sail as much as possible — motor only in calm or close-hauled",
  "nav.departure_motor": "Motor",

  // Boat
  "nav.boat_title": "Adjust boat (optional)",
  "nav.boat_hull_speed": "→ Hull speed {speed} kn",
  "nav.boat_cruise_motor": "Cruising speed {speed} kn",
  "nav.boat_no_motor": "no motor",
  "nav.boat_wind_min": "min {wind} kn wind",
  "nav.boat_wind_max": "max {wind} kn",
  "nav.boat_preset_note": "Preset also sets draught",

  // Warning sensitivity
  "nav.sensitivity_title": "Warning sensitivity",
  "nav.sensitivity_risk": "Risk-taking — few false alarms",
  "nav.sensitivity_caution": "Cautious — no missed warning",
  "nav.sensitivity_explanation":
    "False positive (FP) means: unnecessary harbour visit. Missed alarm (FN) means: caught unaware in a storm — strong gales (≥ 9 Bft) always warn regardless of the slider.",

  // Route profile
  "nav.profile_title": "Route profile",
  "nav.profile_shortest": "Shortest",
  "nav.profile_shortest_hint": "pure water route, no weather",
  "nav.profile_sail": "Sail-fast",
  "nav.profile_sail_hint": "avoids calm, crosses no-go zone",
  "nav.profile_motor": "Motor-fast",
  "nav.profile_motor_hint": "cruising speed, high waves slow progress",
  "nav.profile_comfort": "Comfort",
  "nav.profile_comfort_hint": "avoids seaway and strong wind, even if longer",
  "nav.profile_weather_hint":
    "Weather-priced route at departure time — planning aid only, does not replace ongoing weather observation underway.",

  // Departure scan
  "nav.scan_title": "Find best departure",
  "nav.scan_label": "latest start",
  "nav.scan_button": "Recommend departure (over water)",

  // Depth
  "nav.depth_title": "Depths along route",
  "nav.depth_check_loading": "Checking …",
  "nav.depth_check_button": "Check again for {tiefgang} m draught",

  // Experiences
  "nav.experiences_title": "Places along the route",
  "nav.experiences_desc":
    "Anchorages, sights and provisions in the corridor around the water route — curated with source attribution, no official approval.",
  "nav.experiences_load": "Load places",
  "nav.experiences_loading": "Loading …",

  // Feedback
  "nav.feedback_title": "Your feedback",
  "nav.feedback_question": "Did the forecast match?",
  "nav.feedback_ok": "👍 it matched",
  "nav.feedback_not_ok": "👎 it did not match",
  "nav.feedback_satisfaction": "How satisfied are you?",
  "nav.feedback_star_label": "{n} of 5 stars",
  "nav.feedback_text_placeholder": "What was wrong or what would you like?",
  "nav.feedback_name_label": "Name (optional)",
  "nav.feedback_email_label": "Email (optional, for follow-up)",
  "nav.feedback_sending": "Sending …",
  "nav.feedback_submit": "Send feedback",
  "nav.feedback_thanks": "Thank you! Your feedback is fed into the calibration of warnings.",
  "nav.feedback_contact": "Direct line:",
};

/** Alle Wörterbücher, nach Sprache. */
export const WOERTERBUECHER: Readonly<Record<Sprache, Woerterbuch>> = { de, en };
