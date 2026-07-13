import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { buildSampler, parseModel, type TimeWindow } from "@/lib/weather/open-meteo";
import { parseSensitivity } from "@/lib/weather/api-helpers";
import { clientKey, createLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Aktuelle Bedingungen an EINEM Punkt („Jetzt & hier", REQ-NAV-024). Bewusst
// getrennt von /timeline (die braucht eine Route mit ≥2 Wegpunkten).
const limiter = createLimiter({ limit: 120, windowMs: 60_000 });

// GET /api/weather/now?lat=..&lon=..[&model=..&sensitivity=..]
// → { wind_kn, gust_kn, wind_from_deg, wave_m, current_kn, current_to_deg,
//     tide_m, gale, thunderstorm, high_wave, at } — aktuelle Stunde am Ort.
export async function GET(req: NextRequest) {
  if (!limiter.allow(clientKey(req.headers))) {
    return fehler("Zu viele Anfragen — bitte kurz warten.", 429);
  }
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    return fehler("lat/lon: gültige Koordinaten nötig.");
  }
  const model = parseModel(sp.get("model"));
  const sensitivity = parseSensitivity(sp.get("sensitivity"));
  const now = new Date();
  const window: TimeWindow = { start: now, end: new Date(now.getTime() + 3 * 3600e3) };

  try {
    const sampler = await buildSampler([{ lat, lon }], { sensitivity, window, model });
    const wx = sampler({ lat, lon, at: now });
    return ok({
      at: now.toISOString(),
      wind_kn: Math.round(wx.wind_speed_kn * 10) / 10,
      gust_kn: Math.round((wx.gust_kn ?? wx.wind_speed_kn) * 10) / 10,
      wind_from_deg: Math.round(wx.wind_from_deg),
      wave_m: wx.wave_height_m,
      current_kn: wx.current_kn,
      current_to_deg: wx.current_to_deg,
      tide_m: wx.tide_m,
      gale: wx.gale,
      thunderstorm: wx.thunderstorm,
      high_wave: wx.high_wave,
      hinweis: "Vorhersage (Open-Meteo) — Planungshilfe, keine amtliche Wetterwarnung.",
    });
  } catch (e) {
    console.error("weather/now:", e);
    return fehler("Wetterdaten gerade nicht verfügbar — bitte später erneut versuchen.", 502);
  }
}
