import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor-Konfiguration für die nativen iOS/Android-Builds der
// JTC-Navigations-App. Strategie (docs/navigation-app-plan.md §5):
//
// Phase 1 — REMOTE-WRAPPER: Die App lädt die gehostete /navigation-Seite.
//   + sofort App-Store-fähig, ein Deploy aktualisiert Web UND App
//   – braucht Netz (für eine Wetter-App ohnehin nötig)
// Phase 2 — statisches Bundle + Offline-Cache der letzten Route/Karte.
//
// GPS kommt über @capacitor/geolocation (echte native Berechtigungsdialoge);
// der Web-Hook useGeolocation.ts nutzt dieselbe W3C-API und läuft unverändert.
const config: CapacitorConfig = {
  appId: "org.jointhecaptain.navigation",
  appName: "JTC Navigation",
  // Phase-2-Platzhalter: lokales Web-Bundle (next build + export der Shell).
  webDir: "www",
  server: {
    // Phase 1: Remote-Wrapper auf die produktive Instanz.
    url: "https://join-the-captain.org/navigation",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
