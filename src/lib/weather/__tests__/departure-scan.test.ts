// Unit-Tests: Abfahrts-Empfehlung (departure-scan.ts) + Liegezeiten +
// Bootsdaten-Ableitung (polar.ts BoatSpecs). Reine Rechnung, kein Netz.
// Lauf: node --import tsx --test src/lib/weather/__tests__/departure-scan.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanDepartures } from "../departure-scan";
import { planRoute, type ForecastSample } from "../route-forecast";
import { boatFromSpecs, hullSpeedKn, motorCruiseFromPower, DEFAULT_BOAT } from "../polar";

// ── Bootsdaten → Geschwindigkeit ─────────────────────────────────────────────

test("hullSpeedKn: 10 m Wasserlinie ≈ 7.7 kn", () => {
  const v = hullSpeedKn(10);
  assert.ok(v > 7.5 && v < 7.9, `${v}`);
});

test("motorCruiseFromPower: 40 PS / 8 t / 10 m ≈ Charterboot-Marschfahrt", () => {
  const v = motorCruiseFromPower(40, 8, 10);
  assert.ok(v > 6 && v < 7, `${v}`); // ~6.5 kn plausibel
});

test("motorCruiseFromPower: schwacher Motor fährt deutlich langsamer", () => {
  const stark = motorCruiseFromPower(40, 8, 10);
  const schwach = motorCruiseFromPower(10, 8, 10);
  assert.ok(schwach < stark, `${schwach} < ${stark}`);
  assert.ok(schwach > 3, `${schwach} noch plausibel`);
});

test("boatFromSpecs: direkte Marschfahrt gewinnt gegen PS-Ableitung", () => {
  const b = boatFromSpecs({ length_waterline_m: 10, displacement_t: 8, engine_hp: 40, cruise_speed_motor_kn: 5 });
  assert.equal(b.cruise_speed_motor_kn, 5);
});

test("boatFromSpecs: ohne Angaben = Default-Charterboot", () => {
  assert.deepEqual(boatFromSpecs({}), { ...DEFAULT_BOAT, name: DEFAULT_BOAT.name });
});

test("boatFromSpecs: Marschfahrt nie über Rumpfgeschwindigkeit", () => {
  const b = boatFromSpecs({ length_waterline_m: 6, displacement_t: 1, engine_hp: 500 });
  assert.ok(b.cruise_speed_motor_kn <= b.hull_speed_kn);
});

// ── Liegezeiten (depart_at) ──────────────────────────────────────────────────

const calm = (): ForecastSample => ({ wind_speed_kn: 12, wind_from_deg: 270, wave_height_m: 0.4 });

test("planRoute: depart_at am Zwischenstopp erzeugt Liegezeit und schiebt die ETA", () => {
  const r = planRoute({
    waypoints: [
      { lat: 54.5, lon: 13.0, name: "Start" },
      // Ankunft hier ~13:00; Weiterfahrt erst am nächsten Morgen 08:00:
      { lat: 54.7, lon: 13.0, name: "Hafen", depart_at: "2026-07-05T08:00:00Z" },
      { lat: 54.9, lon: 13.0, name: "Ziel" },
    ],
    startTime: "2026-07-04T10:00:00Z",
    mode: "motor",
    sampleForecast: calm,
  });
  assert.equal(r.legs.length, 2);
  assert.ok((r.legs[1].layover_h ?? 0) > 10, `layover ${r.legs[1].layover_h}`);
  assert.equal(r.legs[1].depart, "2026-07-05T08:00:00.000Z");
  assert.ok(Date.parse(r.eta) > Date.parse("2026-07-05T08:00:00Z"));
});

test("planRoute: depart_at in der Vergangenheit der Ankunft ändert nichts", () => {
  const r = planRoute({
    waypoints: [
      { lat: 54.5, lon: 13.0 },
      { lat: 54.7, lon: 13.0, depart_at: "2026-07-04T00:00:00Z" }, // vor Ankunft
      { lat: 54.9, lon: 13.0 },
    ],
    startTime: "2026-07-04T10:00:00Z",
    mode: "motor",
    sampleForecast: calm,
  });
  assert.equal(r.legs[1].layover_h, null);
});

// ── Abfahrts-Empfehlung: das User-Szenario ───────────────────────────────────
// Charter ab Samstag. Samstag ab 12:00 zieht ein Gewitter+Sturm durch, ab
// Sonntag 06:00 ist es ruhig. Erwartung: Empfehlung = Sonntagmorgen.

const SA_12 = Date.parse("2026-07-04T12:00:00Z");
const SO_06 = Date.parse("2026-07-05T06:00:00Z");

const stormySaturday = ({ at }: { lat: number; lon: number; at: Date }): ForecastSample => {
  const t = at.getTime();
  if (t >= SA_12 && t < SO_06) {
    return { wind_speed_kn: 30, wind_from_deg: 240, gust_kn: 45, gale: true, thunderstorm: true, wave_height_m: 2.5 };
  }
  return { wind_speed_kn: 12, wind_from_deg: 270, gust_kn: 16, wave_height_m: 0.5 };
};

test("scanDepartures: empfiehlt Sonntagmorgen statt Samstag im Gewitter", () => {
  const scan = scanDepartures({
    waypoints: [
      { lat: 54.679, lon: 13.432, name: "Arkona" },
      { lat: 54.952, lon: 12.464, name: "Klintholm" },
    ],
    windowStart: new Date("2026-07-04T10:00:00Z"), // Samstag Vormittag
    windowEnd: new Date("2026-07-05T10:00:00Z"), // bis Sonntag Vormittag
    stepH: 2,
    mode: "sail",
    sampleForecast: stormySaturday,
  });
  assert.ok(scan.recommended, "Empfehlung vorhanden");
  const rec = new Date(scan.recommended!.departure).getTime();
  assert.ok(rec >= SO_06, `empfohlen ${scan.recommended!.departure} (erwartet: ab So 06:00)`);
  assert.equal(scan.recommended!.warnings.length, 0);
  assert.equal(scan.all_windy, false);
  // Samstag-Nachmittag-Slots sind als "meiden" markiert:
  const saNachmittag = scan.slots.filter((s) => {
    const t = new Date(s.departure).getTime();
    return t >= SA_12 && t < SO_06;
  });
  assert.ok(saNachmittag.length > 0);
  assert.ok(saNachmittag.every((s) => s.avoid), "Sturm-Slots als meiden markiert");
});

test("scanDepartures: all_windy, wenn es im ganzen Fenster stürmt", () => {
  const alwaysStormy = (): ForecastSample => ({
    wind_speed_kn: 35, wind_from_deg: 250, gust_kn: 48, gale: true, wave_height_m: 3,
  });
  const scan = scanDepartures({
    waypoints: [
      { lat: 54.679, lon: 13.432 },
      { lat: 54.952, lon: 12.464 },
    ],
    windowStart: new Date("2026-07-04T10:00:00Z"),
    windowEnd: new Date("2026-07-04T22:00:00Z"),
    stepH: 3,
    sampleForecast: alwaysStormy,
  });
  assert.equal(scan.all_windy, true);
  assert.ok(scan.recommended, "auch dann gibt es einen 'am wenigsten schlimmen' Slot");
});

test("scanDepartures: ruhigere Slots bekommen kleinere Scores (Monotonie im Score)", () => {
  const scan = scanDepartures({
    waypoints: [
      { lat: 54.679, lon: 13.432 },
      { lat: 54.952, lon: 12.464 },
    ],
    windowStart: new Date("2026-07-04T10:00:00Z"),
    windowEnd: new Date("2026-07-05T10:00:00Z"),
    stepH: 4,
    sampleForecast: stormySaturday,
  });
  const calmSlots = scan.slots.filter((s) => !s.avoid);
  const stormSlots = scan.slots.filter((s) => s.avoid);
  assert.ok(calmSlots.length && stormSlots.length);
  const maxCalm = Math.max(...calmSlots.map((s) => s.score));
  const minStorm = Math.min(...stormSlots.map((s) => s.score));
  assert.ok(maxCalm < minStorm, "jeder warnungsfreie Slot schlägt jeden Sturm-Slot");
});
