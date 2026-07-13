// peilung.ts — Handy-Kreuzpeilung als GPS-Backup (REQ-NAV-025/026).
//
// Klassische terrestrische Navigation: markante, KARTIERTE Objekte (Leuchttürme,
// Häfen, Kaps) anpeilen, aus zwei/drei Peilungen den Standort schneiden. Nützlich,
// wenn GPS unplausibel ist (real erlebt: GPS-Sprünge vor fremden Küsten).
//
// Reine Geometrie ohne I/O (offline testbar). Kompass-Missweisung wird
// rechtweisend korrigiert; die UI weist Kompass-Fehlerband + Missweisung aus.
//
// Näherung: lokales äquirektangulares Bezugssystem um den ersten Referenzpunkt.
// Für Küstenpeilungen über wenige Seemeilen genau genug — KEIN Ersatz für den
// Handpeilkompass und amtliche Seekarten (Safety-Wording gehört in die UI).

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Magnetische Peilung → rechtweisend. `declinationEastDeg` ist die Missweisung
 * (Ost positiv): rechtweisend = magnetisch + Missweisung(Ost). Ergebnis 0..360.
 */
export function magneticToTrue(magneticDeg: number, declinationEastDeg: number): number {
  return ((((magneticDeg + declinationEastDeg) % 360) + 360) % 360);
}

/** Eine Peilung auf ein kartiertes Objekt (rechtweisend, vom Beobachter zum Objekt). */
export interface Bearing {
  ref: LatLon;
  /** rechtweisende Peilung Beobachter→Objekt in Grad (0..360). */
  trueBearingDeg: number;
}

export interface BearingFix {
  lat: number;
  lon: number;
  /** Größe des Fehlerdreiecks (max. Abstand der paarweisen Schnitte, sm). 0 bei 2 Peilungen. */
  error_nm: number;
  /** Anzahl der genutzten Peilungen. */
  n: number;
}

/** Lokales Bezugssystem: Punkt → (Ost, Nord) in sm relativ zu `origin`. */
function toLocal(p: LatLon, origin: LatLon): { x: number; y: number } {
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  return { x: (p.lon - origin.lon) * 60 * cosLat, y: (p.lat - origin.lat) * 60 };
}
function fromLocal(x: number, y: number, origin: LatLon): LatLon {
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  return { lat: origin.lat + y / 60, lon: origin.lon + x / (60 * cosLat) };
}

/**
 * Schnittpunkt zweier Standlinien. Der Beobachter sieht `ref` unter der Peilung
 * B, liegt also von `ref` aus in Richtung der Rückpeilung (B+180). Rückgabe im
 * lokalen (x,y)-System oder null bei (nahezu) parallelen Linien.
 */
function intersect(
  a: { p: { x: number; y: number }; az: number },
  b: { p: { x: number; y: number }; az: number },
): { x: number; y: number } | null {
  // Richtungsvektor einer Azimut-Linie: (Ost=sin, Nord=cos).
  const ax = Math.sin((a.az * Math.PI) / 180);
  const ay = Math.cos((a.az * Math.PI) / 180);
  const bx = Math.sin((b.az * Math.PI) / 180);
  const by = Math.cos((b.az * Math.PI) / 180);
  const det = ax * -by - ay * -bx;
  if (Math.abs(det) < 1e-9) return null; // parallel
  const dx = b.p.x - a.p.x;
  const dy = b.p.y - a.p.y;
  const t = (dx * -by - dy * -bx) / det;
  return { x: a.p.x + t * ax, y: a.p.y + t * ay };
}

/**
 * Kreuzpeilungs-Standort aus 2–3 Peilungen. Bei 2 Peilungen: der Schnittpunkt.
 * Bei 3: Schwerpunkt der drei paarweisen Schnitte + Fehlerdreieck-Radius.
 * null, wenn keine gültigen Schnitte existieren (parallele Peilungen).
 */
export function crossBearingFix(bearings: Bearing[]): BearingFix | null {
  const bs = bearings.filter((b) => Number.isFinite(b.trueBearingDeg));
  if (bs.length < 2) return null;
  const origin = bs[0].ref;
  const lines = bs.map((b) => ({ p: toLocal(b.ref, origin), az: b.trueBearingDeg + 180 }));

  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const s = intersect(lines[i], lines[j]);
      if (s) pts.push(s);
    }
  }
  if (!pts.length) return null;

  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const error = pts.reduce((m, p) => Math.max(m, Math.hypot(p.x - cx, p.y - cy)), 0);
  const { lat, lon } = fromLocal(cx, cy, origin);
  return { lat, lon, error_nm: Math.round(error * 100) / 100, n: bs.length };
}

/** Großkreis-Abstand zweier Punkte in sm (für den GPS-Abgleich). */
export function distanceNm(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * GPS-Plausibilität (REQ-NAV-026): weicht der GPS-Fix weiter vom Peilungs-Fix
 * ab als die kombinierte Unsicherheit, ist Vorsicht geboten.
 */
export function gpsPlausibility(
  gps: LatLon,
  fix: BearingFix,
  gpsAccuracyNm: number,
): { deviation_nm: number; plausibel: boolean } {
  const deviation = distanceNm(gps, fix);
  // Toleranz: GPS-Genauigkeit + Fehlerdreieck + fester Peil-Puffer (Kompass ±10°).
  const toleranz = gpsAccuracyNm + fix.error_nm + 0.5;
  return { deviation_nm: Math.round(deviation * 100) / 100, plausibel: deviation <= toleranz };
}

/**
 * GROBE Missweisung (Ost, Grad) je Revier — Näherung nach WMM ~2025. Bewusst
 * konservativ und editierbar in der UI: amtliche Seekarten drucken die lokale
 * Missweisung, die hier nur vorbelegt wird. Unbekannt → 3° (mitteleuropäisch).
 */
export function missweisungForRevier(revierId: string): number {
  const tabelle: Record<string, number> = {
    "deutsche-bucht": 3,
    nordfriesland: 3,
    ostsee: 6,
    ruegen: 6,
    "kieler-bucht": 4,
    "daenische-suedsee": 4,
    "kroatien-istrien": 4,
    "kroatien-dalmatien": 5,
    balearen: 1,
    "griechenland-saronisch": 5,
    brombachsee: 3,
    ijsselmeer: 2,
  };
  return tabelle[revierId] ?? 3;
}
