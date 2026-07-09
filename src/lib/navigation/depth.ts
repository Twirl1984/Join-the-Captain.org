// depth.ts — Wassertiefe an einem Punkt: EMODnet (Europa) mit GEBCO-Fallback.
//
// EMODnet Bathymetry REST liefert für POINT(lon lat) die mittlere Elevation
// (negativ = unter Seekartennull) in ~115 m Auflösung, CC-BY 4.0 — perfekt
// für europäische Reviere. Fällt EMODnet aus (oder außerhalb Europas), springt
// GEBCO (global, ~450 m) über die OpenTopoData-API ein.
//
// WICHTIG (Sicherheit): Diese Tiefen sind PLANUNGSDATEN, keine amtliche
// Seekarte. Die UI kennzeichnet das entsprechend; flachwasserCheck ist eine
// Entscheidungshilfe gegen den Bootstiefgang, kein Freibrief.
//
// fetch ist injizierbar -> Unit-Tests laufen offline (TDD).

export interface DepthSample {
  /** Wassertiefe in Metern (positiv nach unten); null = Land/keine Tiefe. */
  depth_m: number | null;
  source: "emodnet" | "gebco";
}

export interface DepthOpts {
  fetchImpl?: (url: string) => Promise<Response>;
}

const EMODNET_BASE =
  process.env.EMODNET_DEPTH_URL || "https://rest.emodnet-bathymetry.eu/depth_sample";
const GEBCO_BASE = process.env.GEBCO_DEPTH_URL || "https://api.opentopodata.org/v1/gebco2020";

/** Tiefe an (lat, lon). Wirft, wenn beide Quellen ausfallen. */
export async function fetchDepth(lat: number, lon: number, opts: DepthOpts = {}): Promise<DepthSample> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error(`Ungültige Koordinaten (${lat}, ${lon}).`);
  }
  // Timeout pro Quelle: ein hängender Upstream darf den Worker nicht binden
  // (EMODnet→GEBCO wären sonst 2× unbegrenzt; Review-Finding api-robust).
  const fetchImpl =
    opts.fetchImpl ?? ((url: string) => fetch(url, { signal: AbortSignal.timeout(8_000) }));

  // 1) EMODnet: WKT ist POINT(lon lat) — Achtung Reihenfolge!
  try {
    const url = `${EMODNET_BASE}?geom=${encodeURIComponent(`POINT(${lon} ${lat})`)}`;
    const res = await fetchImpl(url);
    if (res.ok) {
      const body = (await res.json()) as { avg?: number | null };
      if (typeof body.avg === "number" && Number.isFinite(body.avg)) {
        return { depth_m: body.avg < 0 ? round1(-body.avg) : null, source: "emodnet" };
      }
    }
  } catch {
    // EMODnet nicht erreichbar -> Fallback unten.
  }

  // 2) GEBCO via OpenTopoData: locations=lat,lon; elevation negativ = Tiefe.
  try {
    const url = `${GEBCO_BASE}?locations=${lat},${lon}`;
    const res = await fetchImpl(url);
    if (res.ok) {
      const body = (await res.json()) as { results?: Array<{ elevation?: number | null }> };
      const elev = body.results?.[0]?.elevation;
      if (typeof elev === "number" && Number.isFinite(elev)) {
        return { depth_m: elev < 0 ? round1(-elev) : null, source: "gebco" };
      }
    }
  } catch {
    // fällt durch zum Fehler unten
  }

  throw new Error("Tiefendaten gerade nicht verfügbar (EMODnet und GEBCO ohne Antwort).");
}

/** Tiefen für eine Punktfolge (Route) — Reihenfolge bleibt erhalten. */
export async function fetchRouteDepths(
  points: Array<{ lat: number; lon: number }>,
  opts: DepthOpts = {},
): Promise<DepthSample[]> {
  return Promise.all(points.map((p) => fetchDepth(p.lat, p.lon, opts)));
}

export type FlachwasserStatus = "gefahr" | "knapp" | "ok" | "unbekannt";

/**
 * Bewertet eine Tiefe gegen den Bootstiefgang:
 * - "gefahr":   Tiefe <= Tiefgang (aufsetzen)
 * - "knapp":    Tiefe <= Tiefgang + Sicherheitsmarge (Default 0.5 m)
 * - "ok":       ausreichend Wasser unter dem Kiel
 * - "unbekannt": keine Tiefendaten (Land/Datenlücke)
 */
export function flachwasserCheck(
  depth_m: number | null,
  tiefgang_m: number,
  marge_m = 0.5,
): FlachwasserStatus {
  if (depth_m == null || !Number.isFinite(depth_m)) return "unbekannt";
  if (depth_m <= tiefgang_m) return "gefahr";
  if (depth_m <= tiefgang_m + marge_m) return "knapp";
  return "ok";
}

const round1 = (x: number) => Math.round(x * 10) / 10;
