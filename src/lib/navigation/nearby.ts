// nearby.ts — nächste Häfen zu einer Position (REQ-NAV-024, „Jetzt & hier").
// Reine Geometrie, kein I/O: Häfen werden injiziert (offline testbar).

import { haversineNm, initialBearing } from "../weather/route-forecast";
import { compassPoint } from "../weather/format";

export interface HarborPoint {
  name: string;
  lat: number;
  lon: number;
}

export interface NearbyHarbor extends HarborPoint {
  distance_nm: number;
  bearing_deg: number;
  kompass: string;
}

/** Die `n` nächsten Häfen zu `from`, aufsteigend nach Distanz. */
export function nearestHarbors(
  from: { lat: number; lon: number },
  haefen: readonly HarborPoint[],
  n = 3,
): NearbyHarbor[] {
  return haefen
    .map((h) => {
      const bearing = initialBearing(from, h);
      return {
        ...h,
        distance_nm: Math.round(haversineNm(from, h) * 10) / 10,
        bearing_deg: Math.round(bearing),
        kompass: compassPoint(bearing),
      };
    })
    .sort((a, b) => a.distance_nm - b.distance_nm)
    .slice(0, Math.max(0, n));
}
