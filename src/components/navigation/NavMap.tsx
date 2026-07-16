"use client";

// NavMap — Leaflet-Karte der Navigations-App (/navigation).
//
// Layer:  OSM-Basiskarte · OpenSeaMap-Seezeichen · EMODnet-Bathymetrie (WMS,
//         zuschaltbar — farbige Tiefenschattierung, CC-BY 4.0).
// Inhalt: Häfen (Gold) · Wegpunkte (nummeriert) · GEROUTETE Route (Wasserweg
//         durchgezogen, Luftlinie gestrichelt-orange) · eigene GPS-Position
//         mit Genauigkeitskreis + optional "Folgen" · Wetter-Overlay je
//         Zeitschritt (Windpfeile) · WOLKENFELDER als weiche, halbtransparente
//         Flächen (Opazität = Bedeckungsgrad).

import { useEffect } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  WMSTileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { NavRevier } from "@/lib/navigation/reviere";
import type { RouteSegmentInfo } from "@/lib/navigation/route-helpers";
import type { Waypoint } from "@/lib/weather/route-forecast";
import type { TimelineStep } from "@/lib/weather/open-meteo";
import {
  skyCondition,
  windArrowRotationDeg,
  windBarb,
  barbSvgPaths,
  windBarbRotationDeg,
  formatTemp,
  precipInfo,
} from "@/lib/weather/format";
import { beaufort } from "@/lib/weather/warnings";
import type { GeoFix } from "./useGeolocation";

export interface NavUiWaypoint extends Waypoint {
  id: string;
}

export interface NavRoutedLine {
  points: Array<{ lat: number; lon: number }>;
  segments: RouteSegmentInfo[];
}

/** Wetter-Overlay eines Zeitschritts (Windpfeile + Wolkenfelder + Boot). */
export interface NavOverlay {
  points: Array<{ lat: number; lon: number; step: TimelineStep }>;
  boat?: { lat: number; lon: number } | null;
}

interface NavMapProps {
  revier: NavRevier;
  waypoints: NavUiWaypoint[];
  onAddWaypoint: (w: Waypoint) => void;
  /** Drag-Ende eines Wegpunkts (REQ-NAV-013) — Snap-Prüfung macht die App. */
  onMoveWaypoint: (id: string, lat: number, lon: number) => void;
  routed?: NavRoutedLine | null;
  overlay?: NavOverlay | null;
  showDepth: boolean;
  gps?: GeoFix | null;
  followGps: boolean;
  /** Vollbild-Modus (REQ-NAV-018) — löst nach dem Layout-Wechsel invalidateSize aus. */
  fullscreen?: boolean;
  /** Angepeilte Objekte (REQ-NAV-025) — als eigene Marker zeigen. */
  peilObjekte?: Array<{ lat: number; lon: number; label: string }>;
  /** Standlinien Objekt→Standort (REQ-NAV-025) — sichtbar prüfbar machen. */
  peilLinien?: Array<{ from: { lat: number; lon: number }; to: { lat: number; lon: number } }>;
  /** Errechneter Peilungs-Standort (REQ-NAV-025). */
  peilFix?: { lat: number; lon: number } | null;
  /** Wetterzeichen v2 (REQ-WET-015/016): Windfahnen + Temperatur/Niederschlag statt Pfeil. */
  symbolsV2?: boolean;
  /** Erlebnisse im Korridor um die Route (REQ-EXP-004) — als eigene Marker. */
  erlebnisse?: Array<{ lat: number; lon: number; name: string; typ: string }>;
}

function waypointIcon(n: number): L.DivIcon {
  return L.divIcon({
    className: "wp-divicon",
    html: `<span class="wp-marker">${n}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const hafenIcon = L.divIcon({
  className: "wp-divicon",
  html: `<span class="hafen-marker"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/** Errechneter Peilungs-Standort (REQ-NAV-025): Fadenkreuz. */
const peilFixIcon = L.divIcon({
  className: "wp-divicon",
  html: `<span class="nav-peilfix-marker">✛</span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Angepeiltes Objekt (REQ-NAV-025): markantes Dreieck-Symbol. */
const peilIcon = L.divIcon({
  className: "wp-divicon",
  html: `<span class="nav-peil-marker">▲</span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 18],
});

/** Erlebnis-POI entlang der Route (REQ-EXP-004): Stern-Symbol. */
const erlebnisIcon = L.divIcon({
  className: "wp-divicon",
  html: `<span class="nav-erlebnis-marker">★</span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** Eigene Position: Pfeil in Kursrichtung (falls Kurs bekannt), sonst Punkt. */
function gpsIcon(headingDeg: number | null): L.DivIcon {
  // Glyph ➤ zeigt in Grundstellung nach OSTEN → -90°, damit Kurs 0° = Nord
  // (Review-Finding #8: ohne Offset war die Kursanzeige um 90° verdreht).
  const rot =
    headingDeg != null ? `style="transform:rotate(${Math.round(headingDeg) - 90}deg)"` : "";
  const glyph = headingDeg != null ? "➤" : "●";
  return L.divIcon({
    className: "wp-divicon",
    html: `<span class="nav-gps-marker" ${rot}>${glyph}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Windpfeil je Overlay-Punkt (Farbe nach Böen-Stärke, wie /wetter) + Himmels-Icon
// aus dem Bedeckungsgrad (REQ-WET-014): so ist AUCH eine wolkenlose Lage sichtbar
// „klar“/„klare Nacht“ (Sonne/Mond) und wirkt nicht leer.
//
// `symbolsV2` (REQ-WET-015/016) schaltet auf die maritime Darstellung um:
// Beaufort-Windfahne (Richtung + Stärke in einem Glyph, zeigt zur Herkunft),
// dazu Temperatur (°C) und ein Regen-Glyph bei Niederschlag — größer und
// kontrastreicher. Ohne Flag bleibt exakt die bisherige Pfeil-Darstellung.
function windIcon(step: TimelineStep, symbolsV2: boolean): L.DivIcon {
  const bft = beaufort(step.gust_kn);
  const cls = step.gale || step.thunderstorm ? "wx-danger" : bft >= 6 ? "wx-strong" : "wx-calm";
  const bolt = step.thunderstorm ? '<span class="wx-bolt">⚡</span>' : "";
  const sky = skyCondition(step.cloud_pct, step.is_day);
  const skyGlyph = sky ? `<span class="wx-sky" title="${sky.label}">${sky.glyph}</span>` : "";

  if (!symbolsV2) {
    const rot = windArrowRotationDeg(step.wind_from_deg);
    return L.divIcon({
      className: "wp-divicon",
      html:
        `<span class="wx-marker ${cls}" title="${step.wind_kn} kn (Böen ${step.gust_kn} kn)">` +
        skyGlyph +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ` +
        `stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${rot}deg)">` +
        `<path d="M10 14l11-11M21 3l-7 18-4-7-7-4z"/></svg>` +
        `<span class="wx-kn">${step.wind_kn}</span>${bolt}</span>`,
      iconSize: [54, 24],
      iconAnchor: [27, 12],
    });
  }

  // v2: Beaufort-Windfahne (Barb). Sustained wind für die Federn, Böen für die Farbe.
  const barb = windBarb(step.wind_kn);
  const rot = windBarbRotationDeg(step.wind_from_deg);
  const feathers = barbSvgPaths(barb)
    .map((d) => `<path d="${d}"/>`)
    .join("");
  const barbBody = barb.calm
    ? `<circle cx="12" cy="16" r="3.2" fill="none"/>`
    : `<line x1="12" y1="5" x2="12" y2="27"/>${feathers}`;
  const barbSvg =
    `<svg class="wx-barb" width="24" height="32" viewBox="0 0 24 32" fill="currentColor" ` +
    `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
    `style="transform:rotate(${rot}deg)">${barbBody}</svg>`;

  const tempLabel = formatTemp(step.temperature_2m);
  const tempSpan = tempLabel ? `<span class="wx-temp">${tempLabel}</span>` : "";
  const precip = precipInfo(step.precipitation);
  const precipSpan = precip
    ? `<span class="wx-precip wx-precip-${precip.key}" title="${precip.label}">${precip.glyph}</span>`
    : "";

  const titleParts = [`${step.wind_kn} kn (Böen ${step.gust_kn} kn)`];
  if (tempLabel) titleParts.push(`${tempLabel}C`);
  if (precip) titleParts.push(precip.label);

  return L.divIcon({
    className: "wp-divicon",
    html:
      `<span class="wx-marker wx-v2 ${cls}" title="${titleParts.join(" · ")}">` +
      skyGlyph +
      barbSvg +
      `<span class="wx-kn">${step.wind_kn}</span>` +
      tempSpan +
      precipSpan +
      bolt +
      `</span>`,
    iconSize: [46, 62],
    iconAnchor: [23, 31],
  });
}

const boatIcon = L.divIcon({
  className: "wp-divicon",
  html: `<span class="wx-boat">⛵</span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function RevierView({ revier }: { revier: NavRevier }) {
  const map = useMap();
  useEffect(() => {
    map.setView(revier.center, revier.zoom);
  }, [map, revier]);
  return null;
}

/** Nach einem Größen-/Layout-Wechsel (Vollbild an/aus, REQ-NAV-018) muss Leaflet
    seine Container-Maße neu messen — sonst bleiben Kacheln grau/fehlplatziert. */
function InvalidateOnResize({ trigger }: { trigger: unknown }) {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(id);
  }, [map, trigger]);
  return null;
}

/** "Folgen"-Modus: Karte zieht mit der GPS-Position mit. */
function FollowGps({ gps, follow }: { gps: GeoFix | null | undefined; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow && gps) map.setView([gps.lat, gps.lon]);
  }, [map, follow, gps]);
  return null;
}

function ClickToAdd({ onAdd }: { onAdd: (w: Waypoint) => void }) {
  useMapEvents({
    click(e) {
      const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
      onAdd({ lat: r5(e.latlng.lat), lon: r5(e.latlng.lng) });
    },
  });
  return null;
}

/** Segment-Polylines: Wasserweg teal-durchgezogen, Luftlinie orange-gestrichelt. */
function RoutedLines({ routed }: { routed: NavRoutedLine }) {
  return (
    <>
      {routed.segments.map((seg, i) => {
        const pts = routed.points
          .slice(seg.from, seg.to + 1)
          .map((p) => [p.lat, p.lon] as [number, number]);
        const wasser = seg.routing === "wasserweg";
        return (
          <Polyline
            key={`seg-${i}`}
            positions={pts}
            pathOptions={
              wasser
                ? { color: "#2f9ec0", weight: 4, opacity: 0.9 }
                : { color: "#e08a3c", weight: 3, dashArray: "6 8", opacity: 0.9 }
            }
          />
        );
      })}
    </>
  );
}

export default function NavMap({
  revier,
  waypoints,
  onAddWaypoint,
  onMoveWaypoint,
  routed,
  overlay,
  showDepth,
  gps,
  followGps,
  fullscreen,
  peilObjekte,
  peilLinien,
  peilFix,
  symbolsV2 = false,
  erlebnisse,
}: NavMapProps) {
  return (
    <MapContainer center={revier.center} zoom={revier.zoom} className="wetter-leaflet" scrollWheelZoom>
      <InvalidateOnResize trigger={fullscreen} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* Tiefen-Layer: EMODnet-Bathymetrie (Europa, CC-BY 4.0) — zuschaltbar. */}
      {showDepth && (
        <WMSTileLayer
          url="https://ows.emodnet-bathymetry.eu/wms"
          params={{ layers: "emodnet:mean_atlas_land", format: "image/png", transparent: true }}
          opacity={0.65}
          attribution='Tiefen: <a href="https://emodnet.ec.europa.eu/en/bathymetry">EMODnet Bathymetry</a> (CC-BY 4.0)'
        />
      )}
      <TileLayer
        attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
        url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
      />
      <RevierView revier={revier} />
      <FollowGps gps={gps} follow={followGps} />
      <ClickToAdd onAdd={onAddWaypoint} />

      {revier.haefen.map((h) => (
        <Marker
          key={h.name}
          position={[h.lat, h.lon]}
          icon={hafenIcon}
          eventHandlers={{ click: () => onAddWaypoint({ lat: h.lat, lon: h.lon, name: h.name }) }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {h.name} — Klick fügt Wegpunkt hinzu
          </Tooltip>
        </Marker>
      ))}

      {peilLinien?.map((l, i) => (
        <Polyline
          key={`peillinie-${i}`}
          positions={[
            [l.from.lat, l.from.lon],
            [l.to.lat, l.to.lon],
          ]}
          pathOptions={{ color: "#d9534f", weight: 2, dashArray: "6 6", opacity: 0.9 }}
        />
      ))}
      {peilFix && (
        <Marker position={[peilFix.lat, peilFix.lon]} icon={peilFixIcon} interactive={false}>
          <Tooltip direction="top" offset={[0, -10]}>
            Standort aus Peilung
          </Tooltip>
        </Marker>
      )}

      {peilObjekte?.map((o, i) => (
        <Marker key={`peil-${i}`} position={[o.lat, o.lon]} icon={peilIcon} interactive={false}>
          <Tooltip direction="top" offset={[0, -14]}>
            {o.label}
          </Tooltip>
        </Marker>
      ))}

      {erlebnisse?.map((e, i) => (
        <Marker key={`erlebnis-${i}`} position={[e.lat, e.lon]} icon={erlebnisIcon} interactive={false}>
          <Tooltip direction="top" offset={[0, -10]}>
            {e.name}
          </Tooltip>
        </Marker>
      ))}

      {waypoints.map((w, i) => (
        <Marker
          key={w.id}
          position={[w.lat, w.lon]}
          icon={waypointIcon(i + 1)}
          // Verschieben per Klicken-und-Halten (REQ-NAV-013); die Snap-/
          // Land-Prüfung übernimmt die App beim Loslassen.
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
              onMoveWaypoint(w.id, r5(ll.lat), r5(ll.lng));
            },
          }}
        />
      ))}

      {/* Vorschau-Linie, solange noch keine geroutete Route vorliegt. */}
      {!routed && waypoints.length >= 2 && (
        <Polyline
          positions={waypoints.map((w) => [w.lat, w.lon] as [number, number])}
          pathOptions={{ color: "#8aa4b8", weight: 2, dashArray: "4 6" }}
        />
      )}
      {routed && <RoutedLines routed={routed} />}

      {/* Wolkenfelder: weiche, halbtransparente Flächen — Opazität = Bedeckung. */}
      {overlay?.points.map((p, i) =>
        p.step.cloud_pct != null && p.step.cloud_pct > 15 ? (
          <Circle
            key={`cl-${i}`}
            center={[p.lat, p.lon]}
            radius={2500}
            interactive={false}
            // className wirkt nur zur ERSTELLUNGSzeit (Leaflet setStyle ignoriert
            // sie) -> als Top-Level-Prop; die dynamische Opazität via pathOptions.
            className="nav-cloud-patch"
            pathOptions={{
              stroke: false,
              fillColor: "#d7dde4",
              fillOpacity: Math.min(0.65, (p.step.cloud_pct / 100) * 0.7),
            }}
          />
        ) : null,
      )}
      {/* Windpfeile des aktiven Zeitschritts. */}
      {overlay?.points.map((p, i) => (
        <Marker key={`wx-${i}`} position={[p.lat, p.lon]} icon={windIcon(p.step, symbolsV2)} interactive={false} />
      ))}
      {overlay?.boat && (
        <Marker position={[overlay.boat.lat, overlay.boat.lon]} icon={boatIcon} interactive={false} />
      )}

      {/* Eigene GPS-Position + Genauigkeitskreis. */}
      {gps && (
        <>
          <Circle
            center={[gps.lat, gps.lon]}
            radius={Math.max(10, gps.accuracy_m)}
            interactive={false}
            pathOptions={{ color: "#2f9ec0", weight: 1, fillColor: "#2f9ec0", fillOpacity: 0.12 }}
          />
          <Marker position={[gps.lat, gps.lon]} icon={gpsIcon(gps.heading_deg)}>
            <Tooltip direction="top" offset={[0, -10]}>
              Meine Position (±{Math.round(gps.accuracy_m)} m)
              {gps.speed_kn != null ? ` · ${gps.speed_kn} kn` : ""}
            </Tooltip>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}
