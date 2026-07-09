# JTC Navigation — Plan: Vom Wetter-Tool zur Navigations-App (iOS/Android)

Stand: 2026-07-03 · Branch: `claude/weather-navigation-app-enazw3` · Bezug:
[weather-route-tool.md](weather-route-tool.md), [weather-roadmap.md](weather-roadmap.md)

Ziel: Das bestehende `/wetter`-Tool wird zur **echten Navigations-App** ausgebaut —
Seekarte mit **Tiefen**, Routenplanung die **nicht über Land führt**, **GPS-Position**,
**echte Ankunftszeiten ab aktueller Position**, **Strömung**, **Windrichtung** und
**Wolkenfelder über die Zeit** — als eigenes Sub-Modul `/navigation`, damit `/wetter`
als stabiler Test-Tab erhalten bleibt. Zielplattformen: **Web (PWA) + iOS + Android**.

---

## 1. Markt & Wettbewerb (Recherche 2026-07)

| App | Kern-Features | Preis (ca.) |
|---|---|---|
| **Navionics** (Garmin) | Vektor-Seekarten mit Tiefenlinien, SonarChart, Auto-Routing (Tiefgang-bewusst), GPS-Track, Gezeiten/Strömung | Abo je Region, 49,99 $/Jahr (USA) bis **99,99 €/Jahr** (Nordeuropa) |
| **C-MAP Embark** | Offline-Karten, Wetter/Gezeiten/Welle, AIS | Premium ab **25,99 $/Jahr**, Kartenpakete 26–66 $ |
| **PredictWind** | Bestes GRIB-Wetter-Routing (Isochronen, Multi-Modell), Offshore-Satellit | Standard **249 $/Jahr**, Pro 499 $/Jahr — keine Seekarten! |
| **Windy.app** | Wind-/Wetterprognose, offline | **18,99 $/Jahr** |
| **iSailor** (Wärtsilä) | ENC-basierte Karten, Plotter, AIS | App gratis, Karten 5–25 $/Region + Update-Abo |
| **SailGrib WR** | GRIB-Routing mit 400+ Polardiagrammen, Gezeiten, NMEA | **24 €/Jahr** oder 70 € lifetime |
| **Aqua Map** | US/Kanada-Karten, modulare Abos | 14,99–24,99 $/Jahr |
| **Meteoconsult Marine** | 15-Tage-Marine-Prognose, Küstenbulletins | Freemium, ~49,90 €/Jahr |

**Muster:** Freemium + Jahres-Abo (15–250 €/Jahr) ist Standard; Lifetime ist die Ausnahme.
**Marktlücke:** Keine dieser Apps kombiniert Seekarte+Tiefen **und** GRIB-Wetter-Routing
**und** Wolken-/Strömungs-Zeitreise **und** Sicherheits-Assistent (Risiko-Regler) in einer
bezahlbaren App. Navionics kann Karten, PredictWind kann Wetter — JTC kann die Brücke sein.

### Preisfindung (Vorschlag)

- **Free:** 1 Revier, 3-Tage-Forecast, Routenplanung mit Landvermeidung, GPS-Anzeige.
  (Kundengewinnung; Open-Meteo Free-Tier deckt die Kosten.)
- **Captain (≈ 29–39 €/Jahr):** alle Reviere, 7-Tage-Forecast, Tiefen-Layer,
  Abfahrts-Scan, Wolken-/Strömungs-Playback, Offline-Cache der letzten Route.
  Positionierung: deutlich unter Navionics (99 €), über Windy (19 $) — „das
  Sicherheits-Extra ist den Aufpreis wert".
- **Skipper Pro (≈ 79–99 €/Jahr, später):** Ensemble-Konfidenz, Ankerplatz-Empfehlung,
  Törn-Logbuch, GPX-Import/Export, mehrere Bootsprofile.
- Store-Abgabe einplanen: Apple/Google nehmen 15 % (Small Business) bis 30 %.

---

## 2. Datenquellen (frei/lizenzierbar)

| Quelle | Inhalt | Lizenz | Abdeckung |
|---|---|---|---|
| **EMODnet Bathymetry** | Europa-DTM ~115 m, WMS-Tiles + REST-Tiefenabfrage | CC-BY 4.0 | Nord-/Ostsee, Mittelmeer, Atlantik-EU |
| **GEBCO 2026** | Globales Bathymetrie-Grid ~450 m | Public Domain | weltweit, grob |
| **OpenSeaMap** | Seezeichen-Tiles (bereits im Einsatz), Crowd-Tiefen | ODbL | global, lückig |
| **Open-Meteo** | Wind, Böen, CAPE, Wolken, Welle, **Strömung** (bereits im Einsatz) | CC-BY 4.0 | global |
| **OSM/GEBCO-Landmaske** | Wasser/Land-Raster für Routing | PD/ODbL | global |

**Wichtig (Recht/Sicherheit):** Keine dieser freien Quellen ist ENC-/amtliche-Seekarten-
Qualität. Die App muss klar als **Planungs- und Entscheidungshilfe** gekennzeichnet sein,
nicht als Ersatz für amtliche Seekarten und Seemannschaft (Haftungshinweis in UI + Stores).
Für „navigational grade" später: Lizenz UKHO/BSH/SHOM prüfen (Kostenfaktor).

---

## 3. Architektur — Sub-Modul `/navigation`

Repo-Konvention (wie `wetter`): Seite + Komponenten + Logik + Tests je Feature-Ordner.
`/wetter` bleibt unverändert als Test-Tab bestehen.

```
src/lib/navigation/
  reviere.ts          Reviere-HIERARCHIE: Gruppen (Nordsee, Ostsee, Mittelmeer, …)
                      → Reviere mit bbox/center/zoom/Häfen
  watermask.ts        Kompakte Wasser/Land-Bitmaske (bbox + Gitter, base64-kodiert)
  searoute.ts         A*-Router über Wassermaske + Sichtlinien-Glättung
                      (Landvermeidung); reine Logik, Maske injizierbar → offline testbar
  depth.ts            Tiefen-Adapter: EMODnet REST (Europa) → GEBCO/OpenTopoData-Fallback;
                      Flachwasser-Check gegen Bootstiefgang
  masks/*.json        Vorberechnete Wassermasken je Revier (aus GEBCO, Script s.u.)
  __tests__/          Unit-Tests (node:test, wie lib/weather)
scripts/navigation-fetch-watermask.ts   Maskengenerator (GEBCO via OpenTopoData)
src/app/api/navigation/route/route.ts   POST: Wegpunkte → landfreie Route + Wetterplan
src/app/api/navigation/depth/route.ts   GET: Tiefe an Punkt (gecacht)
src/app/navigation/page.tsx             Seite (dynamic, ssr:false für Karte)
src/components/navigation/              NavApp, NavMap, RevierPicker, GpsHook, …
e2e/navigation.spec.ts                  Playwright (gemockte Geolocation + APIs)
mobile/                                 Capacitor-Scaffold für iOS/Android (s. §5)
```

**Wiederverwendung (kein Neubau):** `lib/weather/route-forecast.ts` (ETA/Kurs/Strömung),
`polar.ts` (Bootsspeed), `warnings.ts` (Risiko-Regler), `open-meteo.ts`
(Wind/Wolken/Welle/Strömung + Timeline fürs Playback) werden direkt importiert.

### Kernstücke

1. **Landvermeidung:** Wassermaske je Revier (Gitter ~100–300 m Zellweite, aus GEBCO:
   Elevation ≤ 0 → Wasser). A* auf dem Gitter zwischen zwei Wegpunkten, danach
   Sichtlinien-Vereinfachung (Douglas-Peucker-artig über der Maske) → wenige, saubere
   Zwischenpunkte. Klickt der Nutzer zwei Häfen an, entsteht automatisch eine Route,
   die um Inseln/Landzungen herumführt. Kein Maskendatensatz vorhanden → Fallback
   Luftlinie + Hinweis (fail-open mit Warnung, niemals stiller Fehler).
2. **Tiefen:** (a) EMODnet-WMS als zuschaltbarer Karten-Layer (visuelle Tiefenschattierung
   + Konturen), (b) punktuelle Tiefenabfrage entlang der Route → Warnung „flacher als
   Tiefgang + Sicherheitsmarge" pro Leg.
3. **GPS:** `navigator.geolocation.watchPosition` (Web/PWA) bzw. `@capacitor/geolocation`
   (nativ). Eigene Position + Genauigkeitskreis + „Folge mir"-Modus; Route ab aktueller
   Position → **echte ETAs** laufend neu gerechnet (planRoute mit Position als Start).
4. **Wolkenfelder über Zeit:** `cloud_cover` liegt bereits in der Timeline; Darstellung
   als halbtransparente, weiche Flächen (Radial-Gradient je Gitterpunkt, Opazität =
   Bedeckungsgrad) über dem Playback-Zeitregler — „dunstige" Wolkenfelder statt Icon.
5. **Reviere-Gruppen:** statt flachem Dropdown eine Hierarchie
   (Nordsee → Deutsche Bucht/Friesland; Ostsee → Rügen, Dänische Südsee;
   Mittelmeer → Istrien, Dalmatien, Balearen, Ägäis; Binnen → Brombachsee …)
   mit Such-/Schnellwahl-UI.

---

## 4. Teststrategie — durchgängig TDD

Reihenfolge je Modul: **Test zuerst → rot → implementieren → grün → refaktorieren.**

- **Unit (node:test, wie `lib/weather/__tests__`):** watermask (Kodierung/Dekodierung,
  Randfälle), searoute (A* um synthetische Inseln, unlösbare Fälle, Start=Ziel,
  Maskenränder, Glättung schneidet nie Land), depth (Fetch gemockt: EMODnet ok,
  Fallback, Timeout, Landpunkt), reviere (Hierarchie konsistent, bbox enthält Häfen).
- **Integration:** API-Routen mit gemocktem Fetch (Validierungsfehler 400, Landroute
  422/mit Hinweis, Upstream down 502) — plus optionale Live-Tests hinter Env-Flag
  (`JTC_NAV_LIVE=1`), wie beim Wetter-Tool.
- **E2E (Playwright):** gemockte Geolocation (`context.setGeolocation`) + gemockte
  API-Antworten; Pfade: Revier wählen → Route klicken → Landvermeidung sichtbar →
  ETA-Panel; GPS an/aus; API-Ausfall zeigt freundliche Meldung; Mobile-Viewport.
- **Explorativ:** dokumentierte Sessions (docs/navigation-test-notes.md, fortlaufend):
  absurde Eingaben (Wegpunkt auf Land, Antarktis, Datumsgrenze), Netzabriss mitten im
  Playback, Berechtigungs-Verweigerung GPS, sehr lange Routen (25-Wegpunkt-Limit).
- **Qualitäts-Gates vor jedem Merge:** `test:navigation` grün · `typecheck` 0 Fehler ·
  `build` sauber · `test:e2e` grün.

## Standards (UI, Security, Datenschutz)

- **UI/A11y (WCAG 2.1 AA):** Touch-Targets ≥ 44 px, sichtbarer Fokus, Labels/aria für
  alle Controls, Kontrast ≥ 4,5:1 (JTC-Token aus docs/design-paket.md), Karte auch per
  Tastatur bedienbar (Wegpunkt-Liste als Alternative zur Klick-Interaktion).
- **Security:** strikte Input-Validierung aller API-Routen (Zahlbereiche, Limits,
  Content-Type), keine PII in Logs/URLs, GPS-Position verlässt den Client **nur** als
  Routen-Startpunkt (keine Speicherung serverseitig), Security-Header (CSP-tauglich,
  keine Inline-Skripte neu einführen), Upstream-Fehler nie roh durchreichen.
- **Datenschutz (DSGVO):** Standortdaten nur on-device/transient; Store-Einträge mit
  klarem Zweck („Standort nur zur Anzeige/Routenberechnung"); Attribution: Open-Meteo
  (CC-BY), EMODnet (CC-BY), OpenSeaMap (ODbL), OSM.
- **Seerecht/Haftung:** dauerhaft sichtbarer Hinweis „Planungshilfe — ersetzt keine
  amtlichen Seekarten und keine Seemannschaft".

---

## 5. iOS & Android — Strategie

**Empfehlung: Capacitor** (Wrapper um die bestehende Next.js-App):

- Schnellster Weg in App Store + Play Store, ~100 % Code-Wiederverwendung.
- `@capacitor/geolocation` liefert echtes natives GPS (inkl. Berechtigungs-Dialoge).
- Konfiguration als Remote-Wrapper (`server.url` → https://join-the-captain.org/navigation)
  für den Start; später statisches Bundle + Offline-Cache.
- Alternativen bewertet: React Native/Expo (natives UI, aber UI-Neubau — für kleines
  Team zu teuer), reine PWA (kein Store-Listing, iOS-Hintergrund-GPS eingeschränkt —
  als Zwischenschritt trotzdem sinnvoll: Manifest + installierbar).
- **Weitere OS:** HarmonyOS NEXT nur für China-Markt relevant (~18 % dort), KaiOS
  irrelevant → **iOS + Android genügen**, PWA deckt den Rest (Desktop, Exoten) ab.

Store-Anforderungen (Checkliste im `mobile/README.md`): App-Icons/Splash, Privacy
Nutrition Labels (Apple) / Data-Safety (Google), Standort-Begründungstexte,
Test-Accounts, Screenshots, Altersfreigabe, Impressum/Support-URL.

---

## 6. Umsetzungs-Phasen

1. **P1 (dieser Branch):** lib/navigation (Reviere-Hierarchie, Wassermaske, A*-Router,
   Tiefen-Adapter) per TDD · API-Routen · `/navigation`-UI (Tiefen-Layer, GPS,
   Wolkenfelder, Gruppen-Picker, Live-ETA) · Maskengenerator-Script · PWA-Manifest ·
   Capacitor-Scaffold · E2E. `/wetter` bleibt unangetastet.
2. **P2:** Offline-Karten-Cache, GPX-Import/Export, Track-Aufzeichnung (Logbuch),
   Abfahrts-Scan in `/navigation` integrieren, Masken für alle Reviere in CI erzeugen.
3. **P3:** Stores: native Builds, Abo via App-Store-Billing/Stripe, Ankerplatz-Stufe
   aus [weather-roadmap.md](weather-roadmap.md), Ensemble-Konfidenz.
