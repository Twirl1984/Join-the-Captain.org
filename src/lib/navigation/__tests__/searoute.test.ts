// Unit-Tests für den Land-Vermeidungs-Router (searoute.ts) — TDD: zuerst geschrieben.
// Lauf: node --import tsx --test src/lib/navigation/__tests__/searoute.test.ts
//
// A* über der Wassermaske + Sichtlinien-Glättung. Getestet mit synthetischen
// Masken (Wand mit Lücke, Insel, getrennte Becken) — die Route darf NIE über
// Land führen, auch nicht nach der Glättung.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMask, isWaterAt, type Bbox } from "../watermask";
import { findSeaRoute, segmentInWater } from "../searoute";

const BBOX: Bbox = [54, 10, 55, 12]; // 1° x 2°, Ostsee-artig
const N = 40; // Gitter 40x80 — fein genug für die Szenarien

/** Prüft, dass jedes Teilstück der Route komplett im Wasser liegt. */
function assertAllWater(mask: ReturnType<typeof createMask>, pts: Array<{ lat: number; lon: number }>) {
  for (let i = 0; i < pts.length - 1; i++) {
    assert.ok(
      segmentInWater(mask, pts[i], pts[i + 1]),
      `Segment ${i} (${pts[i].lat},${pts[i].lon}) -> (${pts[i + 1].lat},${pts[i + 1].lon}) schneidet Land`,
    );
  }
}

test("offenes Wasser: Route ist (nach Glättung) die direkte Linie", () => {
  const mask = createMask(BBOX, N, 2 * N, () => true);
  const from = { lat: 54.2, lon: 10.3 };
  const to = { lat: 54.8, lon: 11.7 };
  const r = findSeaRoute(mask, from, to);
  assert.equal(r.status, "ok");
  assert.equal(r.points.length, 2, `erwartet direkte Linie, bekam ${r.points.length} Punkte`);
  assert.deepEqual(r.points[0], from);
  assert.deepEqual(r.points[r.points.length - 1], to);
  assert.ok(r.distance_nm! > 0);
});

test("Nord-Süd-Wand mit Lücke: Route weicht durch die Lücke aus, nie über Land", () => {
  // Land-Wand bei lon ~11.0, Lücke zwischen lat 54.45 und 54.55.
  const wall = (lat: number, lon: number) =>
    !(Math.abs(lon - 11.0) < 0.06 && !(lat > 54.45 && lat < 54.55));
  const mask = createMask(BBOX, N, 2 * N, wall);
  const from = { lat: 54.8, lon: 10.3 };
  const to = { lat: 54.8, lon: 11.7 };
  const r = findSeaRoute(mask, from, to);
  assert.equal(r.status, "ok");
  assert.ok(r.points.length > 2, "Umweg muss Zwischenpunkte erzeugen");
  assertAllWater(mask, r.points);
  // Die Route muss die Lücke passieren: irgendein Punkt nahe der Wand-Längsachse
  // liegt im Lücken-Breitenband.
  const nearWall = r.points.filter((p) => Math.abs(p.lon - 11.0) < 0.12);
  assert.ok(nearWall.length >= 1, "kein Punkt im Wandbereich");
  for (const p of nearWall) {
    assert.ok(p.lat > 54.4 && p.lat < 54.6, `Wanddurchquerung außerhalb der Lücke: ${p.lat}`);
  }
  // Umweg ist länger als Luftlinie.
  assert.ok(r.distance_nm! > 48, `Distanz ${r.distance_nm} sm unplausibel klein`);
});

test("[REQ-NAV-001] Insel im Weg: Route führt außen herum", () => {
  const island = (lat: number, lon: number) =>
    !(Math.abs(lat - 54.5) < 0.15 && Math.abs(lon - 11.0) < 0.3);
  const mask = createMask(BBOX, N, 2 * N, island);
  const from = { lat: 54.5, lon: 10.2 };
  const to = { lat: 54.5, lon: 11.8 };
  const r = findSeaRoute(mask, from, to);
  assert.equal(r.status, "ok");
  assertAllWater(mask, r.points);
});

test("getrennte Becken: unreachable statt Route durch Land", () => {
  // Durchgehende Wand ohne Lücke.
  const solid = (_lat: number, lon: number) => Math.abs(lon - 11.0) > 0.06;
  const mask = createMask(BBOX, N, 2 * N, solid);
  const r = findSeaRoute(mask, { lat: 54.5, lon: 10.3 }, { lat: 54.5, lon: 11.7 });
  assert.equal(r.status, "unreachable");
});

test("Start/Ziel außerhalb der bbox -> outside", () => {
  const mask = createMask(BBOX, N, 2 * N, () => true);
  assert.equal(findSeaRoute(mask, { lat: 53, lon: 10.5 }, { lat: 54.5, lon: 11 }).status, "outside");
  assert.equal(findSeaRoute(mask, { lat: 54.5, lon: 11 }, { lat: 56, lon: 11 }).status, "outside");
});

test("[REQ-NAV-002] Wegpunkt knapp an Land (Hafen!): wird auf nächste Wasserzelle gesnappt", () => {
  // Landstreifen am Westrand; Start liegt IM Landstreifen (wie ein Hafen an der Mole).
  const mask = createMask(BBOX, N, 2 * N, (_lat, lon) => lon > 10.2);
  const from = { lat: 54.5, lon: 10.19 }; // Land, aber direkt an der Wasserkante
  const to = { lat: 54.5, lon: 11.5 };
  const r = findSeaRoute(mask, from, to);
  assert.equal(r.status, "ok");
  // Erster Punkt bleibt der Original-Start (der Nutzer will AB Hafen planen) …
  assert.deepEqual(r.points[0], from);
  // … aber ab dem zweiten Punkt ist alles im Wasser.
  assertAllWater(mask, r.points.slice(1));
});

test("Snap-Radius ist physisch (~1.5 km), nicht zellenzahl-abhängig", () => {
  // Feines Gitter (Zelle ~250 m): ein Hafen 1 km neben dem groben See-Polygon
  // muss trotzdem anschnappen — bei zellenbasiertem Radius (3 Zellen = 750 m)
  // wäre er fälschlich "unreachable" (realer Fund: Ramsberg/Brombachsee).
  const bboxKlein: Bbox = [49.1, 10.85, 49.19, 10.99]; // ~10 km hoch
  const fein = createMask(bboxKlein, 40, 40, (lat, lon) => lat < 49.14 && lon < 10.93);
  const hafen = { lat: 49.149, lon: 10.92 }; // ~1 km nördlich der Wasserkante
  const ziel = { lat: 49.12, lon: 10.88 };
  const r = findSeaRoute(fein, hafen, ziel);
  assert.equal(r.status, "ok", "1 km Hafen-Versatz muss anschnappen");
  // Aber: >2 km Abstand bleibt unreachable (kein wildes Snappen).
  const weitWeg = { lat: 49.185, lon: 10.98 };
  assert.equal(findSeaRoute(fein, weitWeg, ziel).status, "unreachable");
});

test("[REQ-NAV-002] Start tief im Landesinneren: unreachable (kein wildes Snappen)", () => {
  const mask = createMask(BBOX, N, 2 * N, (_lat, lon) => lon > 11.5);
  const r = findSeaRoute(mask, { lat: 54.5, lon: 10.3 }, { lat: 54.5, lon: 11.8 });
  assert.equal(r.status, "unreachable");
});

test("Start == Ziel: triviale Route ohne Absturz", () => {
  const mask = createMask(BBOX, N, 2 * N, () => true);
  const p = { lat: 54.5, lon: 11 };
  const r = findSeaRoute(mask, p, p);
  assert.equal(r.status, "ok");
  assert.ok(r.points.length >= 1);
  assert.equal(r.distance_nm, 0);
});

test("segmentInWater: Ecken-Schnitt einer einzelnen Landzelle wird erkannt (Supercover)", () => {
  // Adversarial-Review-Repro: Ein Segment quert die ECKE einer Landzelle mit
  // einer Sehne kürzer als der Abtastschritt — punktweises Sampling übersah
  // das (3 False-Positives im Repro). Der Traversal muss JEDE berührte Zelle
  // prüfen, nicht nur Interpolationspunkte.
  const bbox10: Bbox = [0, 0, 10, 10];
  // Genau eine Landzelle: lat [4,5) x lon [4,5) (row 4, col 4 im 10x10-Gitter).
  const single = createMask(bbox10, 10, 10, (lat, lon) => !(lat >= 4 && lat < 5 && lon >= 4 && lon < 5));
  assert.ok(!isWaterAt(single, 4.5, 4.5), "Sanity: Landzelle");
  // Diagonale, die nur die Ecke (5,5) der Landzelle knapp schneidet
  // (Sehne ~0.28 Zellbreiten): von (5.5, 4.3) nach (4.3, 5.5).
  assert.ok(
    !segmentInWater(single, { lat: 5.5, lon: 4.3 }, { lat: 4.3, lon: 5.5 }),
    "Ecken-Schnitt muss als Landquerung erkannt werden",
  );
  // Gegensicherung: knapp AUSSERHALB der Ecke vorbei ist weiter erlaubt.
  assert.ok(
    segmentInWater(single, { lat: 6.2, lon: 4.3 }, { lat: 4.3, lon: 6.2 }),
    "Vorbeifahrt außerhalb der Zelle bleibt Wasser",
  );
});

test("segmentInWater: exakter Eck-Durchgang zwischen zwei diagonalen Landzellen ist gesperrt", () => {
  // Zwei Landzellen, die sich nur an einer Ecke berühren — dazwischen darf
  // keine Route \"hindurchschlüpfen\" (gleiche Regel wie der A*-Diagonalschutz).
  const bbox10: Bbox = [0, 0, 10, 10];
  const twoCells = createMask(
    bbox10,
    10,
    10,
    (lat, lon) => !((lat >= 4 && lat < 5 && lon >= 4 && lon < 5) || (lat >= 5 && lat < 6 && lon >= 5 && lon < 6)),
  );
  assert.ok(
    !segmentInWater(twoCells, { lat: 5.5, lon: 4.5 }, { lat: 4.5, lon: 5.5 }),
    "Diagonale exakt durch die gemeinsame Ecke muss gesperrt sein",
  );
});

test("segmentInWater: erkennt Landquerung auch zwischen Zellzentren", () => {
  const mask = createMask(BBOX, N, 2 * N, (_lat, lon) => Math.abs(lon - 11.0) > 0.06);
  assert.ok(segmentInWater(mask, { lat: 54.5, lon: 10.4 }, { lat: 54.5, lon: 10.8 }));
  assert.ok(!segmentInWater(mask, { lat: 54.5, lon: 10.4 }, { lat: 54.5, lon: 11.6 }));
  assert.ok(!isWaterAt(mask, 54.5, 11.0), "Sanity: Wand ist Land");
});

test("Glättung schneidet nie eine konkave Bucht ab", () => {
  // U-förmige Bucht: Land im Süden mit U-Öffnung nach Norden; Route von West nach Ost
  // südlich der U-Arme muss außen um die Arme herum (nicht durchs U-Innere schneiden).
  const uShape = (lat: number, lon: number) => {
    const inLeftArm = Math.abs(lon - 10.8) < 0.05 && lat < 54.6;
    const inRightArm = Math.abs(lon - 11.2) < 0.05 && lat < 54.6;
    const inBottom = lat < 54.25 && lon > 10.75 && lon < 11.25;
    return !(inLeftArm || inRightArm || inBottom);
  };
  const mask = createMask(BBOX, N, 2 * N, uShape);
  const from = { lat: 54.15, lon: 10.4 };
  const to = { lat: 54.15, lon: 11.6 };
  const r = findSeaRoute(mask, from, to);
  assert.equal(r.status, "ok");
  assertAllWater(mask, r.points);
});
