// Unit-Tests für die Routen-/ETA-Logik (polar.ts + route-forecast.ts).
// Reine Rechnung, kein Netz. Portiert aus jtc.de tests/unit/weather-route.test.mjs.
// Lauf:  node --import tsx --test src/lib/weather/__tests__/route-forecast.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { sailSpeed, motorSpeed, effectiveSpeed, twaFromCourse, DEFAULT_BOAT } from "../polar";
import { haversineNm, initialBearing, planRoute, type ForecastSample } from "../route-forecast";

const near = (actual: number, expected: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, msg ?? `${actual} ≉ ${expected} (±${tol})`);

test("polar: No-Go-Zone am Wind → 0 Knoten", () => {
  assert.equal(sailSpeed(15, 20), 0);
});

test("polar: Halbwind schneller als hart am Wind", () => {
  assert.ok(sailSpeed(15, 100) > sailSpeed(15, 45));
});

test("polar: Rumpfgeschwindigkeit kappt bei viel Wind", () => {
  assert.ok(sailSpeed(40, 100) <= DEFAULT_BOAT.hull_speed_kn);
});

test("polar: effectiveSpeed schaltet bei Flaute/am-Wind auf Motor", () => {
  const r = effectiveSpeed({ twsKn: 3, twaDeg: 30, mode: "sail" });
  assert.equal(r.mode, "motor");
  assert.equal(r.speed_kn, motorSpeed());
});

test("polar: mode=motor ignoriert Wind", () => {
  assert.equal(effectiveSpeed({ twsKn: 25, twaDeg: 100, mode: "motor" }).speed_kn, motorSpeed());
});

test("polar: twaFromCourse faltet auf 0..180", () => {
  assert.equal(twaFromCourse(0, 180), 180);
  assert.equal(twaFromCourse(0, 10), 10);
  assert.equal(twaFromCourse(350, 10), 20);
});

test("geometrie: ~1 Breitenminute ≈ 1 sm", () => {
  const d = haversineNm({ lat: 54.0, lon: 13.0 }, { lat: 54.0 + 1 / 60, lon: 13.0 });
  near(d, 1, 0.02);
});

test("geometrie: bearing Nord ≈ 0°, Ost ≈ 90°", () => {
  near(initialBearing({ lat: 54, lon: 13 }, { lat: 55, lon: 13 }), 0, 0.5);
  near(initialBearing({ lat: 54, lon: 13 }, { lat: 54, lon: 14 }), 90, 2);
});

const calm = (): ForecastSample => ({ wind_speed_kn: 12, wind_from_deg: 270, wave_height_m: 0.4 });

test("planRoute: zwei Wegpunkte → ein Leg, plausible ETA", () => {
  const r = planRoute({
    waypoints: [
      { lat: 54.679, lon: 13.432, name: "Arkona" },
      { lat: 54.879, lon: 13.432, name: "Nord" },
    ],
    startTime: "2025-07-01T08:00:00Z",
    mode: "sail",
    sampleForecast: calm,
  });
  assert.equal(r.legs.length, 1);
  assert.ok(r.total_nm > 11);
  assert.ok(new Date(r.eta).getTime() > Date.parse("2025-07-01T08:00:00Z"));
  assert.ok((r.legs[0].duration_h ?? 0) > 0);
});

test("planRoute: Sturm-/Gewitter-Sample erzeugt Warnung", () => {
  const stormy = (): ForecastSample => ({
    wind_speed_kn: 38,
    wind_from_deg: 240,
    gust_kn: 45,
    thunderstorm: true,
  });
  const r = planRoute({
    waypoints: [
      { lat: 44.75, lon: 13.55 },
      { lat: 44.9, lon: 13.92, name: "Pula" },
    ],
    startTime: "2025-08-01T06:00:00Z",
    mode: "sail",
    sampleForecast: stormy,
  });
  assert.ok(r.warnings.some((w) => w.includes("Gewitter")));
  assert.ok(r.warnings.some((w) => w.includes("Sturm")));
});

test("planRoute: mehrere Wegpunkte → ETA wächst monoton, mode=motor durchgängig", () => {
  const r = planRoute({
    waypoints: [
      { lat: 43.5, lon: 16.4, name: "Split" },
      { lat: 43.3, lon: 16.3 },
      { lat: 43.06, lon: 16.26, name: "Vis" },
    ],
    startTime: "2025-08-10T07:00:00Z",
    mode: "motor",
    sampleForecast: calm,
  });
  assert.equal(r.legs.length, 2);
  assert.ok(Date.parse(r.legs[1].eta) > Date.parse(r.legs[0].eta));
  assert.ok(r.legs.every((l) => l.mode === "motor"));
});
