// toerns.ts — vordefinierte Törn-Routen mit Wegpunkt-Ketten pro Revier.
//
// Jeder Törn ist eine klassische Segelroute mit geordneten Wegpunkten (Häfen
// oder Ankerpunkte), optional mit Link zum Reiseblog-Artikel. Nutzer kann
// einen Törn per Klick laden und damit die Nav-App direkt mit Wegpunkten
// initialzieren -> Route wird berechnet.
//
// REQ-NAV-028: Törn-Presets in Navigation

import { type NavHafen, getNavRevier, inBbox } from "./reviere";

export interface NavToern {
  // Eindeutige ID, klein-kebab-case
  id: string;
  // Anzeigename (z. B. "Göteborg-Schären Klassiker")
  label: string;
  // Revier, zu dem dieser Törn gehört
  revierId: string;
  // Kurz-Beschreibung (1-2 Sätze, z. B. Thema, Dauer, Schwierigkeit)
  beschreibung: string;
  // Geordnete Wegpunkte (3..8), alle müssen in der Revier-bbox liegen
  wegpunkte: NavHafen[];
  // Optional: Link zum Reiseblog-Artikel über den Törn
  reiseblogUrl?: string;
}

/** Alle vordefinierten Törn-Routen. */
export const TOERNS: NavToern[] = [
  {
    id: "bohuslaen-klassiker",
    label: "Göteborg-Schären Klassiker",
    revierId: "bohuslaen",
    beschreibung:
      "Klassische Göteborg-Route durch die schwedischen Westküsten-Schären: " +
      "von Göteborg über Marstrand bis Smögen, mit Ankerplätz in Käringön.",
    wegpunkte: [
      { name: "Göteborg / Långedrag", lat: 57.66, lon: 11.84 },
      { name: "Marstrand", lat: 57.887, lon: 11.585 },
      { name: "Rörö", lat: 57.752, lon: 11.632 },
      { name: "Käringön", lat: 58.079, lon: 11.383 },
      { name: "Gullholmen", lat: 58.183, lon: 11.393 },
      { name: "Smögen", lat: 58.354, lon: 11.226 },
    ],
    reiseblogUrl: "https://join-the-captain.org/reisen/schaeren-route.html",
  },
  {
    id: "kanaren-ost",
    label: "Kanaren Ost-Runde",
    revierId: "kanaren",
    beschreibung:
      "Atlantische Inselhopping-Route (Lanzarote & Fuerteventura): " +
      "Arrecife → Puerto Calero → Playa Blanca → Corralejo → La Graciosa, " +
      "mit Wellen & Trade-Winds.",
    wegpunkte: [
      { name: "Arrecife (Lanzarote)", lat: 28.963, lon: -13.535 },
      { name: "Puerto Calero", lat: 28.915, lon: -13.703 },
      { name: "Playa Blanca / Rubicón", lat: 28.858, lon: -13.823 },
      { name: "Corralejo (Fuerteventura)", lat: 28.730, lon: -13.867 },
      { name: "Caleta del Sebo (La Graciosa)", lat: 29.229, lon: -13.503 },
      { name: "Arrecife (Lanzarote)", lat: 28.963, lon: -13.535 },
    ],
    reiseblogUrl: "https://join-the-captain.org/reisen/kanaren.html",
  },
  {
    id: "daenische-suedsee-runde",
    label: "Dänische Südsee Klassiker",
    revierId: "daenische-suedsee",
    beschreibung:
      "Klassische Fünen-Ærø-Runde: Sønderborg → Svendborg → Ærøskøbing → " +
      "Marstal → Faaborg → Sønderborg, charmante Hafenorte & flaches Wasser.",
    wegpunkte: [
      { name: "Sønderborg", lat: 54.909, lon: 9.789 },
      { name: "Svendborg", lat: 55.06, lon: 10.61 },
      { name: "Ærøskøbing", lat: 54.889, lon: 10.411 },
      { name: "Marstal", lat: 54.856, lon: 10.518 },
      { name: "Faaborg", lat: 55.095, lon: 10.24 },
      { name: "Sønderborg", lat: 54.909, lon: 9.789 },
    ],
    reiseblogUrl: "https://join-the-captain.org/reisen/daenische-suedsee.html",
  },
];

/**
 * Alle Törns eines bestimmten Reviers.
 * [REQ-NAV-028]
 */
export function toernsFuerRevier(revierId: string): NavToern[] {
  return TOERNS.filter((t) => t.revierId === revierId);
}

/**
 * Validierung: jeder Törn hat gültige Reviere + 3..8 Wegpunkte in der bbox.
 * Nur Logik, kein I/O — für Unit-Tests.
 */
export function validateToern(toern: NavToern): string[] {
  const errs: string[] = [];

  // Revier existiert?
  const revier = getNavRevier(toern.revierId);
  if (!revier) {
    errs.push(`Revier '${toern.revierId}' existiert nicht.`);
  }

  // Wegpunkte-Größe
  if (toern.wegpunkte.length < 3) {
    errs.push(`Törn '${toern.id}' hat nur ${toern.wegpunkte.length} Wegpunkte (mind. 3).`);
  }
  if (toern.wegpunkte.length > 8) {
    errs.push(`Törn '${toern.id}' hat ${toern.wegpunkte.length} Wegpunkte (max. 8).`);
  }

  // Alle Wegpunkte in der bbox?
  if (revier) {
    for (const wp of toern.wegpunkte) {
      if (!inBbox(wp.lat, wp.lon, revier.bbox)) {
        errs.push(
          `Wegpunkt '${wp.name}' [${wp.lat}, ${wp.lon}] liegt NICHT in ` +
            `bbox von '${revier.id}'.`,
        );
      }
    }
  }

  // reiseblogUrl gesetzt & https?
  if (toern.reiseblogUrl) {
    if (!toern.reiseblogUrl.startsWith("https://")) {
      errs.push(`reiseblogUrl von '${toern.id}' ist nicht https.`);
    }
  }

  return errs;
}
