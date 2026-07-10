# iOS-Portierung — Capacitor-Grundgerüst

## Übersicht

Die JTC Navigation wird mit **Capacitor** auf iOS portiert. Capacitor ist ein plattformübergreifendes Framework, das TypeScript/JavaScript in native iOS/Android-Apps einbettet und eine Bridge zwischen Web-APIs und nativen Features (GPS, Kamera, etc.) bereitstellt.

**Status:** Grundgerüst erstellt (Branch `feat/ios-capacitor`).

---

## Architektur: Remote-URL-Ansatz

Die iOS-App lädt sich selbst als Web-View von der produktiven Next.js-URL (`https://join-the-captain.org/navigation`):

```typescript
// capacitor.config.ts
server: {
  url: 'https://join-the-captain.org/navigation',
  cleartext: false, // Nur HTTPS
}
```

**Warum dieser Ansatz?**

1. **Code-Wartung:** Wir brauchen keine doppelte Web-App (eine Web, eine iOS). Die nächste `npm run build && npm run deploy` aktualisiert beide.
2. **Apple Guideline 4.2:** Dies ist kein einfacher Web-Wrapper, weil wir native Features nutzen (siehe Plugins unten).
3. **Schnelle Iteration:** Bugs in der Navigation fixen → eine Stelle, beide Plattformen profitieren.

**Nachteil:** Ohne Internet funktioniert die App nicht. Siehe [Offene Punkte](#offene-punkte).

---

## Installiert (Packages & Struktur)

```bash
npm install --save @capacitor/core @capacitor/ios @capacitor/geolocation
npm install --save-dev @capacitor/cli

npx cap add ios
npx cap sync ios
```

Das erzeugt:

- **ios/App/** — Xcode-Projekt (Swift/Objective-C)
  - `ios/App/App/` — Native App-Delegate, Assets, LaunchScreen
  - `ios/App/App.xcodeproj/` — Xcode project config
  - `CapApp-SPM/` — Capacitor Swift Package Manager Setup
- **capacitor.config.ts** — Konfiguration (App-ID, Webdir, Plugins, Server-URL)
- **ios/App/App/Info.plist** — iOS-Manifest (Berechtigungen, Metadaten)

---

## Geolocation-Plugin

Für die Seekartenfunktion benötigen wir Standortzugriff:

```plist
<!-- ios/App/App/Info.plist -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Zeigt deine Bootsposition auf der Seekarte.</string>
```

Diese beiden Strings zeigen iOS-Nutzern bei der Standort-Anfrage an, wozu die App den Zugriff braucht.

Verwendung im Code (später):

```typescript
import { Geolocation } from '@capacitor/geolocation';

const position = await Geolocation.getCurrentPosition();
console.log('Latitude:', position.coords.latitude);
console.log('Longitude:', position.coords.longitude);
```

---

## Build-Status

### Smoke-Test mit xcodebuild

```bash
cd ios/App && xcodebuild -project App.xcodeproj -scheme App \
  -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO
```

**Ergebnis:** ❌ **SPM-Git-Fehler** (lokal).

```
Couldn't get the list of tags:
  fatal: cannot use bare repository '...' (safe.bareRepository is 'explicit')
```

**Ursache:** Xcode 26.5+ verstärkte Git-Sicherheit. SPM-Abhängigkeiten (Capacitor, Geolocation) werden lokal geclont und Xcode kann diese „bare" Repos nicht lesen.

**Impact:** Der CI/CD-Build sollte funktionieren (andere Git-Sicherheitsrichtlinie). Lokal muss der User evtl. `git config --global safe.bareRepository=all` setzen (oder: Capacitor 9+ aktualisiert SPM-Handling).

**Workaround (lokal):**
```bash
git config --global safe.bareRepository=all
# oder
xcodebuild ... -resolvePackageDependencies  # Voraus-Fetch
```

**Im CI-System:** Wahrscheinlich nicht nötig (GitHub Actions hat weniger strikte Git-Policies).

---

## Offene Punkte vor App-Store-Einreichung

### 1. Natives Offline-System

Aktuell hängt die App von `https://join-the-captain.org/navigation` ab. Ohne Internet ist die App unbenutzbar.

**Lösung:**
- Service Worker (`next-pwa` oder `workbox`) in der Next.js-App: Cachen der kritischen UI-Assets und API-Responses.
- Alternative: Capacitor Native Layer — einzelne Routen (z.B. Seekarten-Renderer) können nativ gepuffert werden.

**Priorität:** Hoch (Apple und User-Experience).

### 2. GPS-Integration & Autorisierungs-Flow

Der `Geolocation.getCurrentPosition()`-Aufruf braucht:
- Berechtigungshändler in `src/app/navigation/` (prüfen, ob Erlaubnis erteilt; Fallback-UI wenn nicht)
- Retry-Logik wenn GPS gesperrt ist
- Kompass-Integration (später: wenn verfügbar)

**Priorität:** Hoch (core feature).

### 3. App-Icons & Splash Screen

Xcode braucht:
- App-Icon (1024×1024 PNG oder PDF)
- Splash/Launch Screen (Portrait + Landscape)

**Wo:** `ios/App/App/Assets.xcassets/`

**Priorität:** Mittel (vor Store, nicht für Beta).

### 4. Screenshots & App-Store-Metadata

Apple braucht:
- 5–10 Screenshots (Größe nach Device: iPhone 6.7", iPad etc.)
- App-Beschreibung, Keywords, Release-Notes
- Kategorie ("Navigation")
- Alttext für Barrierefreiheit

**Wo:** App Store Connect (nicht im Repo).

**Priorität:** Mittel (vor Store).

### 5. Apple Developer Account & Code-Signing

Der User (`christoph.funda@gmail.com`) braucht:
- Apple Developer Membership (99 EUR/Jahr) → Team-ID
- Provisioning Profiles in Xcode
- Signing Certificate

**Wo:** Xcode → Signing & Capabilities → Team Selection.

**Priorität:** Essentiell (vor Store).

### 6. Versionsierung

`capacitor.config.ts` hat aktuell `appId: 'org.jointhecaptain.navigation'`. Versionsnummer aus `package.json` wird später in `ios/App/App.xcodeproj` synchronisiert.

**Priorität:** Niedrig (wird automatisch).

---

## Nächste Schritte (Roadmap)

1. **Geolocation-UI** (Branch `feat/ios-geolocation`): Berechtigungsanfrage + Map-Update mit echtem GPS.
2. **Offline-Fallback** (Branch `feat/offline-pwa`): Service Worker + lokale Seekarten.
3. **App-Icons & Branding** (Branch `feat/ios-branding`): Assets in `ios/App/App/Assets.xcassets/`.
4. **TestFlight** (Branch `feat/ios-testflight`): Build & Upload via `fastlane`.
5. **App-Store-Submission** (Branch `feat/ios-submit`): Metadaten, Screenshots, Review.

---

## Lokale Entwicklung

### Simulator starten

```bash
# Terminal 1: Next.js dev-Server
npm run dev

# Terminal 2: Live-Reload-Proxy (Capacitor Dev)
npx cap open ios  # Öffnet Xcode
```

Im Xcode Simulator:
- ⌘R: App neuladen
- ⌘⇧K: Konsole togglen
- ⌘⇧C: Cookies/Cache löschen

### App-Code ändern

**TypeScript/React:** `src/app/navigation/` → `npm run build` → `npx cap sync ios` → Xcode neuladen.

**Native Swift:** `ios/App/App/App/App.swift` → Xcode neuladen.

### Debugging

**Browser DevTools:** Xcode → Debug → Open Safari Web Inspector → `App WebView`.

**Native Logs:** Xcode → Console pane.

---

## Weitere Ressourcen

- [Capacitor iOS Docs](https://capacitorjs.com/docs/ios)
- [Capacitor Geolocation Plugin](https://capacitorjs.com/docs/apis/geolocation)
- [Apple App Store Guidelines 4.2](https://developer.apple.com/app-store/review/guidelines/)
- [Xcode SPM Troubleshooting](https://developer.apple.com/documentation/xcode/adding-package-dependencies-to-your-app)


## Build-Status (aktualisiert 2026-07-10)

**BUILD SUCCEEDED** im iPhone-Simulator. Zwei Korrekturen gegenüber dem ersten Versuch:

1. Capacitor 8 nutzt Swift Package Manager — es gibt KEIN `App.xcworkspace`,
   gebaut wird gegen das Projekt:
   ```bash
   cd ios/App
   GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.bareRepository GIT_CONFIG_VALUE_0=all \
     xcodebuild -project App.xcodeproj -scheme App -sdk iphonesimulator \
     -configuration Debug build CODE_SIGNING_ALLOWED=NO
   ```
2. Xcodes SPM-Checkout kollidiert mit `safe.bareRepository=explicit` — der
   Env-Override oben löst das NUR für diesen Build, ohne die globale
   Git-Sicherheits-Konfiguration des Rechners zu ändern.
