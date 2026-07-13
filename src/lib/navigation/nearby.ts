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

// ── Positionsbasierte Revier-/Hafensuche (REQ-NAV-024) ──────────────────────
// „Jetzt & hier" darf nicht an das AUSGEWÄHLTE Revier gebunden sein — auf einer
// freien Weltkarte zählt, wo man WIRKLICH ist (Fund: in Nürnberg wurden
// Nordsee-Häfen gezeigt). Diese Helfer arbeiten über ALLE Reviere.

interface RevierLike {
  id: string;
  label: string;
  center: [number, number];
  haefen: readonly HarborPoint[];
}

export interface NearbyRevier {
  id: string;
  label: string;
  distance_nm: number;
}

/** Das Revier, dessen Zentrum der Position am nächsten liegt. */
export function nearestRevier(
  from: { lat: number; lon: number },
  reviere: readonly RevierLike[],
): NearbyRevier | null {
  let best: NearbyRevier | null = null;
  for (const r of reviere) {
    const d = haversineNm(from, { lat: r.center[0], lon: r.center[1] });
    if (!best || d < best.distance_nm) {
      best = { id: r.id, label: r.label, distance_nm: Math.round(d * 10) / 10 };
    }
  }
  return best;
}

export interface NearbyHarborGlobal extends NearbyHarbor {
  /** Label des Reviers, zu dem der Hafen gehört (fürs Anzeigen). */
  revier: string;
}

/** Die `n` nächsten Häfen ÜBER ALLE REVIERE zur Position. */
export function nearestHarborsGlobal(
  from: { lat: number; lon: number },
  reviere: readonly RevierLike[],
  n = 3,
): NearbyHarborGlobal[] {
  const alle: NearbyHarborGlobal[] = [];
  for (const r of reviere) {
    for (const h of nearestHarbors(from, r.haefen, r.haefen.length)) {
      alle.push({ ...h, revier: r.label });
    }
  }
  return alle.sort((a, b) => a.distance_nm - b.distance_nm).slice(0, Math.max(0, n));
}
