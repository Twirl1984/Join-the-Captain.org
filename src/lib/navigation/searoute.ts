// searoute.ts — Land-Vermeidungs-Routing: A* über der Wassermaske.
//
// Zwischen zwei Wegpunkten wird der kürzeste WASSERWEG gesucht (8er-
// Nachbarschaft auf dem Maskengitter), danach per Sichtlinien-Glättung auf
// wenige Zwischenpunkte reduziert — die Glättung prüft jedes Teilstück gegen
// die Maske und schneidet daher nie eine Landzunge ab.
//
// Häfen liegen oft "auf" der Land-Zellkante (Mole/Kaimauer): Start/Ziel werden
// deshalb in einem kleinen Radius auf die nächste Wasserzelle gesnappt. Tief
// im Landesinneren wird NICHT gesnappt -> "unreachable" statt Fantasieroute.
//
// Reine Logik ohne I/O: Maske wird injiziert -> offline testbar (TDD).

import {
  type WaterMask,
  cellCenter,
  cellIsWater,
  cellOf,
  isWaterAt,
  nearestWaterCell,
} from "./watermask";
import { haversineNm } from "../weather/route-forecast";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface SeaRouteResult {
  status: "ok" | "unreachable" | "outside";
  /** Route inkl. Original-Start und -Ziel (bei "ok"). */
  points: LatLon[];
  distance_nm?: number;
}

/** Snap-Radius in Zellen für Start/Ziel an der Wasserkante. */
const SNAP_RINGE = 3;

/**
 * Kürzester Wasserweg von `from` nach `to` über der Maske.
 * Liefert "outside" (Punkt außerhalb der bbox), "unreachable" (kein Wasserweg)
 * oder "ok" mit geglätteter Punktfolge inkl. der Originalendpunkte.
 */
export function findSeaRoute(mask: WaterMask, from: LatLon, to: LatLon): SeaRouteResult {
  const fromCell = cellOf(mask, from.lat, from.lon);
  const toCell = cellOf(mask, to.lat, to.lon);
  if (!fromCell || !toCell) return { status: "outside", points: [] };

  if (from.lat === to.lat && from.lon === to.lon) {
    return { status: "ok", points: [from], distance_nm: 0 };
  }

  const start = nearestWaterCell(mask, from.lat, from.lon, SNAP_RINGE);
  const goal = nearestWaterCell(mask, to.lat, to.lon, SNAP_RINGE);
  if (!start || !goal) return { status: "unreachable", points: [] };

  const cellPath = aStar(mask, start, goal);
  if (!cellPath) return { status: "unreachable", points: [] };

  // Zellpfad -> Koordinaten; exakte Endpunkte ersetzen die Randzellen, wenn
  // sie selbst im Wasser liegen (sonst bleibt die gesnappte Zellmitte davor).
  const raw: LatLon[] = cellPath.map(([r, c]) => cellCenter(mask, r, c));
  const pts: LatLon[] = [];
  if (isWaterAt(mask, from.lat, from.lon)) raw[0] = from;
  else pts.push(from);
  if (isWaterAt(mask, to.lat, to.lon)) raw[raw.length - 1] = to;
  pts.push(...raw);
  if (pts[pts.length - 1] !== to) pts.push(to);

  const smooth = lineOfSightSimplify(mask, pts);
  let dist = 0;
  for (let i = 0; i < smooth.length - 1; i++) dist += haversineNm(smooth[i], smooth[i + 1]);
  return { status: "ok", points: smooth, distance_nm: Math.round(dist * 10) / 10 };
}

/**
 * true, wenn die Strecke a->b durchgehend über Wasser führt. Abtastung in
 * halber Zellweite; Endpunkte müssen selbst Wasser sein.
 */
export function segmentInWater(mask: WaterMask, a: LatLon, b: LatLon): boolean {
  if (!isWaterAt(mask, a.lat, a.lon) || !isWaterAt(mask, b.lat, b.lon)) return false;
  const [s, w, n, e] = mask.bbox;
  const stepLat = (n - s) / mask.rows / 2;
  const stepLon = (e - w) / mask.cols / 2;
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(b.lat - a.lat) / stepLat, Math.abs(b.lon - a.lon) / stepLon)),
  );
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isWaterAt(mask, a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t)) return false;
  }
  return true;
}

// ── A* auf dem Gitter ────────────────────────────────────────────────────────

/** Distanz zweier Zellen in sm (äquirektangular — fürs Gitter genau genug). */
function cellDistNm(mask: WaterMask, a: number, b: number): number {
  const ar = Math.floor(a / mask.cols);
  const ac = a % mask.cols;
  const br = Math.floor(b / mask.cols);
  const bc = b % mask.cols;
  const pa = cellCenter(mask, ar, ac);
  const pb = cellCenter(mask, br, bc);
  const midLat = ((pa.lat + pb.lat) / 2) * (Math.PI / 180);
  const dLat = (pb.lat - pa.lat) * 60;
  const dLon = (pb.lon - pa.lon) * 60 * Math.cos(midLat);
  return Math.hypot(dLat, dLon);
}

function aStar(
  mask: WaterMask,
  start: { row: number; col: number },
  goal: { row: number; col: number },
): Array<[number, number]> | null {
  const { rows, cols } = mask;
  const nCells = rows * cols;
  const startI = start.row * cols + start.col;
  const goalI = goal.row * cols + goal.col;

  const g = new Float64Array(nCells).fill(Infinity);
  const cameFrom = new Int32Array(nCells).fill(-1);
  const closed = new Uint8Array(nCells);
  g[startI] = 0;

  const heap = new MinHeap();
  heap.push(cellDistNm(mask, startI, goalI), startI);

  while (heap.size > 0) {
    const cur = heap.pop();
    if (cur === goalI) break;
    if (closed[cur]) continue;
    closed[cur] = 1;

    const r = Math.floor(cur / cols);
    const c = cur % cols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (!cellIsWater(mask, nr, nc)) continue;
        // Diagonale nur, wenn beide Kanten-Nachbarn Wasser sind — sonst
        // "schlüpft" die Route diagonal durch eine Landecke.
        if (dr !== 0 && dc !== 0 && !(cellIsWater(mask, r, nc) && cellIsWater(mask, nr, c))) continue;
        const ni = nr * cols + nc;
        if (closed[ni]) continue;
        const tentative = g[cur] + cellDistNm(mask, cur, ni);
        if (tentative < g[ni]) {
          g[ni] = tentative;
          cameFrom[ni] = cur;
          heap.push(tentative + cellDistNm(mask, ni, goalI), ni);
        }
      }
    }
  }

  if (!Number.isFinite(g[goalI])) return null;
  const path: Array<[number, number]> = [];
  for (let i = goalI; i !== -1; i = cameFrom[i]) {
    path.push([Math.floor(i / cols), i % cols]);
    if (i === startI) break;
  }
  path.reverse();
  return path;
}

/**
 * Greedy-Sichtlinien-Vereinfachung: von jedem Punkt so weit wie möglich nach
 * vorn springen, solange das Teilstück komplett im Wasser liegt. Liegt ein
 * Endpunkt an Land (Hafen), wird mindestens zum Folgepunkt weitergegangen.
 */
function lineOfSightSimplify(mask: WaterMask, pts: LatLon[]): LatLon[] {
  if (pts.length <= 2) return pts;
  const out: LatLon[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !segmentInWater(mask, pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/** Kleiner binärer Min-Heap (f-Wert, Zellindex) für A*. */
class MinHeap {
  private f: number[] = [];
  private v: number[] = [];
  get size(): number {
    return this.f.length;
  }
  push(f: number, val: number): void {
    this.f.push(f);
    this.v.push(val);
    let i = this.f.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p] <= this.f[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.v[0];
    const lastF = this.f.pop()!;
    const lastV = this.v.pop()!;
    if (this.f.length > 0) {
      this.f[0] = lastF;
      this.v[0] = lastV;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.f.length && this.f[l] < this.f[m]) m = l;
        if (r < this.f.length && this.f[r] < this.f[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.f[a], this.f[b]] = [this.f[b], this.f[a]];
    [this.v[a], this.v[b]] = [this.v[b], this.v[a]];
  }
}
