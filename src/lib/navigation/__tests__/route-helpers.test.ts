// Unit-Tests für route-helpers.ts (Wegpunkt-Expansion über Wasser) — TDD.
// Lauf: node --import tsx --test src/lib/navigation/__tests__/route-helpers.test.ts
//
// expandWaypointsOverWater nimmt die vom Nutzer geklickten Wegpunkte und
// ersetzt jede Teilstrecke durch den Wasserweg aus searoute.ts. Ohne Maske
// (Binnensee) bleibt die Luftlinie — ehrlich gekennzeichnet, nie stillschweigend.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMask, type Bbox } from "../watermask";
import { expandWaypointsOverWater } from "../route-helpers";

const BBOX: Bbox = [54, 10, 55, 12];
const N = 40;

// Wand bei lon 11 mit Lücke (54.45..54.55) — erzwingt Umweg.
const wallMask = createMask(BBOX, N, 2 * N, (lat, lon) =>
  !(Math.abs(lon - 11.0) < 0.06 && !(lat > 54.45 && lat < 54.55)),
);

test("offenes Wasser: Expansion ändert nichts außer Status", () => {
  const open = createMask(BBOX, N, 2 * N, () => true);
  const wps = [
    { lat: 54.3, lon: 10.4, name: "A" },
    { lat: 54.7, lon: 11.6, name: "B" },
  ];
  const r = expandWaypointsOverWater(open, wps);
  assert.equal(r.status, "ok");
  assert.equal(r.points.length, 2);
  assert.equal(r.points[0].name, "A");
  assert.equal(r.points[1].name, "B");
  assert.deepEqual(r.segments, [{ from: 0, to: 1, routing: "wasserweg" }]);
});

test("Umweg: Zwischenpunkte werden eingefügt, Namen/Liegezeiten bleiben am Original", () => {
  const wps = [
    { lat: 54.8, lon: 10.3, name: "Start", depart_at: "2026-07-10T08:00:00.000Z" },
    { lat: 54.8, lon: 11.7, name: "Ziel" },
  ];
  const r = expandWaypointsOverWater(wallMask, wps);
  assert.equal(r.status, "ok");
  assert.ok(r.points.length > 2, "Zwischenpunkte fehlen");
  assert.equal(r.points[0].name, "Start");
  assert.equal(r.points[0].depart_at, "2026-07-10T08:00:00.000Z");
  assert.equal(r.points[r.points.length - 1].name, "Ziel");
  // Zwischenpunkte tragen weder Namen noch Liegezeiten.
  for (const p of r.points.slice(1, -1)) {
    assert.equal(p.name, undefined);
    assert.equal(p.depart_at, undefined);
  }
});

test("drei Wegpunkte: Segment-Metadaten zeigen je Teilstrecke das Routing", () => {
  const wps = [
    { lat: 54.8, lon: 10.3 },
    { lat: 54.8, lon: 11.7 },
    { lat: 54.6, lon: 11.7 },
  ];
  const r = expandWaypointsOverWater(wallMask, wps);
  assert.equal(r.status, "ok");
  assert.equal(r.segments.length, 2);
  for (const s of r.segments) assert.equal(s.routing, "wasserweg");
  // Segment-Indizes zeigen in die expandierte Punktliste.
  assert.equal(r.segments[0].from, 0);
  assert.equal(r.segments[1].to, r.points.length - 1);
});

test("ohne Maske: Luftlinie, ehrlich als solche markiert", () => {
  const wps = [
    { lat: 54.8, lon: 10.3, name: "A" },
    { lat: 54.8, lon: 11.7, name: "B" },
  ];
  const r = expandWaypointsOverWater(null, wps);
  assert.equal(r.status, "ok");
  assert.equal(r.points.length, 2);
  assert.deepEqual(r.segments, [{ from: 0, to: 1, routing: "luftlinie" }]);
});

test("Wegpunkt außerhalb der Maske: dieses Segment wird Luftlinie, Rest Wasserweg", () => {
  const wps = [
    { lat: 55.5, lon: 11.0, name: "draußen" }, // außerhalb bbox
    { lat: 54.8, lon: 10.3 },
    { lat: 54.8, lon: 11.7 },
  ];
  const r = expandWaypointsOverWater(wallMask, wps);
  assert.equal(r.status, "ok");
  assert.equal(r.segments[0].routing, "luftlinie");
  assert.equal(r.segments[1].routing, "wasserweg");
});

test("unerreichbares Ziel: status unreachable mit Segment-Index", () => {
  const solid = createMask(BBOX, N, 2 * N, (_lat, lon) => Math.abs(lon - 11.0) > 0.06);
  const r = expandWaypointsOverWater(solid, [
    { lat: 54.5, lon: 10.3, name: "West" },
    { lat: 54.5, lon: 11.7, name: "Ost" },
  ]);
  assert.equal(r.status, "unreachable");
  assert.equal(r.failedSegment, 0);
});

test("Punkte-Deckel: sehr gewundene Route wird ausgedünnt, Endpunkte bleiben", () => {
  // Kamm-Labyrinth erzwingt viele Zwischenpunkte.
  const comb = createMask(BBOX, N, 2 * N, (lat, lon) => {
    const k = Math.round((lon - 10) / 0.2);
    if (k < 1 || k > 9 || Math.abs(lon - (10 + k * 0.2)) > 0.03) return true;
    return k % 2 === 0 ? lat > 54.85 : lat < 54.15;
  });
  const wps = [
    { lat: 54.5, lon: 10.05, name: "A" },
    { lat: 54.5, lon: 11.95, name: "B" },
  ];
  const r = expandWaypointsOverWater(comb, wps, { maxPointsPerSegment: 6 });
  assert.equal(r.status, "ok");
  assert.ok(r.points.length <= 8, `zu viele Punkte: ${r.points.length}`);
  assert.equal(r.points[0].name, "A");
  assert.equal(r.points[r.points.length - 1].name, "B");
});
