// Unit-Tests: Bootsposition-Interpolation fürs Playback (playback.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { boatPositionAt } from "../playback";
import type { RouteLeg, Waypoint } from "../route-forecast";

const wps: Waypoint[] = [
  { lat: 54.0, lon: 13.0, name: "A" },
  { lat: 55.0, lon: 13.0, name: "B" },
  { lat: 55.0, lon: 14.0, name: "C" },
];
// Leg 1: 08–12 Uhr · Liegezeit bis 14 Uhr · Leg 2: 14–18 Uhr
const leg = (i: number, from: string, to: string, dep: string, eta: string, layover: number | null): RouteLeg => ({
  leg: i, from, to, distance_nm: 60, course_deg: 0, mode: "sail", speed_kn: 6,
  sog_kn: 6, current_kn: null, current_to_deg: null,
  wind_kn: 10, gust_kn: 14, wind_from_deg: 270, wave_m: 0.5,
  depart: dep, layover_h: layover, eta, duration_h: 4, warnings: [],
});
const legs: RouteLeg[] = [
  leg(1, "A", "B", "2026-07-04T08:00:00.000Z", "2026-07-04T12:00:00.000Z", null),
  leg(2, "B", "C", "2026-07-04T14:00:00.000Z", "2026-07-04T18:00:00.000Z", 2),
];

test("vor Abfahrt: Boot am Startpunkt", () => {
  const p = boatPositionAt(wps, legs, Date.parse("2026-07-04T06:00:00Z"));
  assert.deepEqual([p.lat, p.lon, p.legIndex], [54.0, 13.0, -1]);
});

test("[REQ-WET-010] Mitte von Leg 1: halber Weg zwischen A und B", () => {
  const p = boatPositionAt(wps, legs, Date.parse("2026-07-04T10:00:00Z"));
  assert.ok(Math.abs(p.lat - 54.5) < 1e-9);
  assert.equal(p.legIndex, 0);
});

test("Liegezeit (13 Uhr): Boot liegt am Zwischen-Wegpunkt B", () => {
  const p = boatPositionAt(wps, legs, Date.parse("2026-07-04T13:00:00Z"));
  assert.deepEqual([p.lat, p.lon, p.legIndex], [55.0, 13.0, 1]);
});

test("Mitte von Leg 2: halber Weg zwischen B und C", () => {
  const p = boatPositionAt(wps, legs, Date.parse("2026-07-04T16:00:00Z"));
  assert.ok(Math.abs(p.lon - 13.5) < 1e-9);
});

test("nach Ankunft: Boot am Ziel", () => {
  const p = boatPositionAt(wps, legs, Date.parse("2026-07-04T22:00:00Z"));
  assert.deepEqual([p.lat, p.lon], [55.0, 14.0]);
});
