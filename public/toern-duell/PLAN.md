# Plan (Kurzfassung)

1. Wertungslogik rein + getestet (`scoring.js`, Orakel + Golden + DOE).
2. Zustand/Persistenz (`state.js`, `store.js`, `idb.js`, `persistenz.js`) – zwei Speicherorte, Verlauf.
3. Views (Start, Karten, Karte, Bewertung, Landgang, Rangliste, Überblick) + Druck.
4. PWA (`sw.js` mit Precache-Liste + Drift-Test, Manifest).
5. E2E über echte UI gegen das Orakel auf iPhone/Safari/Chromium; Offline auf Chromium + manuell auf dem iPhone.
Entscheidungen: statisch in `public/` (Offline/Datensicherheit), lokal robuster statt Server, kein Login („nur dein Gerät“).
