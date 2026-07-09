// route-helpers.ts — Wegpunkt-Expansion über Wasser für die Navigations-API.
//
// Nimmt die vom Nutzer geklickten Wegpunkte und ersetzt jede Teilstrecke durch
// den Wasserweg aus searoute.ts (A* + Glättung). Namen und Liegezeiten bleiben
// an den ORIGINAL-Wegpunkten; eingefügte Zwischenpunkte sind anonym.
//
// Ehrlichkeitsprinzip: Ohne Maske (Binnensee) oder außerhalb der Maske wird
// die Luftlinie verwendet und das Segment als "luftlinie" markiert — die UI
// zeigt den Unterschied. Unerreichbare Ziele sind ein harter Fehler (422),
// keine stille Luftlinie durch Land.

import type { Waypoint } from "../weather/route-forecast";
import type { WaterMask } from "./watermask";
import { findSeaRoute, segmentInWater, type LatLon } from "./searoute";

export type SegmentRouting = "wasserweg" | "luftlinie";

export interface RouteSegmentInfo {
  /** Index des Segment-Starts in der expandierten Punktliste. */
  from: number;
  /** Index des Segment-Endes in der expandierten Punktliste. */
  to: number;
  routing: SegmentRouting;
}

export interface ExpandResult {
  status: "ok" | "unreachable";
  points: Waypoint[];
  segments: RouteSegmentInfo[];
  /** Bei "unreachable": Index der Teilstrecke (0-basiert) ohne Wasserweg. */
  failedSegment?: number;
}

export interface ExpandOpts {
  /** Deckel für Zwischenpunkte je Teilstrecke (inkl. Endpunkt), Default 12. */
  maxPointsPerSegment?: number;
}

export function expandWaypointsOverWater(
  mask: WaterMask | null,
  waypoints: Waypoint[],
  opts: ExpandOpts = {},
): ExpandResult {
  const maxPer = Math.max(2, opts.maxPointsPerSegment ?? 12);
  const points: Waypoint[] = [waypoints[0]];
  const segments: RouteSegmentInfo[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const segStart = points.length - 1;

    let routing: SegmentRouting = "luftlinie";
    let inner: Waypoint[] = [];

    if (mask) {
      const sea = findSeaRoute(mask, { lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon });
      if (sea.status === "ok") {
        routing = "wasserweg";
        // Nur die ZWISCHENpunkte übernehmen — Endpunkte bleiben die Originale
        // (inkl. Name/Liegezeit). Ausdünnen ist WASSER-SICHER: ein Punkt fällt
        // nur weg, wenn das entstehende Segment komplett im Wasser bleibt —
        // der Deckel ist weich, die Wasser-Garantie hart (Review-Finding #1).
        inner = thinWaterSafe(mask, sea.points, maxPer - 2).map((p) => ({
          lat: p.lat,
          lon: p.lon,
        }));
      } else if (sea.status === "unreachable") {
        return { status: "unreachable", points: [], segments: [], failedSegment: i };
      }
      // "outside": Wegpunkt liegt außerhalb der Revier-Maske -> Luftlinie.
    }

    points.push(...inner, to);
    segments.push({ from: segStart, to: points.length - 1, routing });
  }

  return { status: "ok", points, segments };
}

/**
 * Wasser-sicheres Ausdünnen der ZWISCHENpunkte einer Wasserroute.
 * `full` ist der komplette Pfad inkl. Endpunkten (deren Segmente zu den
 * Nachbarn müssen bei Entnahme mitgeprüft werden); zurück kommen nur die
 * inneren Punkte. Greedy: entferne wiederholt einen Punkt, dessen Wegfall das
 * verbindende Segment im Wasser lässt — bis der Deckel erreicht ist oder kein
 * Punkt mehr sicher entfernbar ist (dann gewinnt die Sicherheit, nicht der
 * Deckel).
 */
function thinWaterSafe(mask: WaterMask, full: LatLon[], maxInner: number): LatLon[] {
  const cap = Math.max(0, maxInner);
  const pts = full.slice();
  let removable = true;
  while (pts.length - 2 > cap && removable) {
    removable = false;
    for (let i = 1; i < pts.length - 1; i++) {
      if (segmentInWater(mask, pts[i - 1], pts[i + 1])) {
        pts.splice(i, 1);
        removable = true;
        if (pts.length - 2 <= cap) break;
      }
    }
  }
  return pts.slice(1, -1);
}

/** Gleichmäßiges Ausdünnen auf höchstens `max` Punkte (Reihenfolge bleibt). */
export function thin<T>(arr: T[], max: number): T[] {
  if (max <= 0) return [];
  if (arr.length <= max) return arr;
  const out: T[] = [];
  for (let k = 0; k < max; k++) {
    out.push(arr[Math.round(((k + 1) * (arr.length - 1)) / (max + 1))]);
  }
  return out;
}
