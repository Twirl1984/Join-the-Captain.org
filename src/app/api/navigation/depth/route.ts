import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { fetchDepth, flachwasserCheck } from "@/lib/navigation/depth";
import { navigationEnabled } from "@/lib/flags";
import { clientKey, createLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Tiefen ändern sich nicht — großzügig cachen (24 h) schont EMODnet/GEBCO.
const REVALIDATE_S = 86400;

// Abuse-Deckel: der Endpoint ist sonst ein ungebremstes Relay zu EMODnet/GEBCO.
// 120/min deckt den Auto-Check (bis 24 Punkte je Route) bequem ab.
const limiter = createLimiter({ limit: 120, windowMs: 60_000 });

// GET /api/navigation/depth?lat=..&lon=..[&tiefgang=1.8]
// → { depth_m, source, check? } — Tiefe am Punkt (EMODnet, Fallback GEBCO),
//   optional bewertet gegen den Bootstiefgang (gefahr/knapp/ok/unbekannt).
export async function GET(req: NextRequest) {
  if (!navigationEnabled()) return fehler("Navigation ist deaktiviert.", 404);
  const t0 = Date.now();
  if (!limiter.allow(clientKey(req.headers))) {
    return fehler("Zu viele Anfragen — bitte kurz warten.", 429);
  }
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    return fehler("lat/lon: gültige Koordinaten nötig.");
  }
  // Tiefgang optional; positive Werte werden auf max. 20 m GEKLEMMT statt
  // still ignoriert — sonst fehlte der check und die UI zeigte fälschlich
  // "keine kritischen Stellen" (Review-Finding #13).
  const tiefgangRaw = Number(sp.get("tiefgang"));
  const tiefgang =
    Number.isFinite(tiefgangRaw) && tiefgangRaw > 0 ? Math.min(20, tiefgangRaw) : null;

  try {
    const d = await fetchDepth(lat, lon, {
      fetchImpl: (url) =>
        fetch(url, {
          // 8 s je Quelle — hängende Upstreams sollen den Worker nicht binden.
          signal: AbortSignal.timeout(8_000),
          next: { revalidate: REVALIDATE_S },
        } as RequestInit & { next?: { revalidate?: number } }),
    });
    // Observability ohne Positionsdaten: nur Quelle, Latenz, Status.
    console.log(
      JSON.stringify({ evt: "nav.depth", status: 200, source: d.source, dauer_ms: Date.now() - t0 }),
    );
    return ok({
      ...d,
      check: tiefgang != null ? flachwasserCheck(d.depth_m, tiefgang) : undefined,
      hinweis: "Planungsdaten (EMODnet/GEBCO) — keine amtliche Seekarte.",
    });
  } catch (e) {
    console.error("navigation/depth:", e);
    console.log(JSON.stringify({ evt: "nav.depth", status: 502, dauer_ms: Date.now() - t0 }));
    return fehler("Tiefendaten gerade nicht verfügbar — bitte später erneut versuchen.", 502);
  }
}
