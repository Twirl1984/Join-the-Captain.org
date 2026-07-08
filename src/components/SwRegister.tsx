"use client";

// Registriert den Service Worker (REQ-NAV-014) — nur im Produktionsbuild,
// damit Dev/HMR nicht durch Caches gestört wird.
import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Offline-Cache ist ein Bonus — die App funktioniert auch ohne. */
    });
  }, []);
  return null;
}
