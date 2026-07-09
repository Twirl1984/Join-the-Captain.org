# JTC Navigation — iOS- & Android-Builds (Capacitor)

Nativer Wrapper um die Web-App `/navigation` (Strategie & Begründung:
[docs/navigation-app-plan.md](../docs/navigation-app-plan.md) §5). Die Web-App ist
zugleich als **PWA** installierbar (Manifest liegt unter `/manifest.webmanifest`) —
dieser Ordner liefert zusätzlich die **Store-Apps**.

> Native Builds brauchen macOS+Xcode (iOS) bzw. Android Studio — sie laufen auf der
> Entwickler-Maschine, nicht im CI dieses Repos. Der Ordner hält Konfiguration und
> Checklisten versioniert; `ios/`/`android/` Plattform-Ordner werden lokal erzeugt.

## Einmalig einrichten

```bash
cd mobile
npm install
npx cap add ios        # erzeugt ios/ (macOS + Xcode nötig)
npx cap add android    # erzeugt android/ (Android Studio nötig)
```

Phase 1 ist ein **Remote-Wrapper**: `capacitor.config.ts` zeigt per `server.url`
auf https://join-the-captain.org/navigation — ein Web-Deploy aktualisiert damit auch
die Apps. Für Phase 2 (Offline-Bundle) wird `webDir` mit einem statischen Export
gefüllt und `server.url` entfernt.

## GPS-Berechtigungen (Pflicht vor dem ersten Build)

**iOS — `ios/App/App/Info.plist`:**
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Deine Position wird nur zur Anzeige auf der Karte und als Startpunkt der
Routenberechnung verwendet. Sie wird nicht gespeichert.</string>
```

**Android — `android/app/src/main/AndroidManifest.xml`:**
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

Datenschutz-Grundsatz (auch für die Store-Formulare): Die Position verlässt das
Gerät nur als Routen-Startpunkt einer Berechnung und wird serverseitig **nicht
gespeichert** (kein Tracking, keine PII — vgl. Plausible-Setup der Website).

## Store-Checkliste

| Punkt | iOS (App Store) | Android (Play Store) |
|---|---|---|
| Icons | 1024×1024 PNG (aus `public/assets/app-icon.svg` exportieren) | 512×512 PNG + adaptive Icon |
| Splash | Storyboard (Capacitor-Default + Markenfarbe #0B2545) | `windowSplashScreenBackground` |
| Datenschutz | Privacy Nutrition Label: „Standort — App-Funktion, nicht verknüpft" | Data-Safety-Formular analog |
| Begründungstexte | `NSLocation…UsageDescription` (oben) | Play-Console „Standort-Berechtigung" |
| Kategorie | Navigation / Wetter | Maps & Navigation |
| Altersfreigabe | 4+ | USK 0 / PEGI 3 |
| Rechtliches | Impressum-/Support-URL, Haftungshinweis „Planungshilfe — ersetzt keine amtlichen Seekarten" prominent in der App (bereits im UI-Footer) | dito |
| Review-Hinweis | Testzugang nicht nötig (keine Anmeldung); Reviewer-Notiz: GPS optional | dito |
| Abo (später) | App-Store-Billing (StoreKit) für „Captain"-Tier | Play Billing |

## Andere Betriebssysteme?

HarmonyOS NEXT (relevant nur für den China-Markt, ~18 % dort) und KaiOS wurden geprüft
und bewusst zurückgestellt — **iOS + Android + PWA decken den Zielmarkt ab**
(Recherche in docs/navigation-app-plan.md §5). Die PWA läuft zusätzlich auf Desktop
und allen Browsern.
