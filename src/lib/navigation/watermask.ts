// watermask.ts — kompakte Wasser/Land-Bitmaske über einer Revier-bbox.
//
// Grundlage des Land-Vermeidungs-Routings (searoute.ts): ein Gitter aus
// rows x cols Zellen, Bit=1 heißt "Zellmitte ist Wasser". Erzeugt wird die
// Maske vom Generator-Script (GEBCO: Elevation <= 0 -> Wasser) und als
// base64-JSON eingecheckt. SICHERHEITSPRINZIP: alles außerhalb der bbox und
// alles Unbekannte gilt als Land — im Zweifel wird NICHT über eine Fläche
// geroutet, die wir nicht kennen.
//
// Zeilen laufen von Süd (row 0) nach Nord, Spalten von West (col 0) nach Ost.

export type { Bbox } from "./reviere";
import type { Bbox } from "./reviere";

export interface WaterMask {
  bbox: Bbox;
  rows: number;
  cols: number;
  /** Bit r*cols+c, LSB-first je Byte. 1 = Wasser. */
  bits: Uint8Array;
}

/** JSON-transportables Maskenformat (Datei/API). */
export interface EncodedMask {
  bbox: Bbox;
  rows: number;
  cols: number;
  data_b64: string;
}

export function createMask(
  bbox: Bbox,
  rows: number,
  cols: number,
  isWater: (lat: number, lon: number) => boolean,
): WaterMask {
  assertDims(bbox, rows, cols);
  const bits = new Uint8Array(Math.ceil((rows * cols) / 8));
  const mask: WaterMask = { bbox, rows, cols, bits };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { lat, lon } = cellCenter(mask, r, c);
      if (isWater(lat, lon)) {
        const i = r * cols + c;
        bits[i >> 3] |= 1 << (i & 7);
      }
    }
  }
  return mask;
}

/** Wasser an (lat, lon)? Außerhalb der bbox immer false (= Land). */
export function isWaterAt(mask: WaterMask, lat: number, lon: number): boolean {
  const cell = cellOf(mask, lat, lon);
  if (!cell) return false;
  return cellIsWater(mask, cell.row, cell.col);
}

export function cellIsWater(mask: WaterMask, row: number, col: number): boolean {
  if (row < 0 || row >= mask.rows || col < 0 || col >= mask.cols) return false;
  const i = row * mask.cols + col;
  return (mask.bits[i >> 3] & (1 << (i & 7))) !== 0;
}

/** Gitterzelle zu (lat, lon), null außerhalb der bbox (Ränder inklusive). */
export function cellOf(mask: WaterMask, lat: number, lon: number): { row: number; col: number } | null {
  const [s, w, n, e] = mask.bbox;
  if (lat < s || lat > n || lon < w || lon > e) return null;
  const row = Math.min(mask.rows - 1, Math.floor(((lat - s) / (n - s)) * mask.rows));
  const col = Math.min(mask.cols - 1, Math.floor(((lon - w) / (e - w)) * mask.cols));
  return { row, col };
}

/** Zellmitte (lat, lon) der Zelle (row, col). */
export function cellCenter(mask: WaterMask, row: number, col: number): { lat: number; lon: number } {
  const [s, w, n, e] = mask.bbox;
  return {
    lat: s + ((row + 0.5) / mask.rows) * (n - s),
    lon: w + ((col + 0.5) / mask.cols) * (e - w),
  };
}

/**
 * Nächste Wasserzelle um (lat, lon) in wachsenden Ringen bis maxRinge.
 * Für Häfen/Wegpunkte, die knapp "an Land" liegen (Mole, Kaimauer).
 * Innerhalb eines Rings gewinnt die Zelle mit der KLEINSTEN echten Distanz —
 * die erste Zelle in Scan-Reihenfolge konnte sonst auf die falsche Seite
 * einer Landzunge springen (Review-Finding #11).
 */
export function nearestWaterCell(
  mask: WaterMask,
  lat: number,
  lon: number,
  maxRinge: number,
): { row: number; col: number } | null {
  const start = cellOf(mask, lat, lon);
  if (!start) return null;
  if (cellIsWater(mask, start.row, start.col)) return start;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (let ring = 1; ring <= maxRinge; ring++) {
    let best: { row: number; col: number } | null = null;
    let bestD = Infinity;
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue; // nur Ringrand
        const r = start.row + dr;
        const c = start.col + dc;
        if (!cellIsWater(mask, r, c)) continue;
        const ctr = cellCenter(mask, r, c);
        const d = Math.hypot(ctr.lat - lat, (ctr.lon - lon) * cosLat);
        if (d < bestD) {
          bestD = d;
          best = { row: r, col: c };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

export function encodeMask(mask: WaterMask): EncodedMask {
  return {
    bbox: mask.bbox,
    rows: mask.rows,
    cols: mask.cols,
    data_b64: Buffer.from(mask.bits).toString("base64"),
  };
}

export function decodeMask(enc: EncodedMask): WaterMask {
  assertDims(enc.bbox, enc.rows, enc.cols);
  const bits = new Uint8Array(Buffer.from(enc.data_b64 ?? "", "base64"));
  const needed = Math.ceil((enc.rows * enc.cols) / 8);
  if (bits.length < needed) {
    throw new Error(`Maske zu kurz: ${bits.length} Bytes, benötigt ${needed}.`);
  }
  return { bbox: enc.bbox, rows: enc.rows, cols: enc.cols, bits };
}

function assertDims(bbox: Bbox, rows: number, cols: number): void {
  const [s, w, n, e] = bbox;
  if (!(s < n && w < e)) throw new Error(`Ungültige bbox [${bbox.join(", ")}].`);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    throw new Error(`Ungültige Maskengröße ${rows}x${cols}.`);
  }
  if (rows * cols > 4_000_000) throw new Error(`Maske ${rows}x${cols} zu groß.`);
}
