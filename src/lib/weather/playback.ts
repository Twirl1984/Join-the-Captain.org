// playback.ts — Bootsposition zu einem Zeitpunkt entlang des gerechneten Plans.
//
// Reine Interpolation über die Legs (depart→eta je Leg, linear zwischen den
// Wegpunkten; Liegezeiten = Boot bleibt am Wegpunkt). Fürs Karten-Playback.

import type { Waypoint, RouteLeg } from "./route-forecast";

export interface BoatPos {
  lat: number;
  lon: number;
  /** Index des aktiven Legs (-1 = vor Abfahrt / nach Ankunft am Ziel = letztes). */
  legIndex: number;
}

/**
 * Position zum Zeitpunkt `atMs`. Vor der ersten Abfahrt: erster Wegpunkt;
 * während Leg i: linear zwischen waypoints[i] und waypoints[i+1];
 * zwischen Legs (Liegezeit): am Zwischen-Wegpunkt; nach der letzten ETA: Ziel.
 */
export function boatPositionAt(
  waypoints: Waypoint[],
  legs: RouteLeg[],
  atMs: number,
): BoatPos {
  if (!waypoints.length) throw new Error("Keine Wegpunkte.");
  if (!legs.length || atMs <= Date.parse(legs[0].depart)) {
    return { lat: waypoints[0].lat, lon: waypoints[0].lon, legIndex: -1 };
  }
  for (let i = 0; i < legs.length; i++) {
    const dep = Date.parse(legs[i].depart);
    const eta = Date.parse(legs[i].eta);
    if (atMs < dep) {
      // Liegezeit vor Leg i → Boot liegt am Start-Wegpunkt des Legs.
      return { lat: waypoints[i].lat, lon: waypoints[i].lon, legIndex: i };
    }
    if (atMs <= eta) {
      const f = eta > dep ? (atMs - dep) / (eta - dep) : 1;
      const a = waypoints[i];
      const b = waypoints[i + 1];
      return {
        lat: a.lat + (b.lat - a.lat) * f,
        lon: a.lon + (b.lon - a.lon) * f,
        legIndex: i,
      };
    }
  }
  const last = waypoints[waypoints.length - 1];
  return { lat: last.lat, lon: last.lon, legIndex: legs.length - 1 };
}
