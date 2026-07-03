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
import { windArrowRotationDeg } from "@/lib/weather/format";
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
  routed?: NavRoutedLine | null;
  overlay?: NavOverlay | null;
  showDepth: boolean;
  gps?: GeoFix | null;
  followGps: boolean;
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

/** Eigene Position: Pfeil in Kursrichtung (falls Kurs bekannt), sonst Punkt. */
function gpsIcon(headingDeg: number | null): L.DivIcon {
  const rot = headingDeg != null ? `style="transform:rotate(${Math.round(headingDeg)}deg)"` : "";
  const glyph = headingDeg != null ? "➤" : "●";
  return L.divIcon({
    className: "wp-divicon",
    html: `<span class="nav-gps-marker" ${rot}>${glyph}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Windpfeil je Overlay-Punkt (Farbe nach Böen-Stärke, wie /wetter).
function windIcon(step: TimelineStep): L.DivIcon {
  const bft = beaufort(step.gust_kn);
  const cls = step.gale || step.thunderstorm ? "wx-danger" : bft >= 6 ? "wx-strong" : "wx-calm";
  const rot = windArrowRotationDeg(step.wind_from_deg);
  const bolt = step.thunderstorm ? '<span class="wx-bolt">⚡</span>' : "";
  return L.divIcon({
    className: "wp-divicon",
    html:
      `<span class="wx-marker ${cls}" title="${step.wind_kn} kn (Böen ${step.gust_kn} kn)">` +
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ` +
      `stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${rot}deg)">` +
      `<path d="M10 14l11-11M21 3l-7 18-4-7-7-4z"/></svg>` +
      `<span class="wx-kn">${step.wind_kn}</span>${bolt}</span>`,
    iconSize: [42, 24],
    iconAnchor: [21, 12],
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
  routed,
  overlay,
  showDepth,
  gps,
  followGps,
}: NavMapProps) {
  return (
    <MapContainer center={revier.center} zoom={revier.zoom} className="wetter-leaflet" scrollWheelZoom>
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

      {waypoints.map((w, i) => (
        <Marker key={w.id} position={[w.lat, w.lon]} icon={waypointIcon(i + 1)} />
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
        <Marker key={`wx-${i}`} position={[p.lat, p.lon]} icon={windIcon(p.step)} interactive={false} />
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
