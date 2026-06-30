// reviere.ts — Segelreviere mit Kartenausschnitt und bekannten Häfen.
//
// Steuert die /wetter-Karte: Default-Center/Zoom je Revier plus ein paar Häfen
// als Schnellstart-Wegpunkte. Koordinaten aus den jtc.de-Validierungspunkten
// abgeleitet (api/data/weather/points.json) und um typische Charter-Häfen ergänzt.

import type { Waypoint } from "./route-forecast";

export interface Revier {
  id: string;
  label: string;
  /** Kartenmittelpunkt [lat, lon]. */
  center: [number, number];
  zoom: number;
  /** Bekannte Häfen als Schnellstart-Wegpunkte. */
  haefen: Required<Waypoint>[];
}

export const REVIERE: Revier[] = [
  {
    id: "ostsee",
    label: "Ostsee (Rügen / dänische Südsee)",
    center: [54.5, 13.2],
    zoom: 9,
    haefen: [
      { name: "Greifswald", lat: 54.096, lon: 13.408 },
      { name: "Stralsund", lat: 54.315, lon: 13.09 },
      { name: "Sassnitz", lat: 54.512, lon: 13.643 },
      { name: "Kap Arkona", lat: 54.679, lon: 13.432 },
      { name: "Klintholm Havn", lat: 54.952, lon: 12.464 },
    ],
  },
  {
    id: "kroatien-istrien",
    label: "Kroatien — Istrien (Pula)",
    center: [44.85, 13.8],
    zoom: 10,
    haefen: [
      { name: "Pula", lat: 44.873, lon: 13.842 },
      { name: "Rovinj", lat: 45.081, lon: 13.638 },
      { name: "Leuchtturm Porer", lat: 44.752, lon: 13.892 },
      { name: "Unije", lat: 44.638, lon: 14.258 },
    ],
  },
  {
    id: "kroatien-dalmatien",
    label: "Kroatien — Dalmatien (Split)",
    center: [43.3, 16.3],
    zoom: 9,
    haefen: [
      { name: "Split (ACI Marina)", lat: 43.503, lon: 16.43 },
      { name: "Milna (Brač)", lat: 43.327, lon: 16.452 },
      { name: "Vis", lat: 43.061, lon: 16.19 },
      { name: "Hvar", lat: 43.172, lon: 16.443 },
      { name: "Leuchtturm Stončica", lat: 43.062, lon: 16.265 },
    ],
  },
];

export function getRevier(id: string): Revier | undefined {
  return REVIERE.find((r) => r.id === id);
}
