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
};

/** Alle Wörterbücher, nach Sprache. */
export const WOERTERBUECHER: Readonly<Record<Sprache, Woerterbuch>> = { de, en };
