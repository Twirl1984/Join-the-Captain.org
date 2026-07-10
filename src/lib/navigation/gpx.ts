// gpx.ts — GPX-Export der gerouteten Strecke (REQ-NAV-021).
// Reine Logik ohne I/O: Punktfolge + Plan rein, GPX-1.1-String raus.
// Route als <rte> (geplante Route, nicht <trk>) — so erwarten es Plotter/Apps.

import type { RoutePlan } from "../weather/route-forecast";

export interface GpxPoint {
  lat: number;
  lon: number;
  name?: string | null;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** GPX 1.1 mit Routenpunkten; Legs liefern optionale Zeit-Kommentare. */
export function gpxFromRoute(points: GpxPoint[], plan?: RoutePlan | null, name = "JTC Törn"): string {
  const rtepts = points
    .map((p, i) => {
      const label = p.name ?? `WP ${i + 1}`;
      return `    <rtept lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><name>${esc(label)}</name></rtept>`;
    })
    .join("\n");
  const desc = plan
    ? `${plan.total_nm} sm, Ankunft ${plan.eta} — Planungshilfe, ersetzt keine amtlichen Seekarten.`
    : "Planungshilfe, ersetzt keine amtlichen Seekarten.";
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="join-the-captain.org" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><desc>${esc(desc)}</desc></metadata>
  <rte>
    <name>${esc(name)}</name>
${rtepts}
  </rte>
</gpx>
`;
}
