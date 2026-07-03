"use client";

// useGeolocation — GPS-Hook für die Navigations-App.
//
// Kapselt navigator.geolocation.watchPosition mit sauberen Zuständen:
// idle → watching → (denied | unavailable). Die Position bleibt beim
// Stoppen erhalten (letzter Fix), damit die UI nicht "springt".
//
// Datenschutz: Die Position verlässt den Client nur als Routen-Startpunkt
// der Berechnung — sie wird serverseitig nicht gespeichert.
// Im Capacitor-Wrapper (iOS/Android) liefert @capacitor/geolocation dieselbe
// W3C-API, daher funktioniert dieser Hook dort unverändert.

import { useCallback, useEffect, useRef, useState } from "react";

export interface GeoFix {
  lat: number;
  lon: number;
  /** Genauigkeit in Metern (Radius). */
  accuracy_m: number;
  /** Kurs über Grund in Grad oder null (Gerät steht). */
  heading_deg: number | null;
  /** Fahrt über Grund in Knoten oder null. */
  speed_kn: number | null;
  /** Zeitstempel des Fixes (ms). */
  at: number;
}

export type GeoStatus = "idle" | "watching" | "denied" | "unavailable";

export interface Geolocation {
  status: GeoStatus;
  fix: GeoFix | null;
  start: () => void;
  stop: () => void;
}

const MS_TO_KN = 1.943844; // m/s → Knoten

export function useGeolocation(): Geolocation {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [fix, setFix] = useState<GeoFix | null>(null);
  const watchId = useRef<number | null>(null);
  // Fix auch als Ref: der Error-Callback braucht den aktuellen Stand,
  // ohne dass start() bei jedem Fix neu erzeugt werden muss.
  const fixRef = useRef<GeoFix | null>(null);

  const stop = useCallback(() => {
    if (watchId.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    if (watchId.current != null) return; // läuft schon
    setStatus("watching");
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setStatus("watching");
        fixRef.current = {
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracy_m: p.coords.accuracy ?? 0,
          heading_deg:
            p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null,
          speed_kn:
            p.coords.speed != null && !Number.isNaN(p.coords.speed)
              ? Math.round(p.coords.speed * MS_TO_KN * 10) / 10
              : null,
          at: p.timestamp,
        };
        setFix({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracy_m: p.coords.accuracy ?? 0,
          heading_deg: p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null,
          speed_kn:
            p.coords.speed != null && !Number.isNaN(p.coords.speed)
              ? Math.round(p.coords.speed * MS_TO_KN * 10) / 10
              : null,
          at: p.timestamp,
        });
      },
      (err) => {
        // PERMISSION_DENIED=1 ist terminal. POSITION_UNAVAILABLE=2/TIMEOUT=3
        // sind oft transient (Tunnel, kurzer Empfangsverlust): mit vorhandenem
        // Fix läuft der Watch einfach weiter. Terminal wird der Watch IMMER
        // sauber beendet (clearWatch) — sonst Watch-Leak + Zombie-Status,
        // wenn später doch noch ein Fix eintrudelt (Review-Finding #7).
        if (err.code !== 1 && watchId.current != null && fixRef.current) return;
        if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setStatus(err.code === 1 ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, []);

  // Aufräumen beim Unmount.
  useEffect(() => stop, [stop]);

  return { status, fix, start, stop };
}
