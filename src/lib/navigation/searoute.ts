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

/**
 * Kostenmodell für profil-abhängiges Routing (REQ-NAV-019). edgeCost liefert
 * die Kosten einer Kante (z. B. Stunden); für eine ZULÄSSIGE A*-Heuristik muss
 * stets gelten: edgeCost(a,b,dist) >= dist / heuristicSpeedNmPerCost.
 */
export interface RouteCosts {
  edgeCost: (a: LatLon, b: LatLon, distNm: number) => number;
  heuristicSpeedNmPerCost: number;
}

export interface SeaRouteResult {
  status: "ok" | "unreachable" | "outside";
  /** Route inkl. Original-Start und -Ziel (bei "ok"). */
  points: LatLon[];
  distance_nm?: number;
}

// Snap-Toleranz für Start/Ziel an der Wasserkante: PHYSISCH ~1.5 km, nicht in
// Zellen — bei feinen Binnensee-Gittern (Zelle ~200 m) wären 3 Zellen nur 600 m
// und reale Häfen neben dem groben 1-km-Seepolygon fielen durch (Fund: Ramsberg).
const SNAP_METER = 1500;

/** Ringzahl, die SNAP_METER bei dieser Maske entspricht (min 3, max 12). */
function snapRinge(mask: WaterMask): number {
  const [s, w, n, e] = mask.bbox;
  const latM = ((n - s) / mask.rows) * 111_320;
  const lonM = ((e - w) / mask.cols) * 111_320 * Math.cos((((s + n) / 2) * Math.PI) / 180);
  const cellM = Math.min(latM, lonM);
  return Math.max(3, Math.min(12, Math.ceil(SNAP_METER / Math.max(1, cellM))));
}

/**
 * Kürzester Wasserweg von `from` nach `to` über der Maske.
 * Liefert "outside" (Punkt außerhalb der bbox), "unreachable" (kein Wasserweg)
 * oder "ok" mit geglätteter Punktfolge inkl. der Originalendpunkte.
 */
export function findSeaRoute(
  mask: WaterMask,
  from: LatLon,
  to: LatLon,
  costs?: RouteCosts,
): SeaRouteResult {
  const fromCell = cellOf(mask, from.lat, from.lon);
  const toCell = cellOf(mask, to.lat, to.lon);
  if (!fromCell || !toCell) return { status: "outside", points: [] };

  if (from.lat === to.lat && from.lon === to.lon) {
    return { status: "ok", points: [from], distance_nm: 0 };
  }

  const ringe = snapRinge(mask);
  const start = nearestWaterCell(mask, from.lat, from.lon, ringe);
  const goal = nearestWaterCell(mask, to.lat, to.lon, ringe);
  if (!start || !goal) return { status: "unreachable", points: [] };

  const cellPath = aStar(mask, start, goal, costs);
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

  const smooth = lineOfSightSimplify(mask, pts, costs);
  let dist = 0;
  for (let i = 0; i < smooth.length - 1; i++) dist += haversineNm(smooth[i], smooth[i + 1]);
  return { status: "ok", points: smooth, distance_nm: Math.round(dist * 10) / 10 };
}

/**
 * true, wenn die Strecke a->b durchgehend über Wasser führt.
 *
 * Exakter Gitter-Traversal (Amanatides-Woo-Supercover) statt punktweiser
 * Abtastung: JEDE vom Segment berührte Zelle wird geprüft. Punktweises
 * Sampling hatte Landecken mit kurzer Sehne übersehen (Adversarial-Review-
 * Repro, Regressionstests in searoute.test.ts). Exakte Eck-Durchgänge werden
 * konservativ behandelt: beide angrenzenden Zellen müssen Wasser sein
 * (gleiche Regel wie der Diagonalschutz im A*).
 */
export function segmentInWater(mask: WaterMask, a: LatLon, b: LatLon): boolean {
  if (!isWaterAt(mask, a.lat, a.lon) || !isWaterAt(mask, b.lat, b.lon)) return false;

  // Kontinuierliche Gitterkoordinaten: x über Spalten (Lon), y über Zeilen (Lat).
  const [s, w, n, e] = mask.bbox;
  const gx = (lon: number) => ((lon - w) / (e - w)) * mask.cols;
  const gy = (lat: number) => ((lat - s) / (n - s)) * mask.rows;
  const x0 = gx(a.lon);
  const y0 = gy(a.lat);
  const x1 = gx(b.lon);
  const y1 = gy(b.lat);

  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;

  // Startzelle (Punkte exakt auf der bbox-Kante in die Maske clampen).
  let cx = Math.min(mask.cols - 1, Math.max(0, Math.floor(x0)));
  let cy = Math.min(mask.rows - 1, Math.max(0, Math.floor(y0)));
  const endX = Math.min(mask.cols - 1, Math.max(0, Math.floor(x1)));
  const endY = Math.min(mask.rows - 1, Math.max(0, Math.floor(y1)));

  // t bis zur nächsten vertikalen/horizontalen Gitterlinie (Parameter 0..1).
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX =
    dx !== 0 ? (dx > 0 ? (cx + 1 - x0) / dx : (cx - x0) / dx) : Infinity;
  let tMaxY =
    dy !== 0 ? (dy > 0 ? (cy + 1 - y0) / dy : (cy - y0) / dy) : Infinity;

  if (!cellIsWater(mask, cy, cx)) return false;

  // Schleife strikt begrenzt — mehr Schritte als Zellen im Umriss gibt es nicht.
  const maxSteps = mask.cols + mask.rows + 4;
  for (let i = 0; i < maxSteps; i++) {
    if (cx === endX && cy === endY) return true;
    if (Math.abs(tMaxX - tMaxY) < 1e-12 && tMaxX <= 1 + 1e-12) {
      // Exakter Eck-Durchgang: konservativ beide Nachbarzellen fordern.
      if (!cellIsWater(mask, cy, cx + stepX) || !cellIsWater(mask, cy + stepY, cx)) return false;
      cx += stepX;
      cy += stepY;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    } else if (tMaxX < tMaxY) {
      if (tMaxX > 1 + 1e-12) return true; // Segmentende vor der nächsten Linie
      cx += stepX;
      tMaxX += tDeltaX;
    } else {
      if (tMaxY > 1 + 1e-12) return true;
      cy += stepY;
      tMaxY += tDeltaY;
    }
    if (!cellIsWater(mask, cy, cx)) return false;
  }
  return cx === endX && cy === endY;
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
  costs?: RouteCosts,
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
  const hSpeed = costs?.heuristicSpeedNmPerCost ?? 1;
  const h = (i: number) => cellDistNm(mask, i, goalI) / hSpeed;
  heap.push(h(startI), startI);

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
        const dNm = cellDistNm(mask, cur, ni);
        const step = costs
          ? costs.edgeCost(cellCenter(mask, r, c), cellCenter(mask, nr, nc), dNm)
          : dNm;
        const tentative = g[cur] + step;
        if (tentative < g[ni]) {
          g[ni] = tentative;
          cameFrom[ni] = cur;
          heap.push(tentative + h(ni), ni);
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
function lineOfSightSimplify(mask: WaterMask, pts: LatLon[], costs?: RouteCosts): LatLon[] {
  if (pts.length <= 2) return pts;
  // Bei Wetterkosten darf die Glättung keine teuren Gebiete "abkürzen":
  // ein Sprung ist nur erlaubt, wenn er nicht teurer ist als die Teilstücke.
  const prefix: number[] = [0];
  if (costs) {
    for (let k = 0; k < pts.length - 1; k++) {
      prefix.push(prefix[k] + costs.edgeCost(pts[k], pts[k + 1], haversineNm(pts[k], pts[k + 1])));
    }
  }
  const jumpOk = (i: number, j: number): boolean => {
    if (!segmentInWater(mask, pts[i], pts[j])) return false;
    if (!costs) return true;
    const direct = costs.edgeCost(pts[i], pts[j], haversineNm(pts[i], pts[j]));
    return direct <= (prefix[j] - prefix[i]) * 1.001 + 1e-9;
  };
  const out: LatLon[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !jumpOk(i, j)) j--;
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
