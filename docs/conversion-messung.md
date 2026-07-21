# Conversion-Messung — das „Controlling", das die Jury verlangt

Die BayStartUP-Phase-III-Jury nannte **Reichweite/Funnel das existenzentscheidende
Risiko** und forderte wörtlich: *„Führen Sie ein Controlling ein, um den
Aufwand/Nutzen zu messen."* Diese Datei ist dieses Controlling. Ohne sie sehen
wir Besucherzahlen, aber nie, ob aus einem Instagram-Post ein Nutzer wird.

Der Funnel: **Instagram / YouTube → .org (Reichweite) → .de (Umsatz).**

## 1. Die gemessenen Ereignisse (in Plausible als Ziele anlegen)

Die Namen kommen aus `src/lib/analytics/ereignisse.ts` (eine Quelle der Wahrheit).
Jedes muss im Plausible-Dashboard unter **Site Settings → Goals → Add Goal →
Custom Event** mit exakt diesem Namen angelegt werden, sonst taucht es nicht auf.

| Ziel (Custom Event) | Bedeutung im Funnel | Wo es feuert |
|---|---|---|
| `Route berechnet` | erster echter Nutzen — jemand plant wirklich | /navigation, nach erfolgreicher Berechnung |
| `Törn geteilt` | organische Reichweite, der billigste Kanal | „Törn teilen"-Knopf |
| `GPX exportiert` | ernsthafte Nutzung | GPX-Export |
| `Preise CTA` | Kaufinteresse | /preise, CTA-Klick |
| `Buchung geklickt` | **die Conversion** — Klick von .org nach .de | „Zur Buchung" in Kopf & Fuß |

Die aussagekräftigste Kennzahl ist die **Kette**: Wie viele von denen, die eine
Route berechnen, klicken am Ende „Zur Buchung"? Das ist eure Funnel-Conversion.

## 2. UTM — woher kam der Besucher?

Plausible liest `utm_source`, `utm_medium`, `utm_campaign` automatisch aus der
URL. Wer einen Link OHNE UTM teilt, ist „direkt" und nicht zuordenbar. Deshalb:
**jeder Link aus einem Post trägt UTM.**

**Konvention für eure Posts** (einfach, damit ihr es im Kopf habt):

| Kanal | Link, den ihr postet |
|---|---|
| Instagram-Reel | `https://join-the-captain.org/preise?utm_source=instagram&utm_medium=reel` |
| Instagram-Story | `…?utm_source=instagram&utm_medium=story` |
| Instagram-Bio | `…?utm_source=instagram&utm_medium=bio` |
| YouTube-Video | `…?utm_source=youtube&utm_medium=video` |
| Kampagne (z. B. Sommer-Ostsee) | zusätzlich `&utm_campaign=sommer-ostsee` |

Automatisch gesetzt (nichts zu tun):
- **Geteilte Törns** tragen `utm_source=toern-share&utm_medium=social`.
- **Klicks von .org nach .de** tragen `utm_source=org&utm_medium=funnel&utm_content=<kopf|fuss|preise>`.

## 3. Was ihr im Plausible-Dashboard einmal einrichtet

1. Die fünf Ziele oben als Custom Events anlegen.
2. Optional „Buchung geklickt" als **wichtigstes** Ziel markieren.
3. Danach zeigt der Filter „utm_source = instagram" euch: Wie viel Traffic bringt
   Instagram, und wie viele davon klicken am Ende zur Buchung?

Erst wenn das steht, ist „mach mehr Reels" eine messbare Aussage statt eines
Blindflugs — genau der Punkt der Jury.
