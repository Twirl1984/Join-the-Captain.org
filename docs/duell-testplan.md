# Testplan Törn-Manöver-Duell (ISTQB-Hierarchie, DOE/Six Sigma)

Geräte-Priorität: **iPhone** (WebKit/iOS Safari) und **dieser Mac** (Desktop-Safari = WebKit, daneben Chromium).
Alle Berechnungen deterministisch: ganzzahlig, keine Uhr/kein Zufall in der Logik; „Zufall“ in Tests nur über feste Seeds.

| Ebene | Was | Wo | Befehl |
|---|---|---|---|
| Komponente/Unit | Wertung, Zustand, Speicher, CSV, Karten, Router, Entwurf, Überblick | `src/lib/toern-duell/__tests__/*.test.ts` | `npm run test:duell` |
| Golden Standard | unabhängiges Orakel (`support/orakel.ts`) + **von Hand gerechnetes Referenz-Szenario** (5 Personen) | `golden.test.ts`, `teilwertung.test.ts` | dito |
| DOE / Six Sigma | 81 statt 46.656 Läufe + Mutationsbeweis | `doe.test.ts`, `support/doe.ts` | dito; Referenzlauf `DUELL_EXHAUSTIV=1` |
| Invarianten | Property-Tests (fast-check, fester Seed) | `golden.test.ts` | dito |
| Integration | State-Operationen → Orakel → Export/Import-Roundtrip | `golden.test.ts` | dito |
| System/E2E | Referenz + Zufall über die **echte UI**, Teilwertungen, Speicherausfälle, Import/Export, 15 Karten, Layout | `e2e/toern-duell.spec.ts` | `npm run build && npx playwright test e2e/toern-duell.spec.ts` |
| Offline/PWA | SW, Precache, Neustart offline, offline bewerten | dito (Chromium) + manuell iPhone | s. u. |

## DOE-Reduktion der Bewertungskombinationen

Vollfaktoriell: 6 Faktoren × 6 Stufen = 46.656. Reduktion:
1. **Faktoren bündeln:** Punkte hängen nur an S (Selbstsumme) und F (Fremdsumme) → 256 Äquivalenzklassen (Gitter: Σ Punkte = 2192, Mittel 8,5625, von Hand).
2. **Orthogonale Arrays:** L25 (Stufen 0,1,3,4,5; paarweise orthogonal, geprüft) für Kategorien-Zuordnung/Wechselwirkungen;
   2^(6−2) auf den Stufen 2/3 → Mittelwert exakt 2,5 je Faktor.
3. **Grenzwerte:** d = 0…6 beidseitig bei F = 0, 7, 8, 15 (Kanten 2|3 und 4|5).
Kernplan = **81 Läufe** (−99,8 %). **Beweis:** 16 Mutanten (Schwellen, Bonuswerte, fehlende Kategorie, Vorzeichen, Cap …) — der Kernplan
tötet jeden, den der Vollplan tötet; ohne L25/Grenzläufe überlebt mindestens ein Mutant.

## Golden-Referenz (von Hand, Auszug)

A: Kartenpunkte [15,17,14,18,12,5,7] → Top-5 76 · B: 12+3+12 = 27 (3 Karten) · C: 5×18 = 90 · D: 0 · E: 81.
Landgang A11 B10 C7 D1 E6 → Gesamt C97 · A87 · E87 (Gleichstand → Platz 2/2) · B37 · D1 → Plätze 1,2,2,4,5.

## Geprüfte Varianten (Auswahl)

0/1/11 Personen · 12. Person · Gleichstand · < 5 Karten · mehrere Versuche (bester zählt) · Bearbeiten/Löschen · Person entfernen ·
nur Manöver / nur Landgang / nur eine Disziplin · skurriler Fund (Reihenfolge Fund↔Person) · IndexedDB oder localStorage kaputt ·
beide kaputt (Verlauf) · alles kaputt (Reset + Rohdaten gesichert) · JSON-Export/Import · defekter Import · CSV · Überblick-HTML (XSS-sicher) ·
alle 15 Karten inkl. Bilder · Layout 390 px ohne horizontales Scrollen · Offline-Neustart.

## Manuelle Abnahme auf dem iPhone (Playwright-WebKit kann keinen Service Worker prüfen)

Voraussetzung: HTTPS-Adresse (Staging/Produktion) mit der gebauten App.
- **M1** Safari: `…/toern-duell/index.html` öffnen, 10 s warten. **M2** Teilen → Zum Home-Bildschirm; Icon vorhanden.
- **M3** 3 Personen anlegen, Karte 14 öffnen, 1 Versuch bewerten (Live-Bonus sichtbar). **M4** Flugmodus an, App **komplett schließen** (App-Wechsler) und neu starten.
- **M5** Alles unverändert (Crew, Versuch, Rangliste); Karten + Bilder laden; Bild antippen → Vollbild, Pinch-Zoom. **M6** Offline einen zweiten Versuch speichern, App neu starten, noch da;
  Startseite: „Gespeichert in: IndexedDB ✓ · Browser-Speicher ✓“; JSON-Export öffnet das Share-Sheet.
