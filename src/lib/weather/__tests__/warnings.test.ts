// Unit-Tests für die einstellbare Unwetter-Klassifikation (warnings.ts).
// Lauf: node --import tsx --test src/lib/weather/__tests__/warnings.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  thresholdsFor,
  classify,
  activeWarnings,
  beaufort,
  stormSeverity,
  SEVERE_GUST_KN,
  DEFAULT_SENSITIVITY,
} from "../warnings";

const near = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test("Default-Sensitivität 0.5 trifft die etablierten MVP-Schwellen", () => {
  const t = thresholdsFor(DEFAULT_SENSITIVITY);
  near(t.gust_kn, 34);
  near(t.cape, 800);
  near(t.wave_m, 2.25);
});

test("Endpunkte: s=0 hohe Schwellen (risikofreudig), s=1 niedrige (vorsichtig)", () => {
  const lo = thresholdsFor(0);
  const hi = thresholdsFor(1);
  near(lo.gust_kn, 40);
  near(hi.gust_kn, 28);
  near(lo.cape, 1500);
  near(hi.cape, 100);
});

test("höhere Sensitivität senkt jede Schwelle monoton", () => {
  let prevG = Infinity;
  let prevC = Infinity;
  for (let s = 0; s <= 1.0001; s += 0.1) {
    const t = thresholdsFor(s);
    assert.ok(t.gust_kn <= prevG + 1e-9, `gust nicht monoton bei s=${s}`);
    assert.ok(t.cape <= prevC + 1e-9, `cape nicht monoton bei s=${s}`);
    prevG = t.gust_kn;
    prevC = t.cape;
  }
});

test("sensitivity wird auf [0,1] geklemmt", () => {
  assert.deepEqual(thresholdsFor(-3), thresholdsFor(0));
  assert.deepEqual(thresholdsFor(9), thresholdsFor(1));
});

test("Grenzfall Böe 36 kn: warnt bei vorsichtig, schweigt bei risikofreudig", () => {
  const m = { gust_kn: 36 };
  assert.equal(classify(m, 0).sturm, false); // Schwelle 40 → kein Alarm
  assert.equal(classify(m, 1).sturm, true); // Schwelle 28 → Alarm
});

test("classify nutzt wind_speed_kn als Fallback ohne Böen", () => {
  assert.equal(classify({ wind_speed_kn: 45 }, DEFAULT_SENSITIVITY).sturm, true);
});

test("activeWarnings listet alle ausgelösten Arten", () => {
  const kinds = activeWarnings({ gust_kn: 50, cape: 2000, wave_height_m: 4 }, 0.5);
  assert.deepEqual(kinds.sort(), ["gewitter", "sturm", "welle"]);
  assert.deepEqual(activeWarnings({ gust_kn: 5, cape: 0, wave_height_m: 0.2 }, 0.5), []);
});

test("beaufort: kn korrekt auf Bft-Stufen abgebildet", () => {
  assert.equal(beaufort(0.5), 0);
  assert.equal(beaufort(34), 8);
  assert.equal(beaufort(45), 9);
  assert.equal(beaufort(48), 10);
  assert.equal(beaufort(64), 12);
});

test("stormSeverity: Label & severe-Flag", () => {
  assert.equal(stormSeverity(25).label, "starker Wind");
  assert.equal(stormSeverity(36).label, "Sturm");
  assert.equal(stormSeverity(50).label, "schwerer Sturm");
  assert.equal(stormSeverity(SEVERE_GUST_KN).severe, true);
  assert.equal(stormSeverity(SEVERE_GUST_KN - 1).severe, false);
});

test("Sicherheits-Floor: schwerer Sturm warnt auch bei risikofreudigstem Regler", () => {
  // s=0 (Schwelle 40 kn): eine 48-kn-Bö muss trotzdem als Sturm warnen.
  assert.equal(classify({ gust_kn: SEVERE_GUST_KN + 1 }, 0).sturm, true);
});
