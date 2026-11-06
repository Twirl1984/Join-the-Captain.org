# Törn-Manöver-Duell

Offline-fähige Handy-App für die Crew (Bavaria 45 „Akilina“, bis zu 11 Personen): Manöverkarten ansehen,
gegenseitig bewerten, Landgang-Punkte erfassen, Rangliste und Überblick. Vanilla-JS (ES-Module), kein Build,
keine Abhängigkeiten, kein Server, kein Login, kein Tracking.

## Starten (lokal)

```bash
cd public && python3 -m http.server 8765      # dann http://localhost:8765/toern-duell/index.html
```

Per Doppelklick auf `index.html` (`file://`) läuft die App **nicht** (Browser blockieren ES-Module und `fetch`) – ein
Webserver ist nötig; im Alltag ist das die .org.

## Deploy (join-the-captain.org)

Die App liegt in `public/toern-duell/` und wird beim normalen Deploy des Repos mit ausgeliefert
(`docs/DEPLOYMENT.md`, Docker Compose + nginx + TLS). Adresse: **https://join-the-captain.org/toern-duell/index.html**
(`/toern-duell` leitet dorthin um). Der Service Worker braucht HTTPS (gegeben).

- Nicht indexiert (`noindex`, `robots.txt`), kein Eintrag in Sitemap/Tools-Liste.
- Abschalten: `NEXT_PUBLIC_FEATURE_DUELL=off` beim Build → `/toern-duell/*` leitet auf `/tools` um.
- **Nach jeder Änderung an Dateien dieses Ordners:** `npm run duell:sw` (aktualisiert Precache-Liste + Version in
  `sw.js`). Ein Drift-Test schlägt sonst an.

## Auf dem iPhone „herunterladen“ (installieren)

1. Mit Internet in Safari `…/toern-duell/index.html` öffnen und einmal kurz warten (Service Worker lädt alle Karten/Bilder).
2. Teilen-Symbol → **Zum Home-Bildschirm**. Danach über das Symbol starten – auch im Flugmodus.
3. Neue Version: App mit Internet öffnen; beim nächsten Start ist sie aktuell. Die Daten bleiben erhalten.

## Datenhaltung & „nur ich“

Alle Daten liegen **nur auf dem Gerät**: IndexedDB (Stand + 40 Verlaufs-Snapshots) **und** localStorage
(Stand + Backup). Beim Start gewinnt der gültige Stand mit der höchsten Revision; fällt ein Ort aus oder ist beschädigt,
geht nichts verloren. Frühere Stände lassen sich auf der Startseite wiederherstellen. Wer die URL öffnet, bekommt eine
**leere eigene** App – deine Daten sind nur auf deinem Gerät sichtbar. Weitergabe an die Crew: **Überblick → Für die Crew
teilen (HTML)**, Drucken (A4 quer) oder CSV.

**Backup:** Startseite → „Backup exportieren (JSON)“ (Banner erinnert an das Alter). **Restore:** „Backup importieren“
(ersetzt alle Daten, mit Rückfrage). Dateinamen enthalten keine Jahreszahl.

## Wertung (`scoring.js`, Konstanten oben änderbar)

```js
export const MIN_CARDS = 5;   // Mindestanzahl Karten je Person
export const COUNT_BEST = 5;  // so viele beste Karten zählen
export const MAX_RATING = 5;
```

- Versuch: Selbst-/Fremdsumme (3 Kategorien à 0–5). Bonus auf d = |Selbst − Fremd|: d ≤ 2 → +3, d ≤ 4 → +1, sonst 0.
- Kartenpunkte = Fremdsumme + Bonus (max 18); je Person und Karte zählt der beste Versuch; Manöver = Summe der 5 besten.
- Landgang: Seilziehen 3/Runde · Müll 5/3/1, +2 für den skurrilsten Fund (nur mit Person **und** Fund) · Geocaching 2/Cache.
- Gesamt = Manöver + Landgang; Gleichstand = gleicher Platz (1,1,3 …).
- **Teilwertungen:** Fehlt Manöver oder Landgang (oder eine Landgang-Disziplin), erscheint trotzdem ein Zwischenstand
  („–“ statt 0, Hinweis was fehlt, Teil-Ranglisten im Überblick).

## Datenmodell

`cards.json` (unverändert): `id, title, tag, intro, steps[6], error, stepCaptions, images`. Zustand:
`{version, boot, crew[{id,name}], versuche[{id,karte,rudergaenger,bewerter,selbst{k,c,s},fremd{k,c,s},notiz}],
landgang{seilziehen[{gewinner}], muell{platz1..3, skurril{person,fund}}, geocache{personId:n}}, meta{letztesBackup, rev}}`.

## Annahmen

Bild 1–13: 6 Einzelbilder; Karte 14/15: 2 große Bilder für alle 6 Schritte. Bewertungen anderer bleiben erhalten,
wenn eine Person entfernt wird (Bewerter → „entfernt“); deren eigene Versuche entfallen. Kein Piratenlook, keine Jahreszahlen im UI.
