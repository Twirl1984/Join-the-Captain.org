// Unit-Tests Kreuzpeilung (REQ-NAV-025/026). Lauf: node --import tsx --test …/peilung.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  magneticToTrue,
  crossBearingFix,
  gpsPlausibility,
  positionUncertaintyNm,
  bestCutAngleDeg,
  MIN_CUT_ANGLE_DEG,
  averageHeading,
  sightingAzimuth,
  distanceNm,
  type LatLon,
  type Bearing,
} from "../peilung";

/** Rechtweisende Peilung Beobachter→Objekt im lokalen äquirektangularen Frame. */
function trueBearing(obs: LatLon, ref: LatLon): number {
  const cosLat = Math.cos((obs.lat * Math.PI) / 180);
  const east = (ref.lon - obs.lon) * 60 * cosLat;
  const north = (ref.lat - obs.lat) * 60;
  return (((Math.atan2(east, north) * 180) / Math.PI) % 360 + 360) % 360;
}

test("[REQ-NAV-025] magneticToTrue: Missweisung Ost addiert, Ergebnis 0..360", () => {
  assert.equal(magneticToTrue(90, 3), 93);
  assert.equal(magneticToTrue(359, 2), 1);
  assert.equal(magneticToTrue(10, -15), 355);
});

test("[REQ-NAV-025] Kreuzpeilung (2 Objekte) rekonstruiert den Standort", () => {
  const obs = { lat: 54.0, lon: 13.0 };
  const r1 = { lat: 54.25, lon: 13.0 }; // Nord
  const r2 = { lat: 54.0, lon: 13.4 }; // Ost
  const bearings: Bearing[] = [
    { ref: r1, trueBearingDeg: trueBearing(obs, r1) },
    { ref: r2, trueBearingDeg: trueBearing(obs, r2) },
  ];
  const fix = crossBearingFix(bearings)!;
  assert.ok(fix, "Fix existiert");
  assert.ok(distanceNm(fix, obs) < 0.05, `Fix nahe am wahren Ort (${distanceNm(fix, obs)} sm)`);
  assert.equal(fix.error_nm, 0, "2 Peilungen → kein Fehlerdreieck");
});

test("[REQ-NAV-025] 3 leicht verrauschte Peilungen → Fehlerdreieck > 0, Ort grob getroffen", () => {
  const obs = { lat: 54.0, lon: 13.0 };
  const refs = [
    { lat: 54.3, lon: 13.05 },
    { lat: 54.0, lon: 13.4 },
    { lat: 53.75, lon: 12.85 },
  ];
  const noise = [0.8, -0.9, 0.6]; // Grad Kompassfehler je Peilung
  const bearings: Bearing[] = refs.map((ref, i) => ({
    ref,
    trueBearingDeg: trueBearing(obs, ref) + noise[i],
  }));
  const fix = crossBearingFix(bearings)!;
  assert.ok(fix.error_nm > 0, "verrauschte Peilungen ergeben ein Fehlerdreieck");
  // ~0,8° Kompassfehler auf ~18 sm Distanz → realistisch grob 1 sm Ortsfehler.
  assert.ok(distanceNm(fix, obs) < 1.5, `Ort trotz Rauschen grob getroffen (${distanceNm(fix, obs)} sm)`);
});

test("[REQ-NAV-025] parallele Peilungen → kein Fix (null)", () => {
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 0 },
    { ref: { lat: 54.1, lon: 13.0 }, trueBearingDeg: 0 },
  ];
  assert.equal(crossBearingFix(bearings), null);
});

test("[REQ-NAV-025] < 2 Peilungen → null", () => {
  assert.equal(crossBearingFix([{ ref: { lat: 54, lon: 13 }, trueBearingDeg: 90 }]), null);
});

// ── GPS-Plausibilität: entfernungsabhängige Toleranz (BUG-043) ─────────────
// Regression zum echten Testfund: eine FESTE Toleranz (0,5 sm) winkte selbst
// eine 40°-Fehlpeilung als "GPS deckt sich" durch. Die Toleranz MUSS mit der
// Entfernung zu den angepeilten Objekten skalieren.

const nbg = { lat: 49.4521, lon: 11.0767 };
const obj1 = { lat: 49.456, lon: 11.079 }; // ~450 m
const obj2 = { lat: 49.4505, lon: 11.085 }; // ~630 m
const bearingTo = (from: LatLon, to: LatLon) => {
  const cosLat = Math.cos((from.lat * Math.PI) / 180);
  const e = (to.lon - from.lon) * 60 * cosLat;
  const n = (to.lat - from.lat) * 60;
  return (((Math.atan2(e, n) * 180) / Math.PI) % 360 + 360) % 360;
};
const GPS_ACC_NM = 30 / 1852; // 30 m

function pruefe(fehlerGrad: number) {
  const bs: Bearing[] = [
    { ref: obj1, trueBearingDeg: bearingTo(nbg, obj1) },
    { ref: obj2, trueBearingDeg: bearingTo(nbg, obj2) + fehlerGrad },
  ];
  const fix = crossBearingFix(bs)!;
  const unsicher = positionUncertaintyNm(bs, fix);
  return gpsPlausibility(nbg, fix, GPS_ACC_NM, unsicher);
}

test("[REQ-NAV-026] korrekte Peilungen → GPS deckt sich", () => {
  const r = pruefe(0);
  assert.equal(r.plausibel, true);
  assert.ok(r.deviation_nm < 0.02, `Abweichung winzig (${r.deviation_nm} sm)`);
});

test("[REQ-NAV-026] 40°-Fehlpeilung auf nahe Objekte MUSS anschlagen (BUG-043)", () => {
  const r = pruefe(40);
  assert.equal(r.plausibel, false, `40° Fehler muss auffallen (Abw. ${r.deviation_nm} sm, Toleranz ${r.toleranz_nm} sm)`);
});

test("[REQ-NAV-026] 90°-Fehlpeilung kippt die Geometrie → als unbrauchbar melden", () => {
  // Bei so grobem Fehler werden die Standlinien fast parallel: der Schnitt ist
  // wertlos. Die App darf dann NICHT "GPS deckt sich" behaupten, sondern muss
  // den schlechten Schnittwinkel ausweisen (BUG-043).
  const bs: Bearing[] = [
    { ref: obj1, trueBearingDeg: bearingTo(nbg, obj1) },
    { ref: obj2, trueBearingDeg: bearingTo(nbg, obj2) + 90 },
  ];
  assert.ok(bestCutAngleDeg(bs) < MIN_CUT_ANGLE_DEG, `Schnittwinkel unbrauchbar (${bestCutAngleDeg(bs)}°)`);
});

test("[REQ-NAV-025] guter Schnittwinkel wird als brauchbar erkannt", () => {
  const bs: Bearing[] = [
    { ref: obj1, trueBearingDeg: bearingTo(nbg, obj1) },
    { ref: obj2, trueBearingDeg: bearingTo(nbg, obj2) },
  ];
  assert.ok(bestCutAngleDeg(bs) >= MIN_CUT_ANGLE_DEG, `guter Schnitt (${bestCutAngleDeg(bs)}°)`);
});

test("[REQ-NAV-026] Toleranz wächst mit der Entfernung der Objekte", () => {
  // Nahe Objekte (Wohnviertel) → strenge Toleranz; ferne Objekte (Küste) → milder.
  const nah: Bearing[] = [
    { ref: obj1, trueBearingDeg: bearingTo(nbg, obj1) },
    { ref: obj2, trueBearingDeg: bearingTo(nbg, obj2) },
  ];
  const fern: Bearing[] = [
    { ref: { lat: 49.6, lon: 11.08 }, trueBearingDeg: 0 },
    { ref: { lat: 49.45, lon: 11.35 }, trueBearingDeg: 90 },
  ];
  const fixNah = crossBearingFix(nah)!;
  const fixFern = crossBearingFix(fern)!;
  assert.ok(
    positionUncertaintyNm(fern, fixFern) > positionUncertaintyNm(nah, fixNah) * 5,
    "ferne Objekte ⇒ deutlich größere Unsicherheit",
  );
});

// ── Kompass-Mittelung (springende Werte, real: 170° → 209°) ────────────────

test("[REQ-NAV-025] averageHeading mittelt zirkulär und meldet die Streuung", () => {
  const ruhig = averageHeading([120, 121, 119, 120])!;
  assert.ok(Math.abs(ruhig.heading - 120) < 1);
  assert.ok(ruhig.spread_deg < 3, `ruhiger Kompass = kleine Streuung (${ruhig.spread_deg}°)`);

  const unruhig = averageHeading([170, 209, 175, 205])!;
  assert.ok(unruhig.spread_deg > 10, `springender Kompass = große Streuung (${unruhig.spread_deg}°)`);
});

test("[REQ-NAV-025] averageHeading über den Nordsprung (359°/1°) mittelt korrekt", () => {
  const r = averageHeading([359, 1, 0])!;
  assert.ok(r.heading > 355 || r.heading < 5, `~0° erwartet, war ${r.heading}`);
});

test("[REQ-NAV-025] averageHeading ohne Messungen → null", () => {
  assert.equal(averageHeading([]), null);
});

// ── Kamera-Blickrichtung aus der Gerätelage (BUG-045, iPhone aufrecht) ──────

test("[REQ-NAV-025] aufrechtes Handy: 90°-Drehung ⇒ 90° Azimut-Änderung (BUG-045)", () => {
  // beta=90° = Handy aufrecht, Kamera waagerecht nach vorn.
  const a0 = sightingAzimuth(0, 90, 0)!;
  const a90 = sightingAzimuth(90, 90, 0)!;
  assert.ok(a0 != null && a90 != null);
  const diff = Math.abs(((a90 - a0 + 540) % 360) - 180); // zyklische Differenz zu 180
  assert.ok(Math.abs(Math.abs(((a90 - a0 + 360) % 360)) - 270) < 1 ||
            Math.abs(Math.abs(((a90 - a0 + 360) % 360)) - 90) < 1,
    `90° Drehung muss 90° Azimut-Änderung ergeben (war ${((a90 - a0 + 360) % 360)}°)`);
  void diff;
});

test("[REQ-NAV-025] aufrechtes Handy, alpha=0 ⇒ Kamera schaut nach Norden", () => {
  assert.ok(Math.abs(sightingAzimuth(0, 90, 0)!) < 1);
});

test("[REQ-NAV-025] flach liegendes Handy ⇒ kein Azimut (Kamera zeigt zum Boden)", () => {
  assert.equal(sightingAzimuth(0, 0, 0), null);
});

test("[REQ-NAV-025] unvollständige Lagedaten ⇒ null", () => {
  assert.equal(sightingAzimuth(NaN, 90, 0), null);
});
