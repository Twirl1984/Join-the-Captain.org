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

interface WetterMapProps {
  revier: Revier;
  waypoints: Waypoint[];
  onAddWaypoint: (w: Waypoint) => void;
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

export default function WetterMap({ revier, waypoints, onAddWaypoint }: WetterMapProps) {
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

      {waypoints.map((w, i) => (
        <Marker key={`${w.lat},${w.lon},${i}`} position={[w.lat, w.lon]} icon={waypointIcon(i + 1)} />
      ))}

      {waypoints.length >= 2 && (
        <Polyline
          positions={waypoints.map((w) => [w.lat, w.lon] as [number, number])}
          pathOptions={{ color: "#2f9ec0", weight: 3, dashArray: "6 6" }}
        />
      )}
    </MapContainer>
  );
}
