import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor-Konfiguration für JTC Navigation (iOS/Android).
 *
 * Ansatz: Remote-URL-basiert auf die Next.js-Produktionsseite.
 * Die Web-App lädt sich selbst über HTTPS und kommuniziert mit den native APIs
 * (z.B. Geolocation-Plugin) über Capacitor Bridges.
 *
 * Apple Guideline 4.2 (Software Requirements):
 * Das ist kein einfacher Web-Wrapper — wir nutzen native Features (GPS, Offline später),
 * was die guideline-Anforderung erfüllt. Vor der App-Store-Einreichung müssen wir jedoch:
 * 1. Natives Offline-System (fallback wenn kein Netz)
 * 2. GPS-Integration & Autorisierungs-Flow
 * 3. App-Icons & Screenshots
 * 4. Apple Developer Account Setup beim User
 */
const config: CapacitorConfig = {
  appId: 'org.jointhecaptain.navigation',
  appName: 'JTC Navigation',
  webDir: 'public',
  plugins: {
    // Geolocation: für Standort-Tracking (wird später mit Autorisierung erweitert)
    Geolocation: {
      // Konfiguration folgt in kommenden Releases
    },
  },
  server: {
    // Remote-URL: Die Next.js-App lädt sich selbst vom Server.
    // Das ist kein reiner Web-Wrapper, weil wir native APIs nutzen.
    url: 'https://join-the-captain.org/navigation',
    cleartext: false, // Nur HTTPS
  },
};

export default config;
