# Launch-Checkliste — JTC Navigation (Web → PWA → Stores)

Stand: 2026-07-06. Aufgeteilt in **„macht die Entwicklung"** (✅ erledigt / vorbereitet)
und **„musst DU tun"** (Identität/Zahlung/Accounts). Zahlen mit ⚠ bitte vor dem
Absenden auf der verlinkten offiziellen Seite gegenprüfen — Websuche war beim
Erstellen wegen API-Überlastung nicht möglich; Kernfakten sind Stand Anfang 2026.

---

## Empfohlener Launch-Pfad (Reihenfolge)

1. **JETZT — Web + PWA (0 €, 0 Gatekeeper):** /navigation ist nach Merge öffentlich;
   „Zum Home-Bildschirm" installiert die App auf iOS & Android. Marketing kann sofort
   starten — die Links in `social-posts.md` funktionieren ohne Store.
2. **Play Store via TWA (schnellster Store-Weg):** Die PWA mit PWABuilder/Bubblewrap
   als Trusted Web Activity verpacken — kein nativer Code, nutzt die Live-Website.
   Voraussetzungen (erfüllt): HTTPS, Manifest mit maskable Icons, Service Worker
   (⚠ noch offen, s. unten), plus `assetlinks.json` auf der Domain.
3. **App Store (iOS) via Capacitor:** Apple akzeptiert keine TWAs und lehnt reine
   Web-Wrapper ab (Guideline 4.2 „minimum functionality"). Der Capacitor-Build muss
   nativen Mehrwert zeigen — unser Plan: natives GPS-Plugin (präziser + Hintergrund),
   Offline-Cache der letzten Route, App-Icon/Splash nativ. Braucht deinen Mac mit
   Xcode + Apple-Account (s. unten).

## A) Musst DU tun (Identität/Zahlung — nicht delegierbar)

| # | Aufgabe | Kosten | Dauer | Wo |
|---|---|---|---|---|
| A1 | **Google Play Console**-Konto anlegen (persönlich oder Organisation) | 25 $ einmalig ⚠ | Identitätsprüfung Stunden–Tage | play.google.com/console/signup |
| A2 | ⚠ **Play-Testpflicht für neue persönliche Konten:** vor Produktions-Freigabe geschlossener Test mit ~12 Testern über ≥14 Tage (deine Skipper-Gruppe reicht) — bei Organisations-Konten entfällt das | – | 14 Tage Testlauf | support.google.com/googleplay/android-developer (nach „closed testing requirements" suchen) |
| A3 | **Apple Developer Program** beitreten (Einzelperson reicht; Organisation bräuchte DUNS) | 99 $/Jahr ⚠ | 1–2 Tage (Identität via App) | developer.apple.com/programs/enroll |
| A4 | **Impressum/Datenschutz befüllen:** Platzhalter in `/impressum` + `/datenschutz` (Name, Adresse, E-Mail) ersetzen — Pflicht VOR öffentlichem Marketing | – | 10 min + Prüfung | src/app/impressum & datenschutz |
| A5 | Xcode auf deinem Mac installieren (App Store, ~15 GB) für den iOS-Build | – | 1 h Download | – |
| A6 | Entscheidung Freemium-Preise (Free / Captain ~29–39 €/Jahr) — kann nach Launch kommen, Free-only startet schneller | – | – | docs/navigation-app-plan.md §1 |

## B) Macht die Entwicklung (Stand)

| Status | Aufgabe |
|---|---|
| ✅ | PWA install-fähig: Manifest mit PNG-Icons 192/512 (any+maskable), apple-touch-icon, Planungshilfe-Hinweis in der Description |
| ✅ | Icons erzeugt: `public/assets/icons/` inkl. 1024er (App-Store-Basis) |
| ✅ | Rechtstexte-Gerüst `/impressum` + `/datenschutz` (Platzhalter), Footer-Links, robots noindex |
| ✅ | Store-Texte DE/EN, ASO-Keywords, Datenschutz-Formular-Antworten: `marketing/store-listing.md` |
| ✅ | Social-/Foren-/WhatsApp-Texte: `marketing/social-posts.md` |
| ✅ | Demo-Videos (mp4, 1280×720) + Store-Screenshots (1290×2796 = iPhone-6.7"-Pflichtmaß ⚠): `~/Downloads/jtc-marketing/` + `marketing/store-assets/` |
| ✅ | **Service Worker** (public/sw.js): Offline-Shell, Asset-Cache, Karten-Kacheln der letzten Route (400er-Deckel), APIs bewusst ungecacht — TWA-Install-Kriterium erfüllt [REQ-NAV-014] |
| 🟡 | **assetlinks.json**: Template liegt unter public/.well-known/assetlinks.json.TEMPLATE — nach Play-Konto den SHA-256-Fingerprint eintragen und .TEMPLATE entfernen |
| ⛔ P1 | **TWA-Paket** bauen (PWABuilder) + Play-Listing befüllen — ~½ Tag nach A1 |
| ⛔ P2 | **Capacitor-iOS**: static-export-Shell oder Remote-URL + natives Geolocation-Plugin + Offline-Route-Cache (Apple-4.2-Mehrwert) — 2–4 Tage nach A3/A5 |
| ⛔ P2 | Play: Feature-Graphic 1024×500, Screenshots 16:9; iOS: ggf. 6.9"-Maß prüfen ⚠ |

## C) Store-Formular-Spickzettel

- **Datenschutz-URL:** https://join-the-captain.org/datenschutz · **Support:** /wetter
- **Standort:** ja, App-Funktion, nicht verknüpft, kein Tracking (Details in store-listing.md)
- **Karten-/Navigations-Apps:** Beide Stores verlangen bei Navigation einen
  Sicherheits-Disclaimer → ist in App-Footer, Manifest-Description und Store-Text enthalten
  („Planungshilfe, ersetzt keine amtlichen Seekarten/Seemannschaft") — das adressiert
  Apple Guideline 1.4 (physical harm) ⚠ im Review-Formular ehrlich angeben.

## D) Marketing-Quick-Wins (0-€-Kanäle, Material liegt bereit)

1. WhatsApp-Skipper-Gruppe (Text fertig) → sofort
2. segeln-forum.de-Post (ehrlicher Community-Text fertig) → nach A4
3. Instagram-Launch-Post + Reel (Videos fertig; Reel-Schnitt auf 9:16 optional) → nach A4
4. Brombachsee: FAU-Segler-Text existiert bereits (frühere Session) → erneut teilen mit /navigation
5. Feedback-Kasten der App = eingebauter Beta-Kanal; wöchentlicher Verify-Cron misst nach
