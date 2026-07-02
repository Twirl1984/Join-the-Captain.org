// Integrationstest: buildSampler gegen die ECHTE Open-Meteo-API.
// Standardmäßig übersprungen (Netz nötig). Aktivieren mit JTC_WEATHER_LIVE=1:
//   JTC_WEATHER_LIVE=1 node --import tsx --test src/lib/weather/__tests__/open-meteo.integration.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSampler } from "../open-meteo";

const LIVE = process.env.JTC_WEATHER_LIVE === "1";

test("buildSampler holt echte Daten und liefert plausible Werte", { skip: !LIVE }, async () => {
  const sampler = await buildSampler([{ lat: 54.68, lon: 13.43 }], { sensitivity: 0.75 });
  const s = sampler({ lat: 54.68, lon: 13.43, at: new Date(Date.now() + 6 * 3600e3) });
  assert.ok(Number.isFinite(s.wind_speed_kn) && s.wind_speed_kn >= 0 && s.wind_speed_kn < 200, "Wind plausibel");
  assert.ok(s.wind_from_deg >= 0 && s.wind_from_deg <= 360, "Windrichtung 0..360");
  assert.equal(typeof s.gale, "boolean");
  assert.equal(typeof s.thunderstorm, "boolean");
});

test("Multi-Location: mehrere Punkte in einem Request", { skip: !LIVE }, async () => {
  const sampler = await buildSampler(
    [
      { lat: 54.68, lon: 13.43 },
      { lat: 43.5, lon: 16.43 },
    ],
    { sensitivity: 0.5 },
  );
  const ostsee = sampler({ lat: 54.68, lon: 13.43, at: new Date(Date.now() + 3 * 3600e3) });
  const split = sampler({ lat: 43.5, lon: 16.43, at: new Date(Date.now() + 3 * 3600e3) });
  assert.ok(Number.isFinite(ostsee.wind_speed_kn));
  assert.ok(Number.isFinite(split.wind_speed_kn));
});
