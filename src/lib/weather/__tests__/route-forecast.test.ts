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

test("[REQ-WET-001] planRoute: zwei Wegpunkte → ein Leg, plausible ETA", () => {
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

test("planRoute: Sturm-/Gewitter-/Wellen-Flags erzeugen Warnungen", () => {
  // route-forecast wertet die Flags aus, die der Sampler (warnings.classify)
  // setzt — hier direkt als Mock gesetzt.
  const stormy = (): ForecastSample => ({
    wind_speed_kn: 38,
    wind_from_deg: 240,
    gust_kn: 45,
    wave_height_m: 3.1,
    gale: true,
    thunderstorm: true,
    high_wave: true,
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
  assert.ok(r.warnings.some((w) => w.includes("Hohe Welle")));
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

// ── Strömung: Fahrt über Grund (SOG) ─────────────────────────────────────────

test("[REQ-WET-008] Schiebestrom verkürzt, Gegenstrom verlängert die Legdauer", () => {
  const wps = [
    { lat: 54.0, lon: 13.0, name: "A" },
    { lat: 55.0, lon: 13.0, name: "B" }, // Kurs ≈ 0° (Nord)
  ];
  const base = { wind_speed_kn: 12, wind_from_deg: 270, wave_height_m: 0.4 };
  const mit = (cur: number, to: number): (() => ForecastSample) => () => ({
    ...base, current_kn: cur, current_to_deg: to,
  });
  const ohne = planRoute({ waypoints: wps, startTime: "2026-07-06T08:00:00Z", mode: "motor", sampleForecast: () => base });
  const schiebt = planRoute({ waypoints: wps, startTime: "2026-07-06T08:00:00Z", mode: "motor", sampleForecast: mit(2, 0) }); // setzt nach Nord = mit uns
  const gegen = planRoute({ waypoints: wps, startTime: "2026-07-06T08:00:00Z", mode: "motor", sampleForecast: mit(2, 180) }); // setzt nach Süd = gegen uns
  assert.ok(schiebt.legs[0].duration_h! < ohne.legs[0].duration_h!, "Schiebestrom schneller");
  assert.ok(gegen.legs[0].duration_h! > ohne.legs[0].duration_h!, "Gegenstrom langsamer");
  assert.ok(schiebt.legs[0].sog_kn > ohne.legs[0].sog_kn);
  assert.equal(schiebt.legs[0].current_kn, 2);
});

test("Querstrom (90° zum Kurs) ändert die Dauer kaum", () => {
  const wps = [
    { lat: 54.0, lon: 13.0 },
    { lat: 55.0, lon: 13.0 },
  ];
  const base = { wind_speed_kn: 12, wind_from_deg: 270, wave_height_m: 0.4 };
  const ohne = planRoute({ waypoints: wps, startTime: "2026-07-06T08:00:00Z", mode: "motor", sampleForecast: () => base });
  const quer = planRoute({
    waypoints: wps, startTime: "2026-07-06T08:00:00Z", mode: "motor",
    sampleForecast: () => ({ ...base, current_kn: 2, current_to_deg: 90 }),
  });
  assert.ok(Math.abs(quer.legs[0].duration_h! - ohne.legs[0].duration_h!) < 0.15);
});

test("Extremer Gegenstrom: SOG bleibt ≥ 0.3 kn (kein Stillstand/Infinity)", () => {
  const wps = [
    { lat: 54.0, lon: 13.0 },
    { lat: 54.1, lon: 13.0 },
  ];
  const r = planRoute({
    waypoints: wps, startTime: "2026-07-06T08:00:00Z", mode: "motor",
    sampleForecast: () => ({ wind_speed_kn: 5, wind_from_deg: 0, current_kn: 12, current_to_deg: 180 }),
  });
  assert.ok(r.legs[0].sog_kn >= 0.3);
  assert.ok(Number.isFinite(r.legs[0].duration_h!));
});

// ── Kreuzen (REQ-NAV-011): Am-Wind-Kurs, beide Varianten ─────────────────────

import { beatVmgSpeed, boatFromSpecs, BOAT_PRESETS } from "../polar";

const gegenan = (): ForecastSample => ({ wind_speed_kn: 14, wind_from_deg: 0 }); // Kurs 0° = genau gegenan
const NORD = [
  { lat: 54.0, lon: 13.0, name: "A" },
  { lat: 54.5, lon: 13.0, name: "B" },
];

test("[REQ-NAV-011] beatVmgSpeed: positiv, aber langsamer als Halbwind-Fahrt", () => {
  const vmg = beatVmgSpeed(14);
  assert.ok(vmg > 0.5, `${vmg}`);
  assert.ok(vmg < sailSpeed(14, 100), "VMG < Halbwindfahrt");
});

test("[REQ-NAV-011] Jolle ohne Motor gegenan: Leg wird primär KREUZEN mit endlicher Dauer", () => {
  const jolle = boatFromSpecs(BOAT_PRESETS.find((p) => p.id === "jolle")!.specs);
  const r = planRoute({ waypoints: NORD, startTime: "2026-07-08T08:00:00Z", boat: jolle, mode: "sail", sampleForecast: gegenan });
  assert.equal(r.legs[0].mode, "kreuzen");
  assert.ok(Number.isFinite(r.legs[0].duration_h!) && r.legs[0].duration_h! > 0);
  assert.equal(r.legs[0].alternative, undefined); // kein Motor an Bord
});

test("[REQ-NAV-011] Yacht mit Motor gegenan: primär Motor, Alternative Kreuzen, Gesamt-Alternative gesetzt", () => {
  const r = planRoute({ waypoints: NORD, startTime: "2026-07-08T08:00:00Z", mode: "sail", sampleForecast: gegenan });
  assert.equal(r.legs[0].mode, "motor");
  assert.equal(r.legs[0].alternative?.mode, "kreuzen");
  assert.ok(r.legs[0].alternative!.duration_h > r.legs[0].duration_h!, "Kreuzen dauert länger als Motor");
  assert.ok(r.eta_alternative && Date.parse(r.eta_alternative) > Date.parse(r.eta));
});

test("[REQ-NAV-011] Halbwind-Kurs: kein Kreuzen, keine Alternative", () => {
  const halbwind = (): ForecastSample => ({ wind_speed_kn: 14, wind_from_deg: 90 });
  const r = planRoute({ waypoints: NORD, startTime: "2026-07-08T08:00:00Z", mode: "sail", sampleForecast: halbwind });
  assert.equal(r.legs[0].mode, "sail");
  assert.equal(r.legs[0].alternative, undefined);
  assert.equal(r.eta_alternative, undefined);
});

// ── Liegezeit als Dauer: stay_min (REQ-NAV-017) ──────────────────────────────

const stayWps = [
  { lat: 54, lon: 13, name: "A" },
  { lat: 54, lon: 13.2, name: "B" },
  { lat: 54, lon: 13.4, name: "C" },
];
const steadySampler = (): ForecastSample => ({ wind_speed_kn: 12, wind_from_deg: 0 });
const stayStart = new Date("2026-07-10T08:00:00Z");

test("[REQ-NAV-017] stay_min: Weiterfahrt = Ankunft + Dauer, layover_h gesetzt", () => {
  const base = planRoute({ waypoints: stayWps, startTime: stayStart, mode: "sail", sampleForecast: steadySampler });
  const r = planRoute({
    waypoints: [stayWps[0], { ...stayWps[1], stay_min: 150 }, stayWps[2]],
    startTime: stayStart,
    mode: "sail",
    sampleForecast: steadySampler,
  });
  near(r.legs[1].layover_h ?? 0, 2.5, 0.05, "layover_h = 2,5 h");
  const depart = new Date(r.legs[1].depart).getTime();
  const arrival = new Date(base.legs[0].eta).getTime();
  near((depart - arrival) / 3600e3, 2.5, 0.02, "Weiterfahrt exakt 2,5 h nach Ankunft");
});

test("[REQ-NAV-017] stay_min + depart_at: der spätere Zeitpunkt gewinnt (konservativ)", () => {
  const base = planRoute({ waypoints: stayWps, startTime: stayStart, mode: "sail", sampleForecast: steadySampler });
  const arrival = new Date(base.legs[0].eta).getTime();
  // depart_at NACH der Liegedauer → depart_at gewinnt
  const late = planRoute({
    waypoints: [stayWps[0], { ...stayWps[1], stay_min: 60, depart_at: new Date(arrival + 3 * 3600e3) }, stayWps[2]],
    startTime: stayStart, mode: "sail", sampleForecast: steadySampler,
  });
  near(new Date(late.legs[1].depart).getTime(), arrival + 3 * 3600e3, 1000);
  // depart_at VOR Ablauf der Liegedauer → stay_min gewinnt
  const early = planRoute({
    waypoints: [stayWps[0], { ...stayWps[1], stay_min: 180, depart_at: new Date(arrival + 3600e3) }, stayWps[2]],
    startTime: stayStart, mode: "sail", sampleForecast: steadySampler,
  });
  near(new Date(early.legs[1].depart).getTime(), arrival + 3 * 3600e3, 1000);
});

test("[REQ-NAV-017] stay_min 0/undefined: kein Layover, ETA unverändert", () => {
  const base = planRoute({ waypoints: stayWps, startTime: stayStart, mode: "sail", sampleForecast: steadySampler });
  const zero = planRoute({
    waypoints: [stayWps[0], { ...stayWps[1], stay_min: 0 }, stayWps[2]],
    startTime: stayStart, mode: "sail", sampleForecast: steadySampler,
  });
  assert.equal(zero.legs[1].layover_h, null);
  assert.equal(zero.eta, base.eta);
});
