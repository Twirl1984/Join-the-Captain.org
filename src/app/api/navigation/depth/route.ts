import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";
import { fetchDepth, flachwasserCheck } from "@/lib/navigation/depth";

export const runtime = "nodejs";

// Tiefen ändern sich nicht — großzügig cachen (24 h) schont EMODnet/GEBCO.
const REVALIDATE_S = 86400;

// GET /api/navigation/depth?lat=..&lon=..[&tiefgang=1.8]
// → { depth_m, source, check? } — Tiefe am Punkt (EMODnet, Fallback GEBCO),
//   optional bewertet gegen den Bootstiefgang (gefahr/knapp/ok/unbekannt).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    return fehler("lat/lon: gültige Koordinaten nötig.");
  }
  // Tiefgang optional; unplausible Werte (z. B. 0 oder 30 m) ignorieren.
  const tiefgangRaw = Number(sp.get("tiefgang"));
  const tiefgang = Number.isFinite(tiefgangRaw) && tiefgangRaw > 0 && tiefgangRaw <= 20 ? tiefgangRaw : null;

  try {
    const d = await fetchDepth(lat, lon, {
      fetchImpl: (url) =>
        fetch(url, {
          // 8 s je Quelle — hängende Upstreams sollen den Worker nicht binden.
          signal: AbortSignal.timeout(8_000),
          next: { revalidate: REVALIDATE_S },
        } as RequestInit & { next?: { revalidate?: number } }),
    });
    return ok({
      ...d,
      check: tiefgang != null ? flachwasserCheck(d.depth_m, tiefgang) : undefined,
      hinweis: "Planungsdaten (EMODnet/GEBCO) — keine amtliche Seekarte.",
    });
  } catch (e) {
    console.error("navigation/depth:", e);
    return fehler("Tiefendaten gerade nicht verfügbar — bitte später erneut versuchen.", 502);
  }
}
