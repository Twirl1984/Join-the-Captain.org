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

/** Typische Kompass-Unsicherheit eines Handys (Grad, 1σ). */
export const KOMPASS_SIGMA_DEG = 8;

/**
 * Orts-Unsicherheit des Peilungs-Fixes (sm) — sie SKALIERT mit der Entfernung
 * zu den angepeilten Objekten und mit dem Schnittwinkel:
 *   quer zur Peillinie:  d · tan(σ)      (nahes Objekt → kleiner Fehler)
 *   schlechter Schnitt:  / sin(Schnittwinkel)  (spitzer Schnitt → Fehler wächst)
 * Genommen wird das BESTE Peilungs-Paar (konservativ im Sinne der Warnung:
 * eine zu große Toleranz würde echte GPS-Fehler verschlucken — Vorgängerfehler
 * war eine feste 0,5-sm-Toleranz, die selbst 40°-Fehlpeilungen durchwinkte).
 */
export function positionUncertaintyNm(
  bearings: Bearing[],
  fix: BearingFix,
  sigmaDeg: number = KOMPASS_SIGMA_DEG,
): number {
  if (bearings.length < 2) return Infinity;
  const tanS = Math.tan((sigmaDeg * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0; i < bearings.length; i++) {
    for (let j = i + 1; j < bearings.length; j++) {
      const di = distanceNm(bearings[i].ref, fix);
      const dj = distanceNm(bearings[j].ref, fix);
      let cut = Math.abs(bearings[i].trueBearingDeg - bearings[j].trueBearingDeg) % 180;
      if (cut > 90) cut = 180 - cut; // Schnittwinkel 0..90°
      const sin = Math.max(Math.sin((cut * Math.PI) / 180), 0.1); // Deckel gegen ÷0
      const err = Math.hypot(di * tanS, dj * tanS) / sin;
      if (err < best) best = err;
    }
  }
  return best;
}

/**
 * GPS-Plausibilität (REQ-NAV-026): weicht der GPS-Fix weiter vom Peilungs-Fix
 * ab als die kombinierte Unsicherheit (GPS-Genauigkeit + Fehlerdreieck +
 * entfernungsabhängige Peil-Unsicherheit), ist Vorsicht geboten.
 */
export function gpsPlausibility(
  gps: LatLon,
  fix: BearingFix,
  gpsAccuracyNm: number,
  bearingUncertaintyNm: number,
): { deviation_nm: number; toleranz_nm: number; plausibel: boolean } {
  const deviation = distanceNm(gps, fix);
  // Kleiner Boden (≈18 m), damit die Warnung bei perfekter Geometrie nicht
  // schon durch Rundungsrauschen anschlägt.
  const toleranz = Math.max(0.01, gpsAccuracyNm + fix.error_nm + bearingUncertaintyNm);

  // Das Urteil fällt auf denselben Zahlen, die auch angezeigt werden
  // (Betreiber-Entscheidung 2026-07-20). Vorher wurde gerundet ausgegeben, aber
  // ungerundet entschieden — an der Grenze konnte die App dadurch
  // "Abweichung 1,50 sm · Toleranz 1,50 sm" anzeigen und trotzdem "unplausibel"
  // melden. Ein sichtbarer Selbstwiderspruch untergräbt genau das Vertrauen,
  // das eine Warnung braucht.
  //
  // Der Preis: Die Warnung wird um höchstens 0,005 sm (≈9 m) nachsichtiger.
  // Das ist vertretbar, weil der Toleranzboden oben mit 0,01 sm (≈18 m) ohnehin
  // größer ist — er existiert genau dafür, Rundungsrauschen abzufangen.
  const deviationGerundet = Math.round(deviation * 100) / 100;
  const toleranzGerundet = Math.round(toleranz * 100) / 100;
  return {
    deviation_nm: deviationGerundet,
    toleranz_nm: toleranzGerundet,
    plausibel: deviationGerundet <= toleranzGerundet,
  };
}

/**
 * Robuster Kompass-Mittelwert über mehrere Messungen (zirkulär) + Streuung.
 * Handy-Kompasse springen (real gemessen: 170° → 209°) — eine EINZELNE Messung
 * ist unbrauchbar. `spread_deg` groß ⇒ Kompass unruhig, Nutzer warnen.
 */
export function averageHeading(headings: number[]): { heading: number; spread_deg: number } | null {
  const hs = headings.filter((h) => Number.isFinite(h));
  if (!hs.length) return null;
  let sx = 0;
  let sy = 0;
  for (const h of hs) {
    const r = (h * Math.PI) / 180;
    sx += Math.sin(r);
    sy += Math.cos(r);
  }
  const n = hs.length;
  const heading = (((Math.atan2(sx / n, sy / n) * 180) / Math.PI) % 360 + 360) % 360;
  // Resultierende Länge R ∈ [0,1]: 1 = alle Messungen gleich, 0 = chaotisch.
  const R = Math.hypot(sx / n, sy / n);
  // Zirkuläre Standardabweichung in Grad.
  const spread = R > 0 ? (Math.sqrt(-2 * Math.log(Math.min(1, R))) * 180) / Math.PI : 180;
  return { heading: Math.round(heading * 10) / 10, spread_deg: Math.round(spread * 10) / 10 };
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

/**
 * Bester Schnittwinkel (0..90°) unter allen Peilungs-Paaren. Faustregel der
 * Seemannschaft: ~90° ist ideal, unter ~20° ist der Schnitt praktisch wertlos
 * (die Standlinien liegen fast übereinander → der "Standort" ist Zufall).
 */
export function bestCutAngleDeg(bearings: Bearing[]): number {
  let best = 0;
  for (let i = 0; i < bearings.length; i++) {
    for (let j = i + 1; j < bearings.length; j++) {
      let cut = Math.abs(bearings[i].trueBearingDeg - bearings[j].trueBearingDeg) % 180;
      if (cut > 90) cut = 180 - cut;
      if (cut > best) best = cut;
    }
  }
  return Math.round(best * 10) / 10;
}

/** Schnitt unter diesem Winkel ⇒ Peilung nicht verwertbar (ehrlich melden). */
export const MIN_CUT_ANGLE_DEG = 20;

/**
 * Azimut der KAMERA-Blickrichtung aus der 3D-Gerätelage (REQ-NAV-025, BUG-045).
 *
 * `webkitCompassHeading` beschreibt die Richtung der GERÄTE-OBERKANTE und gilt
 * nur für ein FLACH gehaltenes Handy. Beim Anpeilen hält man das Handy aber
 * AUFRECHT — dann zeigt die Oberkante zum Himmel, die Horizontal-Projektion
 * kippt weg und der Wert reagiert kaum noch auf Drehungen (real gemessen:
 * 90°-Drehung ⇒ nur wenige Grad Änderung).
 *
 * Korrekt: die Rückkamera zeigt in Gerätekoordinaten entlang −z. Diese Achse
 * wird mit der Rotationsmatrix R = Rz(α)·Rx(β)·Ry(γ) (W3C) in Weltkoordinaten
 * (Ost/Nord/Hoch) gedreht; der Azimut ist atan2(Ost, Nord).
 *
 * Rückgabe null, wenn die Kamera fast senkrecht zeigt (Azimut dann sinnlos) —
 * die UI bittet dann, das Handy aufrecht aufs Objekt zu richten.
 */
export function sightingAzimuth(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): number | null {
  if (![alphaDeg, betaDeg, gammaDeg].every((v) => Number.isFinite(v))) return null;
  const r = (d: number) => (d * Math.PI) / 180;
  const a = r(alphaDeg);
  const b = r(betaDeg);
  const g = r(gammaDeg);
  const cA = Math.cos(a);
  const sA = Math.sin(a);
  const cB = Math.cos(b);
  const sB = Math.sin(b);
  const cG = Math.cos(g);
  const sG = Math.sin(g);
  // Dritte Spalte von R (Bild der Geräte-z-Achse in der Welt).
  const r13 = cA * sG + sA * sB * cG;
  const r23 = sA * sG - cA * sB * cG;
  const r33 = cB * cG;
  // Kamera = −z: Weltvektor (Ost, Nord, Hoch).
  const vE = -r13;
  const vN = -r23;
  const horiz = Math.hypot(vE, vN);
  // Kamera zeigt fast in den Himmel/Boden → kein sinnvoller Azimut.
  if (horiz < 0.15) return null;
  void r33;
  return (((Math.atan2(vE, vN) * 180) / Math.PI) % 360 + 360) % 360;
}
