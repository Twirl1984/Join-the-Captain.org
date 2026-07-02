"use client";

// Interaktive Leaflet-Karte für den Routen-Planer. Wird via next/dynamic mit
// { ssr: false } geladen (Leaflet braucht window). OSM-Basiskarte + OpenSeaMap-
// Seezeichen-Overlay. Wegpunkte als nummerierte DivIcons (kein PNG-Asset nötig),
// Häfen des gewählten Reviers als anklickbare Gold-Marker.

import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Revier } from "@/lib/weather/reviere";
import type { Waypoint } from "@/lib/weather/route-forecast";
import type { TimelineStep } from "@/lib/weather/open-meteo";
import { windArrowRotationDeg } from "@/lib/weather/format";
import { beaufort } from "@/lib/weather/warnings";
import type { UiWaypoint } from "./WetterApp";

/** Wetter-Overlay eines Zeitschritts: Symbol je Overlay-Punkt + Bootsposition. */
export interface WetterOverlay {
  points: Array<{ lat: number; lon: number; step: TimelineStep }>;
  boat?: { lat: number; lon: number } | null;
}

interface WetterMapProps {
  revier: Revier;
  waypoints: UiWaypoint[];
  onAddWaypoint: (w: Waypoint) => void;
  overlay?: WetterOverlay | null;
}

// Nummerierter Wegpunkt-Marker (Teal-Kreis mit Index).
function waypointIcon(n: number): L.DivIcon {
  return L.divIcon({
    className: "wp-divicon",
    html: `<span class="wp-marker">${n}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

// Hafen-Marker (Gold-Punkt).
const hafenIcon = L.divIcon({
  className: "wp-divicon",
  html: `<span class="hafen-marker"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Zentriert die Karte beim Revier-Wechsel neu.
function RevierView({ revier }: { revier: Revier }) {
  const map = useMap();
  useEffect(() => {
    map.setView(revier.center, revier.zoom);
  }, [map, revier]);
  return null;
}

// Klick auf freie Karte → Wegpunkt an der Klickposition.
function ClickToAdd({ onAdd }: { onAdd: (w: Waypoint) => void }) {
  useMapEvents({
    click(e) {
      onAdd({ lat: round5(e.latlng.lat), lon: round5(e.latlng.lng) });
    },
  });
  return null;
}

const round5 = (x: number) => Math.round(x * 1e5) / 1e5;

// Wetter-Symbol eines Zeitschritts: Windpfeil (Flow-Richtung, Farbe nach Bft),
// kn-Zahl, ⚡ bei Gewitter, Wolken-Andeutung nach Bedeckung.
function weatherIcon(step: TimelineStep): L.DivIcon {
  const bft = beaufort(step.gust_kn);
  const cls = step.gale || step.thunderstorm ? "wx-danger" : bft >= 6 ? "wx-strong" : "wx-calm";
  const rot = windArrowRotationDeg(step.wind_from_deg);
  const cloud =
    step.cloud_pct == null ? "" : `<span class="wx-cloud" style="opacity:${Math.max(0.15, step.cloud_pct / 100)}">☁</span>`;
  const bolt = step.thunderstorm ? '<span class="wx-bolt">⚡</span>' : "";
  return L.divIcon({
    className: "wp-divicon",
    html:
      `<span class="wx-marker ${cls}" title="${step.wind_kn} kn (Böen ${step.gust_kn} kn)">` +
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ` +
      `stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${rot}deg)">` +
      `<path d="M10 14l11-11M21 3l-7 18-4-7-7-4z"/></svg>` +
      `<span class="wx-kn">${step.wind_kn}</span>${cloud}${bolt}</span>`,
    iconSize: [46, 26],
    iconAnchor: [23, 13],
  });
}

const boatIcon = L.divIcon({
  className: "wp-divicon",
  html: `<span class="wx-boat">⛵</span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function WetterMap({ revier, waypoints, onAddWaypoint, overlay }: WetterMapProps) {
  return (
    <MapContainer
      center={revier.center}
      zoom={revier.zoom}
      className="wetter-leaflet"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* Seezeichen-Overlay (Tonnen, Leuchtfeuer) — für Segler Gold wert. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
        url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
      />
      <RevierView revier={revier} />
      <ClickToAdd onAdd={onAddWaypoint} />

      {revier.haefen.map((h) => (
        <Marker
          key={h.name}
          position={[h.lat, h.lon]}
          icon={hafenIcon}
          eventHandlers={{
            click: () => onAddWaypoint({ lat: h.lat, lon: h.lon, name: h.name }),
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {h.name} — Klick fügt Wegpunkt hinzu
          </Tooltip>
        </Marker>
      ))}

      {/* Stabile Keys (w.id): beim Löschen aus der Mitte bleiben die übrigen
          Leaflet-Marker erhalten; nur icon (Nummer) aktualisiert sich. */}
      {waypoints.map((w, i) => (
        <Marker key={w.id} position={[w.lat, w.lon]} icon={waypointIcon(i + 1)} />
      ))}

      {waypoints.length >= 2 && (
        <Polyline
          positions={waypoints.map((w) => [w.lat, w.lon] as [number, number])}
          pathOptions={{ color: "#2f9ec0", weight: 3, dashArray: "6 6" }}
        />
      )}

      {/* Playback-Overlay: Wetter-Symbole des aktiven Zeitschritts + Boot. */}
      {overlay?.points.map((p, i) => (
        <Marker
          key={`wx-${i}`}
          position={[p.lat, p.lon]}
          icon={weatherIcon(p.step)}
          interactive={false}
        />
      ))}
      {overlay?.boat && (
        <Marker position={[overlay.boat.lat, overlay.boat.lon]} icon={boatIcon} interactive={false} />
      )}
    </MapContainer>
  );
}
