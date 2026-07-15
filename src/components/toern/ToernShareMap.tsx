"use client";

// ToernShareMap — read-only Vogelperspektive-Karte für den teilbaren
// Törn-Link (REQ-EXP-009). Kein Editieren, keine Fetches, kein GPS —
// reine Anzeige der geroutete Linie + Highlights.

import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface ToernShareMapPunkt {
  lat: number;
  lon: number;
  name?: string | null;
}

export interface ToernShareMapHighlight {
  name: string;
  lat: number;
  lon: number;
  typ: string;
}

const highlightIcon = L.divIcon({
  className: "wp-divicon",
  html: `<span class="nav-erlebnis-marker">★</span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function ToernShareMap({
  punkte,
  highlights,
}: {
  punkte: ToernShareMapPunkt[];
  highlights: ToernShareMapHighlight[];
}) {
  const alleKoordinaten: [number, number][] = [
    ...punkte.map((p): [number, number] => [p.lat, p.lon]),
    ...highlights.map((h): [number, number] => [h.lat, h.lon]),
  ];
  const center: [number, number] = alleKoordinaten[0] ?? [54.5, 13.5];

  return (
    <MapContainer
      center={center}
      zoom={9}
      bounds={alleKoordinaten.length > 1 ? alleKoordinaten : undefined}
      boundsOptions={{ padding: [24, 24] }}
      className="wetter-leaflet"
      scrollWheelZoom={false}
      dragging={true}
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {punkte.length > 1 && (
        <Polyline positions={punkte.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#2f6f6a", weight: 3 }} />
      )}
      {highlights.map((h, i) => (
        <Marker key={`hl-${i}`} position={[h.lat, h.lon]} icon={highlightIcon}>
          <Tooltip direction="top" offset={[0, -10]}>
            {h.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
