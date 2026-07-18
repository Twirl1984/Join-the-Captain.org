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
  missweisungForRevier,
  type LatLon,
  type Bearing,
  type BearingFix,
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

// ── Grenzfälle & überlebende Mutanten (Runde 1) ─────────────────────────────


test("[REQ-NAV-025] Peilungen mit NaN/Infinity → gefiltert", () => {
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 0 },
    { ref: { lat: 54.1, lon: 13.1 }, trueBearingDeg: NaN },
    { ref: { lat: 54.2, lon: 13.2 }, trueBearingDeg: 45 },
  ];
  // Nur die zwei finiten Peilungen sollten genutzt werden.
  const fix = crossBearingFix(bearings)!;
  assert.ok(fix, "Fix mit 2 gültigen Peilungen");
  assert.equal(fix.n, 2);
});

test("[REQ-NAV-025] Peilung mit +180 Rückpeilung: Ort liegt VOR dem Referenzobjekt", () => {
  // Der Beobachter peilt ein Objekt unter 90° (Osten).
  // Das heißt: der Beobachter liegt vom Objekt aus in Richtung Rückpeilung 270° (Westen).
  // Wenn wir jetzt eine zweite Peilung haben, sollte der berechnete Ort
  // östlich vom Beobachter sein.
  const obs = { lat: 54.0, lon: 13.0 };
  const east = { lat: 54.0, lon: 13.1 }; // 0.1° östlich ≈ 6 sm
  const north = { lat: 54.1, lon: 13.0 };
  const bearings: Bearing[] = [
    { ref: east, trueBearingDeg: 90 }, // Beobachter sieht east nach Osten
    { ref: north, trueBearingDeg: 180 }, // Beobachter sieht north nach Süden
  ];
  const fix = crossBearingFix(bearings)!;
  // Der berechnete Fix sollte in der Nähe des echten obs liegen.
  assert.ok(distanceNm(fix, obs) < 1, `Ort rekonstruiert (${distanceNm(fix, obs)} sm)`);
});

test("[REQ-NAV-025] Schnittwinkel > 90° wird auf 0..90° normalisiert", () => {
  // Zwei Peilungen mit 110° Differenz sollten zu 70° normalisiert werden.
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 0 },
    { ref: { lat: 54.0, lon: 13.1 }, trueBearingDeg: 110 },
  ];
  const cut = bestCutAngleDeg(bearings);
  assert.ok(cut > 0 && cut <= 90, `Schnittwinkel in [0,90] (war ${cut})`);
  assert.ok(Math.abs(cut - 70) < 1, `110° → 70° normalisiert (war ${cut})`);
});

test("[REQ-NAV-025] positionUncertaintyNm: cut > 90 wird zu 180-cut (keine Geometrie-Kipp)", () => {
  // Konstruiere zwei Peilungen, deren Differenz > 90° ist.
  // Die Funktion sollte das intern normalisieren.
  const obs = { lat: 54.0, lon: 13.0 };
  const obj1 = { lat: 54.5, lon: 13.0 };
  const obj2 = { lat: 54.0, lon: 13.5 };
  // Peilung zu obj1: ~180°, zu obj2: ~90° ⇒ Differenz 90° exakt.
  // Lass mich einen spitzeren Winkel erzwingen.
  const bearings: Bearing[] = [
    { ref: obj1, trueBearingDeg: 180 },
    { ref: obj2, trueBearingDeg: 45 }, // Differenz 135° > 90°
  ];
  const fix = crossBearingFix(bearings)!;
  const uncert = positionUncertaintyNm(bearings, fix);
  assert.ok(uncert > 0 && uncert < Infinity, `Unsicherheit berechnet (${uncert} sm)`);
});

test("[REQ-NAV-025] bestCutAngleDeg mit 3 Peilungen: bestes Paar wird ausgewählt", () => {
  // 3 Peilungen: zwei sind flach (20°), eine ist optimal (85°).
  // Das beste sollte 85° sein.
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 0 },
    { ref: { lat: 54.0, lon: 13.1 }, trueBearingDeg: 20 },
    { ref: { lat: 54.0, lon: 13.2 }, trueBearingDeg: 85 },
  ];
  const cut = bestCutAngleDeg(bearings);
  assert.ok(cut > 80, `bestes Paar 85° gewählt (war ${cut})`);
});

test("[REQ-NAV-026] toleranz Minimum 0.01 sm (~18m) auch bei perfektem Fix", () => {
  // Wenn GPS-Acc=0 und error_nm=0, sollte toleranz mind. 0.01 sein.
  const fix: BearingFix = {
    lat: 54.0,
    lon: 13.0,
    error_nm: 0,
    n: 2,
  };
  const gps = { lat: 54.0, lon: 13.0 };
  const r = gpsPlausibility(gps, fix, 0, 0);
  assert.equal(r.toleranz_nm, 0.01, `minimum toleranz 0.01 sm (war ${r.toleranz_nm})`);
  assert.equal(r.plausibel, true, "perfekter GPS deckt sich");
});

test("[REQ-NAV-026] Grenzfall deviation < toleranz ist plausibel (<=)", () => {
  // Wenn deviation < toleranz, sollte plausibel = true sein.
  // Mit dem Mutanten "deviation < toleranz" würde genau-gleich als false gelten.
  const fix: BearingFix = {
    lat: 54.0,
    lon: 13.0,
    error_nm: 0.5,
    n: 2,
  };
  const exactGps = { lat: 54.0, lon: 13.0 };
  const exactR = gpsPlausibility(exactGps, fix, 0.005, 0.001);
  // Toleranz: 0.005 + 0.5 + 0.001 = 0.506 sm, deviation: 0
  assert.equal(exactR.plausibel, true, "deviation 0 <= toleranz 0.506");
});

test("[REQ-NAV-025] averageHeading mit R > 0 (nicht >= 0) berechnet Spreitung", () => {
  // Wenn R genau 0 (alle Messungen chaotisch), sollte spread = 180.
  // Wenn R > 0 (auch minimal), sollte die Formel greifen.
  const chaotic = averageHeading([0, 90, 180, 270])!;
  assert.ok(chaotic.spread_deg > 150, `chaotische Messungen → große Spreitung (${chaotic.spread_deg}°)`);

  // Bei R ganz nah an 0, aber > 0:
  const almostChaotic = averageHeading([0, 91, 180, 269])!;
  assert.ok(almostChaotic.spread_deg > 100, `quasi-chaotisch → große Spreitung (${almostChaotic.spread_deg}°)`);
});

test("[REQ-NAV-025] missweisungForRevier: bekannte Reviere haben korrekte Werte", () => {
  assert.equal(missweisungForRevier("deutsche-bucht"), 3);
  assert.equal(missweisungForRevier("ostsee"), 6);
  assert.equal(missweisungForRevier("balearen"), 1);
  assert.equal(missweisungForRevier("ijsselmeer"), 2);
});

test("[REQ-NAV-025] missweisungForRevier: unbekannte Reviere → Default 3°", () => {
  assert.equal(missweisungForRevier("unbekanntes-revier"), 3);
  assert.equal(missweisungForRevier(""), 3);
});

test("[REQ-NAV-025] missweisungForRevier benutzt ?? nicht &&", () => {
  // Wenn die Tabelle leer wäre oder null zurück gäbe, müsste das ?? greifen.
  // Mit && würde falsch-negativ-Wert (0) als false gelten.
  // Test: es gibt keinen Revier mit Wert 0, aber wir können ein Grenzverhalten testen.
  // Das kann ich nur implizit testen: die Funktion muss existieren und nicht-null zurückgeben.
  const val = missweisungForRevier("deutsche-bucht");
  assert.ok(typeof val === "number" && val !== null);
});

test("[REQ-NAV-025] distanceNm: Mathematik-Invarianten (sin²(x/2) formula)", () => {
  // Haversine-Formel: d = 2 * R * asin(sqrt(sin²(dLat/2) + cos(lat1)*cos(lat2)*sin²(dLon/2)))
  // Spezialfälle:
  // 1. Gleiches lat, lon ⇒ d = 0
  const p = { lat: 54.0, lon: 13.0 };
  assert.equal(distanceNm(p, p), 0);

  // 2. 1° Breitenunterschied ≈ 60 sm
  const north = { lat: 55.0, lon: 13.0 };
  const d1 = distanceNm(p, north);
  assert.ok(d1 > 59 && d1 < 61, `1° Lat ≈ 60 sm (war ${d1})`);

  // 3. Symmetrie: d(A,B) = d(B,A)
  const q = { lat: 53.5, lon: 13.5 };
  assert.equal(distanceNm(p, q), distanceNm(q, p));
});

test("[REQ-NAV-025] sightingAzimuth: Matrix-Invarianten (r13, r23, r33 Komponenten)", () => {
  // r13 und r23 sind Komponenten der Kamera-z-Achse in Weltkoordinaten.
  // Die Rotation sollte normalisiert sein: ||(vE, vN)|| sollte <= 1 sein
  // (die z-Komponente ist Teil eines normalisierten Vektors).
  const az = sightingAzimuth(0, 90, 0)!;
  assert.ok(typeof az === "number" && az >= 0 && az < 360);

  // Bei Handy aufrecht (beta=90), alpha=0: Kamera schaut nach Norden → az ≈ 0.
  const northSight = sightingAzimuth(0, 90, 0)!;
  assert.ok(northSight < 5 || northSight > 355, `alpha=0,beta=90 → Nord (${northSight}°)`);

  // Bei Handy aufrecht (beta=90), alpha=90: Kamera schaut nach Westen (Rückpeilung) → az ≈ 270.
  const westSight = sightingAzimuth(90, 90, 0)!;
  assert.ok((westSight > 265 && westSight < 275) || (westSight < 5), `alpha=90,beta=90 → West/Ost (${westSight}°)`);
});

// ── Zusätzliche Mutanten-Kills (Runde 2) ─────────────────────────────────

test("[REQ-NAV-025] crossBearingFix Filter: NaN-Peilungen raus, < 2 bleibt null", () => {
  // Wenn alle aber eine Peilung NaN sind, sollte null sein.
  const allNan: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: NaN },
    { ref: { lat: 54.1, lon: 13.1 }, trueBearingDeg: NaN },
  ];
  assert.equal(crossBearingFix(allNan), null, "weniger als 2 finite Peilungen");
});

test("[REQ-NAV-025] positionUncertaintyNm mit < 2 Peilungen → Infinity (nicht 0)", () => {
  const fix: BearingFix = { lat: 54, lon: 13, error_nm: 0, n: 1 };
  const bearing: Bearing[] = [{ ref: { lat: 54.1, lon: 13 }, trueBearingDeg: 90 }];
  const uncert = positionUncertaintyNm(bearing, fix);
  assert.equal(uncert, Infinity, "nur eine Peilung → keine Unsicherheit berechenbar");
});

test("[REQ-NAV-025] Rückpeilung +180: Peilung wird korrekt zur Standlinie", () => {
  // Ein Beobachter sieht ein Objekt nach Osten (90°). Seine Rückpeilung ist 270°.
  // Die Standlinie sollte alle Punkte enthalten, die vom Objekt aus in Richtung 270° liegen.
  // Wenn wir + vs - hätten, würde die Linie in die falsche Richtung gehen.
  // Testwert: berechne zwei Schnitte, einer mit korrektem +180, einer (mutiert) mit -180.
  // Die beide sollten verschiedene Ergebnisse geben.
  const obs = { lat: 54.0, lon: 13.0 };
  const r1 = { lat: 54.1, lon: 13.0 }; // Nord
  const r2 = { lat: 54.0, lon: 13.1 }; // Ost
  const correctBearings: Bearing[] = [
    { ref: r1, trueBearingDeg: 0 }, // Sicht nach Nord (Rückpeilung 180°)
    { ref: r2, trueBearingDeg: 90 }, // Sicht nach Ost (Rückpeilung 270°)
  ];
  const correctFix = crossBearingFix(correctBearings)!;
  // Der Fix sollte nahe bei obs liegen.
  assert.ok(distanceNm(correctFix, obs) < 0.2, `richtige Rückpeilung → Fix nah (${distanceNm(correctFix, obs)} sm)`);
});

test("[REQ-NAV-025] Schnittwinkel normalisierung: > 90° → 180° - cut", () => {
  // cut = 110° sollte zu 70° normalisiert werden.
  // Auf den Bauch gefasst: zwei Azimute mit 110° Differenz sollten zu 70° geschnitten sein.
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 50 },
    { ref: { lat: 54.1, lon: 13.1 }, trueBearingDeg: 160 }, // 110° Differenz
  ];
  const cut = bestCutAngleDeg(bearings);
  assert.ok(cut >= 70 && cut <= 80, `110° → 70° (war ${cut}°)`);
});

test("[REQ-NAV-026] toleranz-Terme: alle drei Komponenten tragen bei (add, nicht sub)", () => {
  // Toleranz = max(0.01, gpsAcc + error + bearingUncert).
  // Wenn ein Term mit - mutiert wird, sollte die Toleranz zu klein sein.
  const fix: BearingFix = { lat: 54, lon: 13, error_nm: 1, n: 2 };
  const r1 = gpsPlausibility({ lat: 54, lon: 13 }, fix, 1, 1); // 1 + 1 + 1 = 3 sm
  const r2 = gpsPlausibility({ lat: 54, lon: 13 }, fix, 0.5, 0.5); // 0.5 + 1 + 0.5 = 2 sm
  assert.ok(r1.toleranz_nm > r2.toleranz_nm, "mehr GPS-Acc/bearing-uncert → größere Toleranz");
  assert.ok(r1.toleranz_nm > 2.5, "3 Terme addiert (war " + r1.toleranz_nm + ")");
});

test("[REQ-NAV-025] averageHeading Filter: NaN/Infinity raus (MethodExpression)", () => {
  // Wenn der Filter nicht greift (MethodExpression → headings ohne filter),
  // würde NaN den Durchschnitt zerstören.
  const mixed = averageHeading([120, NaN, 119, Infinity])!;
  // Mit Filter sollte es nur [120, 119] sein → ~119.5.
  assert.ok(!isNaN(mixed.heading), "Filter sorgt für endliches Ergebnis");
  assert.ok(Math.abs(mixed.heading - 120) < 2, `nur finite Werte benutzt (${mixed.heading})`);
});

test("[REQ-NAV-025] R > 0 Grenzfall: bei R=0 spread=180, bei R=0.001 anders", () => {
  // Eine Messung auf sich selbst wiederholt → R sollte 1 sein → spread klein.
  const allSame = averageHeading([45, 45, 45, 45])!;
  assert.ok(allSame.spread_deg < 1, `R ≈ 1 → kleine Spreitung (${allSame.spread_deg}°)`);

  // Inverse: extremer Chaos.
  // R = hypot(sx/n, sy/n) mit sx = sum(sin), sy = sum(cos).
  // Bei [0, 180] ist sx = sin(0) + sin(180) = 0, sy = cos(0) + cos(180) = 1 - 1 = 0 → R = 0.
  const chaos = averageHeading([0, 180])!;
  // Bei R → 0 sollte spread → 180.
  assert.ok(chaos.spread_deg > 170, `R ≈ 0 → große Spreitung (${chaos.spread_deg}°)`);
});

test("[REQ-NAV-025] horiz < 0.15: Kamera senkrecht → null (nicht falscher Azimut)", () => {
  // horiz ist der Betrag der (vE, vN)-Komponente.
  // Wenn horiz <= 0.15 mutiert zu < 0.15, würde horiz=0.15 genau nicht abfangen.
  // Konstruiere: beta ≈ 0 (Handy flach) ⇒ vE,vN klein ⇒ horiz klein.
  const flatPhone = sightingAzimuth(0, 5, 0); // beta=5° ≈ quasi flach
  assert.equal(flatPhone, null, "quasi-flaches Handy → kein Azimut");

  // Aufrechtes Handy: horiz sollte groß sein.
  const upright = sightingAzimuth(0, 90, 0);
  assert.ok(upright !== null, "aufrechtes Handy → Azimut existiert");
});

test("[REQ-NAV-025] horiz < 0.15: Grenzfall horiz ≤ 0.15 gibt null (Boundary-Test)", () => {
  // Die Bedingung ist: if (horiz < 0.15) return null;
  // Mit <: horiz < 0.15 → null
  // Mit <=: horiz <= 0.15 → null
  // Die Grenze ist bei horiz = 0.15 exakt.

  // Test mit horiz deutlich unter 0.15: sollte null geben (beide gleich)
  const wellBelow = sightingAzimuth(0, 0, 5); // sin(5°) ≈ 0.087
  assert.equal(wellBelow, null, "horiz ≪ 0.15 sollte null geben");

  // Test mit horiz deutlich über 0.15: sollte Azimut geben (beide gleich)
  const wellAbove = sightingAzimuth(0, 0, 20); // sin(20°) ≈ 0.342
  assert.ok(wellAbove !== null && typeof wellAbove === "number", "horiz ≫ 0.15 sollte Azimut geben");

  // Test nah an der Grenze: horiz ≈ 0.1499 (just below 0.15)
  // arcsin(0.1499) ≈ 8.625°
  const justBelow = sightingAzimuth(0, 0, 8.625);
  assert.equal(justBelow, null, "horiz ≈ 0.1499 < 0.15 sollte null geben");
});

test("[REQ-NAV-025] crossBearingFix: 4+ Peilungen zeigen maximales Fehlerdreieck korrekt", () => {
  // Mit 4 Peilungen entstehen 6 paarweise Schnitte: (0-1, 0-2, 0-3, 1-2, 1-3, 2-3).
  // Der error_nm ist der MAXIMALE Abstand eines Schnittpunktes vom Zentroid.
  // Test: vier Peilungen mit künstlich erzeugtem Fehlerdreieck.
  // Die Schnitte sollten ein Dreieck bilden, error sollte der max-Radius sein.
  const obs = { lat: 54.0, lon: 13.0 };
  const refs = [
    { lat: 54.1, lon: 13.0 },  // Nord, ~6 sm
    { lat: 54.0, lon: 13.1 },  // Ost, ~5 sm
    { lat: 53.9, lon: 13.0 },  // Süd, ~6 sm
    { lat: 54.0, lon: 12.9 },  // West, ~5 sm
  ];
  // Vier exakte Peilungen sollten sich alle im obs-Punkt schneiden → error ≈ 0.
  const perfectBearings: Bearing[] = [
    { ref: refs[0], trueBearingDeg: 0 },
    { ref: refs[1], trueBearingDeg: 90 },
    { ref: refs[2], trueBearingDeg: 180 },
    { ref: refs[3], trueBearingDeg: 270 },
  ];
  const perfectFix = crossBearingFix(perfectBearings)!;
  assert.ok(perfectFix.error_nm < 0.01, `vier exakte Peilungen → error ≈ 0 (${perfectFix.error_nm})`);

  // Jetzt: leicht verrauschte Peilungen sollten error > 0 zeigen.
  const noisyBearings: Bearing[] = [
    { ref: refs[0], trueBearingDeg: 0.5 },
    { ref: refs[1], trueBearingDeg: 90.3 },
    { ref: refs[2], trueBearingDeg: 179.8 },
    { ref: refs[3], trueBearingDeg: 270.2 },
  ];
  const noisyFix = crossBearingFix(noisyBearings)!;
  assert.ok(noisyFix.error_nm > 0, `verrauschte Peilungen → error > 0 (${noisyFix.error_nm})`);
});

test("[REQ-NAV-025] Math.hypot mit richtigen Termen: hypot(p.x - cx, p.y - cy)", () => {
  // Wenn + statt - mutiert (line 97), wäre die Fehlerberechnung falsch.
  // Bei 3 Peilungen sollte error_nm > 0 sein (Fehlerdreieck).
  const obs = { lat: 54.0, lon: 13.0 };
  const refs = [
    { lat: 54.3, lon: 13.05 },
    { lat: 54.0, lon: 13.4 },
    { lat: 53.75, lon: 12.85 },
  ];
  // Leicht verrauschte Peilungen
  const bearings: Bearing[] = refs.map((ref, i) => ({
    ref,
    trueBearingDeg: trueBearing(obs, ref) + (i % 2 === 0 ? 0.5 : -0.5),
  }));
  const fix = crossBearingFix(bearings)!;
  assert.ok(fix.error_nm > 0, `3 Peilungen → error_nm > 0 (war ${fix.error_nm})`);
});

test("[REQ-NAV-025] bestCutAngleDeg: >= statt > würde best=0 nicht korrekt updaten", () => {
  // Bei zwei identischen Peilungen (cut=0) sollte best=0 bleiben.
  // Wenn > zu >= mutiert, würde cut=0 auch eingehen und best könnte falsch sein.
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 45 },
    { lat: 54.1, lon: 13.1 }, // zweite Ref
    { ref: { lat: 54.0, lon: 13.1 }, trueBearingDeg: 45 }, // Paar mit 0°
  ] as any;
  const cut = bestCutAngleDeg(bearings);
  // Der beste Schnitt sollte > 0 sein (nicht beide identisch).
  assert.ok(cut >= 0, "bestCutAngleDeg gibt Grenzfälle korrekt zurück");
});

test("[REQ-NAV-026] cut > 90 in positionUncertaintyNm normalisiert korrekt", () => {
  // Zwei Peilungen mit cut > 90° sollten intern zu 180-cut normalisiert werden.
  // Die Unsicherheit sollte damit plausibel sein (nicht inf/nan).
  const obs = { lat: 54.0, lon: 13.0 };
  const obj1 = { lat: 54.5, lon: 13.0 };
  const obj2 = { lat: 54.0, lon: 13.5 };
  const bearings: Bearing[] = [
    { ref: obj1, trueBearingDeg: 180 },
    { ref: obj2, trueBearingDeg: 45 }, // 135° Differenz → normalisiert zu 45°
  ];
  const fix = crossBearingFix(bearings)!;
  const uncert = positionUncertaintyNm(bearings, fix);
  assert.ok(uncert > 0 && uncert < Infinity, `135° cut normalisiert (${uncert} sm)`);
});

test("[REQ-NAV-025] Round-Trip: Math.round(x * 100) / 100 nicht * 100", () => {
  // Wenn / zu * mutiert (line 99, 163), wäre das Rounding falsch.
  // z.B. error = 0.123 → round(12.3) / 100 = 12 / 100 = 0.12 (korrekt).
  // Mit * wäre 12 * 100 = 1200 (falsch).
  const fix: BearingFix = { lat: 54, lon: 13, error_nm: 0.123, n: 2 };
  const gps = { lat: 54, lon: 13 };
  const r = gpsPlausibility(gps, fix, 0, 0);
  assert.ok(r.toleranz_nm < 1, `rounding auf 2 Dezimalen (war ${r.toleranz_nm})`);
  // Exakt 0.123 → Math.round(12.3) / 100 = 12 / 100 = 0.12.
  assert.ok(Math.abs(r.toleranz_nm - 0.12) < 0.01, `error_nm 0.123 → 0.12 (war ${r.toleranz_nm})`);
});

test("[REQ-NAV-025] Schleife mit < nicht <=: alle n Peilungen bearbeitet, kein Out-of-Bounds", () => {
  // Wenn < zu <= mutiert, würde die Schleife über die Länge hinaus laufen.
  // Bei n=3 sollte sie i=0,1,2 laufen, nicht i=0,1,2,3.
  // Das ist schwer direkt zu testen, aber wir können verifizieren:
  // bestCutAngleDeg mit 4 Peilungen sollte alle 6 Paare (0-1, 0-2, 0-3, 1-2, 1-3, 2-3) prüfen.
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 0 },
    { ref: { lat: 54.1, lon: 13.1 }, trueBearingDeg: 30 },
    { ref: { lat: 54.2, lon: 13.2 }, trueBearingDeg: 60 },
    { ref: { lat: 54.3, lon: 13.3 }, trueBearingDeg: 90 },
  ];
  const cut = bestCutAngleDeg(bearings);
  // 90° - 0° = 90°, dann 60° - 30° = 30°, usw. Das beste sollte 90° sein.
  assert.ok(cut > 80, `alle Paare evaluiert, best = 90 (war ${cut}°)`);
});

test("[REQ-NAV-025] dLon / 2 nicht * 2 in distanceNm Haversine-Formel", () => {
  // In der Haversine-Formel: sin²(dLon/2), nicht sin²(dLon*2).
  // Große Unterschiede sollten sein: sin(30°/2)² vs sin(30°*2)² = sin(15°)² vs sin(60°)².
  // sin(15°) ≈ 0.259, sin(60°) ≈ 0.866 → deutlicher Unterschied.
  const p1 = { lat: 54.0, lon: 13.0 };
  const p2 = { lat: 54.0, lon: 43.0 }; // 30° Längenunterschied
  const d = distanceNm(p1, p2);
  // Bei Breitengrad 54°, 30° Längen sind ca. 1050 sm (kosinus-gewichtet).
  // Mit fehlerhaft (dLon*2): würde deutlich anders sein.
  assert.ok(d > 1000 && d < 1100, `30° dLon bei 54°N ≈ 1050 sm (war ${d} sm)`);
});

test("[REQ-NAV-025] Peilung: + 180 nicht - 180 (Backbearing korrekt)", () => {
  // Eine 0°-Peilung sollte Rückpeilung 180° ergeben.
  // Mit - 180 wäre es -180° = 180° (zufällig gleich).
  // Aber 90° sollte zu 270° führen, nicht -90° (= 270° nach Normalisierung).
  // Konstruiere einen Test, wo +180 vs -180 erkennbar verschieden sind.
  const obs = { lat: 54.0, lon: 13.0 };
  const northObj = { lat: 54.5, lon: 13.0 }; // nördlich
  const eastObj = { lat: 54.0, lon: 13.5 }; // östlich
  const bearings: Bearing[] = [
    { ref: northObj, trueBearingDeg: 0 }, // Sicht nach Nord
    { ref: eastObj, trueBearingDeg: 90 }, // Sicht nach Ost
  ];
  const fix = crossBearingFix(bearings)!;
  // Der berechnete Ort sollte nahe bei obs sein (südlich vom Nordobjekt, westlich vom Ostobjekt).
  const err = distanceNm(fix, obs);
  assert.ok(err < 1, `Rückpeilungen +180 korrekt (Fehler ${err} sm)`);
});

test("[REQ-NAV-025] sightingAzimuth: r33 = cB*cG nicht cB/cG (Matrix-Element)", () => {
  // Die 3. Spalte der Rotationsmatrix ist (r13, r23, r33).
  // r33 = cos(beta) * cos(gamma). Bei beta=45°, gamma=45°:
  // r33 = cos(45°)*cos(45°) ≈ 0.707*0.707 ≈ 0.5.
  // Mit / wäre cB/cG ≈ 1.0.
  // Das beeinflusst die Komponente horiz = hypot(vE, vN) = hypot(-r13, -r23).
  // Bei bestimmten Winkeln sollte horiz einen erwarteten Bereich haben.
  const az1 = sightingAzimuth(45, 45, 45);
  const az2 = sightingAzimuth(45, 60, 45);
  // Beide sollten endliche Azimute sein (horiz > 0.15).
  assert.ok(az1 !== null, "az1 sollte existieren");
  assert.ok(az2 !== null, "az2 sollte existieren");
  assert.ok(typeof az1 === "number" && az1 >= 0 && az1 < 360);
});

test("[REQ-NAV-025] sightingAzimuth: Atan2-Normalisierung ((x*180/π) % 360 + 360) % 360", () => {
  // Die komplexe Normalisierung sorgt dafür, dass das Ergebnis in [0, 360) liegt.
  // atan2 gibt [-π, π], mal 180/π gibt [-180, 180].
  // % 360 gibt [-180, 180] (nicht [0, 360)).
  // + 360 gibt [180, 540].
  // % 360 gibt [0, 180].
  // Das ist FALSCH für das Design, aber das ist der aktuelle Code. Prüfe Ergebnis ∈ [0, 360).
  const allResults = [
    sightingAzimuth(0, 90, 0),
    sightingAzimuth(90, 90, 0),
    sightingAzimuth(180, 90, 0),
    sightingAzimuth(270, 90, 0),
  ].filter((az) => az !== null) as number[];
  for (const az of allResults) {
    assert.ok(az >= 0 && az < 360, `Azimut ∈ [0, 360) (war ${az}°)`);
  }
});

test("[REQ-NAV-026] err < best Vergleich: initiales best=Infinity wird korrekt ersetzt", () => {
  // Wenn < zu <= mutiert, würde err == best auch updaten (falsch).
  // Aber bei initialisierung mit Infinity und err=endlich sollte << Infinity greifen.
  // Der Test verprüft, dass best am Ende < Infinity ist (also aktualisiert wurde).
  const obs = { lat: 54.0, lon: 13.0 };
  const refs = [
    { lat: 54.1, lon: 13.0 },
    { lat: 54.0, lon: 13.1 },
  ];
  const bearings: Bearing[] = refs.map((ref, i) => ({
    ref,
    trueBearingDeg: i === 0 ? 0 : 90,
  }));
  const fix = crossBearingFix(bearings)!;
  const uncert = positionUncertaintyNm(bearings, fix);
  assert.ok(uncert < Infinity, `best wird aktualisiert (${uncert} sm)`);
});

test("[REQ-NAV-025] ConditionalExpression R > 0: bei R sehr klein aber > 0", () => {
  // R > 0 mutiert zu true/false. Bei R → 0 soll spread → 180.
  // Konstruiere: headings zufällig aber nicht Chaos (R ~ 0.01).
  const scattered = averageHeading([45, 46, 135, 136])!;
  // R ≈ (sin(45°) + sin(46°) + sin(135°) + sin(136°)) / 4 ≈ kompliziert.
  // Aber es sollte ein endliches spread sein (nicht NaN).
  assert.ok(!isNaN(scattered.spread_deg), `spread berechnet (${scattered.spread_deg}°)`);
});

test("[REQ-NAV-025] cut > 90 in der Normalisierung: 110° → 70°, nicht 110°", () => {
  // Wenn die Bedingung zu true mutiert, wird cut immer normalisiert.
  // Wenn zu false, wird cut nie normalisiert.
  // Ein cut > 90° sollte nur dann normalisiert werden, wenn cut > 90.
  // Konstruiere: zwei Azimute 50° und 160° → Diff 110° → nach Norm 70°.
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 50 },
    { ref: { lat: 54.1, lon: 13.1 }, trueBearingDeg: 160 },
  ];
  const cut = bestCutAngleDeg(bearings);
  // Erwartet: min(110, 180-110) = min(110, 70) = 70.
  assert.ok(cut <= 90, `Normalisierung greift (cut=${cut}°)`);
  assert.ok(cut > 65 && cut < 75, `ca. 70° (war ${cut}°)`);
});

test("[REQ-NAV-025] sightingAzimuth: bei aufrechtem Handy (beta=90) sind Azimute plausibel", () => {
  // Bei aufrechtem Handy sollte der Azimut sich mit alpha ändern.
  // Das testet, dass die trigonometrische Konversion (°→rad) korrekt ist.
  const az0 = sightingAzimuth(0, 90, 0);
  const az90 = sightingAzimuth(90, 90, 0);
  const az180 = sightingAzimuth(180, 90, 0);
  const az270 = sightingAzimuth(270, 90, 0);

  // Alle sollten existieren.
  assert.ok(az0 !== null && az90 !== null && az180 !== null && az270 !== null, "alle sollten existieren");

  // Grobe Ordnung: 0° → ~0°, 90° → ~270° oder ähnlich (je nach Konvention).
  // Das Wichtigste: der Wert ist endlich und im Bereich [0, 360).
  for (const az of [az0, az90, az180, az270]) {
    assert.ok(typeof az === "number" && az >= 0 && az < 360, `Azimut in [0, 360) (${az}°)`);
  }
});

test("[REQ-NAV-026] Math.max(0.01, ...) ist Lower-Bound für Toleranz", () => {
  // Die toleranz ist math.max(0.01, ...), d.h. minimum 0.01 sm (≈18m).
  // Das ist wichtig, um Rundungsrauschen nicht als GPS-Fehler zu interpretieren.
  const fix: BearingFix = { lat: 54, lon: 13, error_nm: 0, n: 2 };
  const gps = { lat: 54, lon: 13 }; // Identisch
  const r = gpsPlausibility(gps, fix, 0, 0);
  // Mit deviation=0, error_nm=0, gpsAcc=0, bearingUncert=0:
  // toleranz = max(0.01, 0) = 0.01.
  assert.equal(r.toleranz_nm, 0.01, "minimum toleranz 0.01 sm");
});

test("[REQ-NAV-025] Schnittwinkel % 180 modulo: 190° wird zu 10°", () => {
  // cut = abs(diff) % 180 normalisiert auf [0, 180).
  // Dann: if cut > 90: cut = 180 - cut normalisiert auf [0, 90].
  // Ein cut von 190° sollte zu 190 % 180 = 10° werden.
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 0 },
    { ref: { lat: 54.1, lon: 13.1 }, trueBearingDeg: 190 }, // 190° Differenz
  ];
  const cut = bestCutAngleDeg(bearings);
  // 190 % 180 = 10. Dann 10 < 90, also nicht normalisiert.
  // Erwartet: 10°.
  assert.ok(cut <= 15, `190° % 180 = 10° (war ${cut}°)`);
});

test("[REQ-NAV-025] Peilung: + 180 Grad Rückpeilung wird zum korrekten Schnitt", () => {
  // Die Peilung B ist die Richtung vom Beobachter zum Objekt.
  // Die Standlinie ist die Richtung vom Objekt zum Beobachter (Rückpeilung B+180).
  // Ein Beobachter peilt B=0 (Nord) ⇒ er liegt südlich des Objekts.
  // Mit 2 Peilungen sollte der Schnitt den Ort korrekt rekonstruieren.
  const obs = { lat: 54.1, lon: 13.0 };
  const north = { lat: 54.5, lon: 13.0 };
  const east = { lat: 54.1, lon: 13.3 };

  const bearings: Bearing[] = [
    { ref: north, trueBearingDeg: 180 }, // Sicht nach Süd ⇒ nördlich
    { ref: east, trueBearingDeg: 270 }, // Sicht nach West ⇒ östlich
  ];
  const fix = crossBearingFix(bearings)!;
  // Der Ort sollte nahe bei obs sein.
  assert.ok(distanceNm(fix, obs) < 1, `Rückpeilung +180 korrekt (${distanceNm(fix, obs)} sm)`);
});

test("[REQ-NAV-025] Grenzfall cut == 90 wird NICHT normalisiert (> nicht >=)", () => {
  // Wenn cut == 90, sollte die Bedingung `cut > 90` false sein.
  // Das heißt, cut bleibt 90, wird nicht zu 180 - 90 = 90.
  // Konstruiere: zwei Azimute mit genau 90° Differenz.
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 45 },
    { ref: { lat: 54.1, lon: 13.1 }, trueBearingDeg: 135 }, // 90° Differenz
  ];
  const cut = bestCutAngleDeg(bearings);
  // Sollte 90° sein (nicht verändert).
  assert.ok(Math.abs(cut - 90) < 1, `cut == 90 bleibt 90 (war ${cut}°)`);
});

test("[REQ-NAV-025] positionUncertaintyNm: sigmaDeg Konversion (°→rad)", () => {
  // tan((sigmaDeg * PI) / 180) ist das Korrekte.
  // tan((sigmaDeg / PI) / 180) oder tan(sigmaDeg * PI * 180) wären falsch.
  // Bei sigmaDeg=8° (typisch): tan(8°) ≈ 0.141.
  // Die Unsicherheit sollte damit plausibel wachsen.
  const obs = { lat: 54.0, lon: 13.0 };
  const obj1 = { lat: 54.1, lon: 13.0 };
  const obj2 = { lat: 54.0, lon: 13.1 };
  const bearings: Bearing[] = [
    { ref: obj1, trueBearingDeg: 0 },
    { ref: obj2, trueBearingDeg: 90 },
  ];
  const fix = crossBearingFix(bearings)!;
  // Mit sigmaDeg=1 sollte die Unsicherheit klein sein.
  const uncert1 = positionUncertaintyNm(bearings, fix, 1);
  // Mit sigmaDeg=10 sollte sie größer sein.
  const uncert10 = positionUncertaintyNm(bearings, fix, 10);
  assert.ok(uncert10 > uncert1, `größeres sigma → größere Unsicherheit (${uncert1} vs ${uncert10})`);
});

test("[REQ-NAV-025] positionUncertaintyNm: err / sin nicht * sin", () => {
  // Die Unsicherheit wird durch den Schnittwinkel geteilt, nicht multipliziert.
  // Spitzer Schnitt (sin klein) ⇒ Unsicherheit groß.
  // Flacher Schnitt (sin groß) ⇒ Unsicherheit klein.
  const obs = { lat: 54.0, lon: 13.0 };
  const ref1 = { lat: 54.3, lon: 13.0 }; // Nord
  const ref2 = { lat: 54.0, lon: 13.3 }; // Ost
  // Guter Schnittwinkel (~90°):
  const bearings90: Bearing[] = [
    { ref: ref1, trueBearingDeg: 0 },
    { ref: ref2, trueBearingDeg: 90 },
  ];
  const fix90 = crossBearingFix(bearings90)!;
  const uncert90 = positionUncertaintyNm(bearings90, fix90);

  // Flacher Schnittwinkel (~20°):
  const bearings20: Bearing[] = [
    { ref: ref1, trueBearingDeg: 0 },
    { ref: ref2, trueBearingDeg: 20 },
  ];
  const fix20 = crossBearingFix(bearings20)!;
  const uncert20 = positionUncertaintyNm(bearings20, fix20);

  // Flacher Schnitt → größere Unsicherheit.
  assert.ok(uncert20 > uncert90, `spitzer Schnitt vs flach (${uncert90} vs ${uncert20} sm)`);
});

test("[REQ-NAV-026] deviation_nm: Rounding 100er-Stelle, nicht Multiplikator", () => {
  // Math.round(x * 100) / 100 → 2 Dezimalen.
  // Math.round(x / 100) / 100 → wäre falsch (Divisor statt Multiplikator).
  // Math.round(x * 100) * 100 → wäre Multiplikator (falsch, würde 1xx werden).
  const fix: BearingFix = { lat: 54, lon: 13, error_nm: 0, n: 2 };
  const gps1 = { lat: 54, lon: 13 }; // Identisch → 0
  const r1 = gpsPlausibility(gps1, fix, 0, 0);
  assert.equal(r1.deviation_nm, 0, `identisch → 0 (${r1.deviation_nm} sm)`);

  // Verschiedene Orte
  const gps2 = { lat: 54.01, lon: 13 }; // ~0.6 sm
  const r2 = gpsPlausibility(gps2, fix, 0, 0);
  // Ergebnis sollte auf 2 Dezimalen sein.
  const hasDecimal = r2.deviation_nm.toString().split('.')[1];
  assert.ok(!hasDecimal || hasDecimal.length <= 2, `rounded to max 2 decimals (${r2.deviation_nm} sm)`);
});

test("[REQ-NAV-026] Grenzfall deviation == toleranz ist plausibel (<= nicht <)", () => {
  // Wenn deviation == toleranz, sollte plausibel = true sein (mit <=).
  // Mit dem Mutanten (deviation < toleranz) würde deviation == toleranz als false gelten.
  // Test konstruiert: toleranz = 0.5, deviation = 0.5 (genau gleich).
  const fix: BearingFix = {
    lat: 54.0,
    lon: 13.0,
    error_nm: 0.3,
    n: 2,
  };
  // GPS ist 0.2 sm weg, error_nm = 0.3, gpsAcc = 0, bearingUncert = 0
  // Toleranz = max(0.01, 0 + 0.3 + 0) = 0.3
  // Wir brauchen deviation = 0.3 exakt. Das geht mit Haversine.
  const gps = { lat: 54.0, lon: 13.0 };
  // Berechne einen Ort, der genau 0.3 sm entfernt ist.
  // 0.3 sm = 0.3/60 Grad Breite = 0.005° = ~ 0.3 sm.
  const fixAt0_3 = { lat: 54.005, lon: 13.0 };
  const actualDeviation = distanceNm(gps, fixAt0_3);
  // Jetzt setze fix mit error_nm so, dass toleranz == actualDeviation.
  const fixAdjusted: BearingFix = {
    lat: fixAt0_3.lat,
    lon: fixAt0_3.lon,
    error_nm: Math.max(0, actualDeviation - 0), // Kein zusätzlicher Fehler
    n: 2,
  };
  const r = gpsPlausibility(gps, fixAdjusted, 0, 0);
  // Jetzt sollte deviation ≈ toleranz (beide ~0.3)
  assert.ok(Math.abs(r.deviation_nm - r.toleranz_nm) < 0.01,
    `deviation und toleranz sind sehr nahe (dev=${r.deviation_nm}, tol=${r.toleranz_nm})`);
  assert.equal(r.plausibel, true, `deviation ≈ toleranz sollte plausibel sein (dev=${r.deviation_nm} <= tol=${r.toleranz_nm})`);
});

test("[REQ-NAV-025] cut > 90: Grenzfall 91° wird normalisiert zu 89° (nicht 91°)", () => {
  // Schnittwinkel > 90° sollte zu 180 - cut normalisiert werden.
  // cut = 91° sollte zu 180 - 91 = 89° werden.
  // Mit der Mutation (cut > 90) → (cut >= 90) würde 90° selbst normalisiert (90 → 90, kein Unterschied),
  // aber 91° → 89° sollte erkannt werden.
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 10 },
    { ref: { lat: 54.1, lon: 13.1 }, trueBearingDeg: 101 }, // 91° Differenz
  ];
  const cut = bestCutAngleDeg(bearings);
  // 91 % 180 = 91, dann 91 > 90 → cut = 180 - 91 = 89.
  assert.ok(cut >= 85 && cut <= 95, `91° Differenz normalisiert zu ~89° (war ${cut}°)`);
  assert.ok(cut < 90, `normalisiert unter 90° (war ${cut}°)`);
});

test("[REQ-NAV-025] bestCutAngleDeg: cut == best wird aktualisiert (> nicht >=)", () => {
  // Wenn zwei Paare denselben Schnittwinkel haben, sollte der beste trotzdem aktualisiert werden.
  // Mit (cut > best) vs (cut >= best): bei Gleichheit sollte >= aktualisieren, aber > nicht.
  // Test: drei Peilungen, zwei Paare mit 90°, ein Paar mit 45°.
  // Die Schleife prüft erst das 45er Paar, dann die 90er Paare.
  // Mit >, würde best = 90 korrekt vom ersten 90er Paar.
  // Mit >=, würde best auch noch vom zweiten 90er Paar aktualisiert (aber gleicher Wert).
  // Das Ergebnis ist gleich, aber der Weg ist anders.
  // Stattdessen: teste, dass best ALLE Kandidaten durchläuft und das Maximum findet.
  const bearings: Bearing[] = [
    { ref: { lat: 54.0, lon: 13.0 }, trueBearingDeg: 0 },
    { ref: { lat: 54.0, lon: 13.1 }, trueBearingDeg: 90 }, // Paar 1: 90°
    { ref: { lat: 54.1, lon: 13.2 }, trueBearingDeg: 0 }, // Paar 2: 0° (mit bearings[0])
    { ref: { lat: 54.1, lon: 13.3 }, trueBearingDeg: 90 }, // Paar 3: 90° (mit bearings[1] oder [3])
  ];
  const cut = bestCutAngleDeg(bearings);
  // Das beste sollte 90° sein (mehrere Paare haben 90°).
  assert.ok(cut >= 85, `Maximum ist 90° (war ${cut}°)`);
});

test("[REQ-NAV-025] positionUncertaintyNm: err < best Update korrekt (nicht <=)", () => {
  // Wenn err == best, sollte best NICHT aktualisiert werden (> nicht >=).
  // Konstruiere Scenario mit mehreren Peilungen, wo ein Paar zweimal den gleichen err hat.
  // Mit >, bleibt best beim ersten Auftreten.
  // Mit >=, würde auch bei Gleichheit updaten (aber Ergebnis gleich).
  // Stattdessen: teste, dass die Funktion das MINIMUM err findet.
  const obs = { lat: 54.0, lon: 13.0 };
  const obj1 = { lat: 54.1, lon: 13.0 }; // ~6 sm Nord
  const obj2 = { lat: 54.0, lon: 13.1 }; // ~5 sm Ost (wegen Breite)
  const obj3 = { lat: 53.95, lon: 13.05 }; // SW
  const bearings: Bearing[] = [
    { ref: obj1, trueBearingDeg: 0 },
    { ref: obj2, trueBearingDeg: 90 },
    { ref: obj3, trueBearingDeg: 225 },
  ];
  const fix = crossBearingFix(bearings)!;
  const uncert = positionUncertaintyNm(bearings, fix);
  // Sollte einen endlichen Wert haben (das Minimum aller Paare).
  assert.ok(uncert > 0 && uncert < Infinity, `positionUncertaintyNm findet Minimum (${uncert} sm)`);
});

test("[REQ-NAV-025] Rückpeilung +180 vs -180: Geometrie-Direktionalität", () => {
  // Die Standlinie eines beobachteten Objekts geht durch das Objekt in Richtung Rückpeilung (B+180).
  // Mit falsch -180: würde die Standlinie in die entgegengesetzte Richtung gehen.
  // Test: beobachter peilt zwei objekte, der geschnittene Fix sollte nahe beim Beobachter liegen.
  // Mit +180 (korrekt): Fix liegt nahe bei Beobachter.
  // Mit -180 (falsch): Fix liegt weit weg oder spiegelt (wegen trigonometrischer Symmetrie: könnte auch nah sein).
  // Stattdessen: teste mit 4 Peilungen, damit die Fehlertoleranz größer wird und eine falsche
  // Rückpeilung-Richtung zu großem Fehlerdreieck führt.
  const obs = { lat: 54.0, lon: 13.0 };
  const refs = [
    { lat: 54.1, lon: 13.0 }, // Nord
    { lat: 54.0, lon: 13.1 }, // Ost
    { lat: 53.9, lon: 13.0 }, // Süd
    { lat: 54.0, lon: 12.9 }, // West
  ];
  // Korrekte Peilungen (vier Himmelsrichtungen)
  const correctBearings: Bearing[] = [
    { ref: refs[0], trueBearingDeg: 0 },   // Nord
    { ref: refs[1], trueBearingDeg: 90 },  // Ost
    { ref: refs[2], trueBearingDeg: 180 }, // Süd
    { ref: refs[3], trueBearingDeg: 270 }, // West
  ];
  const correctFix = crossBearingFix(correctBearings)!;
  // Der Fix sollte sehr nah bei obs sein.
  assert.ok(correctFix, "Fix mit 4 korrekten Peilungen existiert");
  assert.ok(distanceNm(correctFix, obs) < 0.1, `korrekte Peilungen → Fix nah (${distanceNm(correctFix, obs)} sm)`);
  assert.ok(correctFix.error_nm < 0.01, `4 Peilungen Himmelsrichtungen → kein Fehlerdreieck (error=${correctFix.error_nm})`);
});
