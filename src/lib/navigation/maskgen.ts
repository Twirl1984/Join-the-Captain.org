// maskgen.ts — Wassermaske aus Land-Polygonen (Scanline, even-odd).
//
// Reine Geometrie ohne I/O: bekommt die Landpolygone (GeoJSON-Ringe) und die
// Revier-bbox, liefert die Bitmaske. Wird vom CLI-Script
// scripts/navigation-fetch-watermask.ts mit den OSM-Küstenlinien gefüttert
// und ist hier separat unit-testbar (inkl. des Kachelgrenzen-Artefakts, das
// der Datenqualitäts-Test aufgedeckt hat).

import type { Bbox } from "./reviere";
import type { WaterMask } from "./watermask";

/** GeoJSON-Ring: [lon, lat]-Paare. */
export type Ring = Array<[number, number]>;

/** Ziel-Zellweite ~0.7 km; Deckel gegen Riesenmasken. */
const TARGET_CELL_KM = 0.7;
const MAX_CELLS = 1_200_000;

/**
 * EPSILON-Versatz: Die OSM-Kacheln haben Grenzen auf runden Breitengraden
 * (z. B. 43.2°). Fällt eine Scanline EXAKT auf so eine horizontale Kante,
 * ist die Parität undefiniert -> Land-Streifen quer durchs offene Meer.
 * ~1 cm Versatz schiebt die Linie von allen Datenkanten herunter.
 */
const EPS = 1e-7;

/** Gittergröße fürs Revier (Zellen ~TARGET_CELL_KM, quadratisch in km). */
export function gridSize(bbox: Bbox): { rows: number; cols: number } {
  const [s, w, n, e] = bbox;
  const midLatRad = (((s + n) / 2) * Math.PI) / 180;
  const kmPerDegLon = 111.32 * Math.cos(midLatRad);
  let cols = Math.max(40, Math.round(((e - w) * kmPerDegLon) / TARGET_CELL_KM));
  let rows = Math.max(40, Math.round(((n - s) * 111.32) / TARGET_CELL_KM));
  while (rows * cols > MAX_CELLS) {
    rows = Math.round(rows / 1.5);
    cols = Math.round(cols / 1.5);
  }
  return { rows, cols };
}

/** Maske über bbox: Wasser = außerhalb aller Landringe (even-odd). */
export function buildMaskFromLand(bbox: Bbox, landRings: Ring[], size?: { rows: number; cols: number }): WaterMask {
  const [s, w, n, e] = bbox;
  const { rows, cols } = size ?? gridSize(bbox);

  // Nur Ringe mit bbox-Überlappung betrachten (plus Rand von einer Zelle).
  // Parität bleibt korrekt: ein komplett entfernter geschlossener Ring nimmt
  // auf jeder Scanline eine GERADE Zahl von Kreuzungen mit.
  const padLat = (n - s) / rows;
  const padLon = (e - w) / cols;
  const rings: Ring[] = [];
  for (const ring of landRings) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const [lon, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    if (maxLat < s - padLat || minLat > n + padLat || maxLon < w - padLon || minLon > e + padLon)
      continue;
    rings.push(ring);
  }

  // Scanline: je Zeile die Längengrade sammeln, an denen eine Kante die
  // Zeilen-Breite kreuzt (halb-offene Regel gegen Doppelzählung an Ecken).
  const crossings: number[][] = Array.from({ length: rows }, () => []);
  const rowLat = (r: number) => s + ((r + 0.5) / rows) * (n - s) + EPS;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[(i + 1) % ring.length];
      if (lat1 === lat2) continue;
      const lo = Math.min(lat1, lat2);
      const hi = Math.max(lat1, lat2);
      for (let r = 0; r < rows; r++) {
        const y = rowLat(r);
        if (y < lo || y >= hi) continue;
        const t = (y - lat1) / (lat2 - lat1);
        crossings[r].push(lon1 + t * (lon2 - lon1));
      }
    }
  }

  const bits = new Uint8Array(Math.ceil((rows * cols) / 8));
  for (let r = 0; r < rows; r++) {
    const xs = crossings[r].sort((a, b) => a - b);
    for (let c = 0; c < cols; c++) {
      const lon = w + ((c + 0.5) / cols) * (e - w) + EPS;
      // Anzahl Kreuzungen links vom Punkt: ungerade -> im Landpolygon.
      let lo = 0;
      let hi = xs.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (xs[mid] < lon) lo = mid + 1;
        else hi = mid;
      }
      const isLand = (lo & 1) === 1;
      if (!isLand) {
        const i = r * cols + c;
        bits[i >> 3] |= 1 << (i & 7);
      }
    }
  }
  return { bbox, rows, cols, bits };
}
