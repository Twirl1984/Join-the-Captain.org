# Review-Landkarte: Zweisprachigkeit + Marketing-Grundlage

Branch `feat/toern-share-cta`, 17 Commits, **1870 zählbare Zeilen**.

Das Diff-Gate blockt ab 800 Zeilen. Das ist hier kein Versehen: Eine App
zweisprachig zu machen lässt sich nicht in 400-Zeilen-Häppchen aufteilen, ohne
zwischendurch einen kaputten Zustand zu hinterlassen. Für genau diesen Fall
sieht das Gate das Label **`size-override`** vor. Diese Datei ersetzt den
fehlenden kleinen Diff durch eine Landkarte.

## In welcher Reihenfolge man das liest

**1. Das Fundament — hier steckt die Denkarbeit** (~15 Min)
- `src/lib/i18n/sprache.ts` — reine Logik: Sprachnormalisierung, Nachschlagen
  mit Rückfallkette, Platzhalter. Ohne Bibliothek, offline testbar.
- `src/lib/i18n/server.ts` — die einzige Stelle mit Next.js-I/O. **Wichtig:**
  Die Browser-Vorgabe (`Accept-Language`) wird bewusst NICHT ausgewertet, weil
  die englische Fassung absichtlich unvollständig ist (Rechtstexte deutsch).
  Begründung steht im Code.
- `src/lib/i18n/__tests__/woerterbuch.test.ts` — die Strukturtests. Sie fangen
  die Fehler, die beim Pflegen zweier Sprachen wirklich passieren.

**2. Die Sicherheitsgrenze — der Teil, der eine zweite Meinung braucht**
Was bewusst deutsch bleibt und warum, jeweils mit `lang="de"` ausgezeichnet:
- `src/components/SiteFooter.tsx` — Affiliate-Pflichthinweis (UWG)
- `src/app/navigation/page.tsx` — „ersetzt keine amtlichen Seekarten"
- `src/components/navigation/NavApp.tsx` (Peilung) — „ersetzt keinen
  Handpeilkompass"

**Offene Frage an den Betreiber:** Eine Pflichtkennzeichnung, die der Leser
nicht versteht, erfüllt ihren Zweck möglicherweise nicht. Für einen echten
englischen Auftritt braucht es juristisch geprüfte englische Fassungen.

**3. Was Nutzer sehen**
- `/preise` — Produkt- und Preisseite. Fähigkeiten und Abgrenzung stehen
  gleichwertig nebeneinander, nicht als Kleingedrucktes.
- Geteilte Törn-Seite — Aufruf „Plane deinen eigenen Törn". Vorher lief der
  billigste Vertriebskanal des Projekts ins Leere.
- Sprachschalter: auf breiten Schirmen im Kopf, auf schmalen im Fuß.

## Was unterwegs gefunden wurde (nicht geplant, aber wichtig)

| Fund | Wo |
|---|---|
| Das trace-Gate übersprang **stillschweigend** 3 Anforderungen mit abweichendem Status-Feld — eine davon (REQ-NAV-027) war schon länger unsichtbar | `scripts/trace-check.ts`, jetzt bricht es ab |
| `gpsPlausibility` zeigte gerundete Werte, urteilte aber ungerundet — die App konnte „1,50 sm / 1,50 sm" anzeigen und trotzdem „unplausibel" melden | `peilung.ts`, Betreiber-Entscheidung umgesetzt |
| Ein Property-Test war sporadisch rot (etwa jeder 20. Lauf) — zwei eigene Fehler: `Math.random()` im Test und eine falsche Behauptung | `peilung.test.ts` |
| Die Kartentests prüften mit `count()` statt wartend — unter WebKit sporadisch rot | `e2e/navigation.spec.ts` |
| Der Sprachschalter im Kopf sprengte auf 412-px-Handys das Layout und machte den Vollbild-Schalter unklickbar (per Bisect nachgewiesen) | Schalter wandert auf schmalen Geräten in den Fuß |
| Ein Übersetzer-Agent zerstörte 128 Anführungszeichen (typografisch statt gerade) | repariert, zustandsbewusst |
| Zwei sachliche Fehler in Warntexten: „high sea" heißt *hohe See*, nicht *hohe Welle* | vom Sprachprüfer gefunden |

## Zahlen

- 217 Wörterbuch-Schlüssel je Sprache, Strukturtests erzwingen Gleichstand
- `/navigation`-Bundle: **23,4 kB** — kleiner als vor der Zweisprachigkeit
  (24,7 kB), weil nur die aktive Sprache an den Browser geht
- E2E: 168 bestanden, 4 übersprungen, vier Läufe hintereinander Exit 0
- verify grün, Mutation-Gate unverändert

## Was NICHT drin ist

- **E-Mail-Erfassung** (Marketing 2): technisch klein, aber sie erhebt
  personenbezogene Daten. Das braucht eine erweiterte Datenschutzerklärung —
  ein juristischer Text, den weder ich noch ein Agent schreiben sollte.
- **Beschreibungen der Wettermodelle** (`src/lib/weather/open-meteo.ts`, 4
  Texte): Fachdaten in der Domänenschicht, kein Oberflächentext. Eigener Schritt.
- **URL-Präfixe `/de/` und `/en/`**: Für Suchmaschinen besser, bricht aber alle
  bestehenden Links. Eigenes Vorhaben, wenn internationale Sichtbarkeit zählt.
