// Unit-Tests Kreuzpeilung (REQ-NAV-025/026). Lauf: node --import tsx --test …/peilung.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  magneticToTrue,
  crossBearingFix,
  gpsPlausibility,
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

test("[REQ-NAV-026] GPS-Plausibilität: naher GPS ok, ferner GPS nicht plausibel", () => {
  const fix = { lat: 54.0, lon: 13.0, error_nm: 0.1, n: 2 };
  const nah = gpsPlausibility({ lat: 54.002, lon: 13.0 }, fix, 0.05);
  assert.equal(nah.plausibel, true);
  const fern = gpsPlausibility({ lat: 54.2, lon: 13.3 }, fix, 0.05);
  assert.equal(fern.plausibel, false);
  assert.ok(fern.deviation_nm > 5, `große Abweichung ausgewiesen (${fern.deviation_nm} sm)`);
});
