# JTC Community — 4-Wochen-MVP (Projektplan)

Strategischer Plan für die Community-Schicht rund um Discord. Festgehalten als
Roadmap; Teile davon (Feature-Loop, KI-Pipeline, Board) sind in diesem Repo
bereits umgesetzt — siehe [feature-board-spec.md](feature-board-spec.md).

> **Designentscheidung (festgehalten):** Die KI schätzt Aufwand als
> **T-Shirt-Sizing** (S/M/L/XL + Dev-Tage + grobe €-Spanne), **nicht** als
> €-Punktschätzung. LLM-Kostenschätzungen für echte Implementierung sind
> notorisch unzuverlässig — Sizing ist ehrlicher gegenüber der Community und
> verhindert, dass ein „800 €"-Feature später 4.000 € wird.

## Architektur

Siehe [architektur.md](architektur.md). Discord ist der zentrale Hub; `.de`
(Buchung + Community-Schicht) und `.org` (Affiliate/Podcast/Entrepreneurs)
speisen rein.

## Phase 0 — Setup (Woche 1)

**Discord-Server-Struktur**

| Kategorie | Channels | Zweck |
|---|---|---|
| 📌 Start | `willkommen`, `regeln`, `ankündigungen` | Onboarding, Verhaltensregeln |
| 💡 Features | `feature-wünsche`, `voting-aktuell`, `umgesetzt` | Kern-Loop |
| ⚓ Crew | `vorstellung`, `törn-suche`, `smalltalk` | Community-Bindung an `.de` |
| 🛠️ Tools | `app-empfehlungen`, `affiliate-finds` | speist `.org`-Verzeichnis |
| 📍 Lokal | `nürnberg`, (später weitere Städte) | Stammtische |
| 🎙️ Org-Standbein | `podcast`, `entrepreneurs` | `.org`-Content |

**Tech-Stack (passt zum Bestand):**
- Discord-Bot: **discord.js** (Node), im selben Docker-Setup auf dem VPS.
- KI-Calls: Claude API (Moderation + Sizing + Wunsch-Strukturierung).
- Voting-Persistenz: bestehende PostgreSQL-DB (Migration nutzen).
- n8n: nur für Side-Effects (Discord→DB-Sync, wöchentliche Trigger) — **nicht**
  für die Bot-Logik selbst.

## Phase 1 — Der Feature-Loop (Woche 2)

Das Herzstück. Empfohlener Rhythmus: **zweiwöchentlich** (wöchentlich brennt
Team und Community aus, monatlich verliert Momentum).

```
Tag 1–10:   Sammlung
  User postet Wunsch in #feature-wünsche
  → KI-Bot strukturiert: Titel, Journey-Phase, Problem, Nutzen
  → Bot prüft: "Gibt's dafür schon eine App?"
     → wenn ja: Link ins .org-Verzeichnis (Affiliate)
     → wenn nein: Kandidat für Voting

Tag 11:     KI-Sizing
  → Agent vergibt T-Shirt-Größe (S/M/L/XL + Dev-Tage + grobe €-Spanne)
  → Top-Wünsche wandern in #voting-aktuell

Tag 12–14:  Voting
  → Community votet (Discord-Reactions oder Bot-Buttons)
  → optional: Pledge-Mechanik "Ich würd 10 € beitragen"

Tag 14:     Auswertung
  → Bot postet Gewinner + Roadmap-Update
  → fließt in .de-Produktentscheidung
```

**KI-Bot-Rollen (3 Prompts):**
1. **Strukturierer** — Freitext-Wunsch → sauberes Feature-Ticket.
2. **App-Scout** — checkt, ob's das schon gibt → Affiliate-Chance.
3. **Sizer** — T-Shirt-Schätzung mit Begründung.

## Phase 2 — Moderations-Guardrail (Woche 2, parallel)

Juristisch heikel: KI-Moderation **flaggt und löscht nur bei klaren Verstößen**,
eskaliert Graubereiche an einen **menschlichen Mod**. Kein vollautomatisches Bannen.

```
Jede Nachricht → Claude-Moderation-Check
  ├─ harmlos        → durchlassen
  ├─ grenzwertig    → still flaggen, Mod-Channel benachrichtigen
  └─ klar Verstoß   → löschen + freundliche DM + Mod-Log
       (Beleidigung, Spam, Off-Topic-Werbung, NSFW)
```

Ton = JTC-Brand-Voice (Du-Form, ruhig, nicht oberlehrerhaft).

## Phase 3 — `.org` Affiliate-Standbein (Woche 3)

**„Tools für deinen Törn" — Verzeichnis entlang der Customer Journey:**

| Journey-Phase | Beispiel-Kategorien | Affiliate-Potenzial |
|---|---|---|
| Vor Buchung | Wetter-Apps, Revierführer, Packlisten-Tools | mittel |
| Planung | **Versicherung (Kaution/Haftpflicht — vor dem Törn!)**, Crew-Koordination, Bordkassen-Splitting | **sehr hoch** (Versicherung!) |
| Auf dem Törn | Navigation, Logbuch-Apps, Knoten-Lern-Apps | hoch |
| Danach | Foto-Sharing, Kontakt halten (Versicherung nur noch Support/Schadenklärung) | mittel |

Jeder Community-Wunsch, für den es schon eine App gibt → landet hier als
empfohlenes Tool mit Affiliate-Link. So schließt sich der Kreis.

**Pflicht — Affiliate-Kennzeichnung (§ 5a UWG, Trennungsgebot):** jeder
Affiliate-Link sichtbar als „Affiliate · ohne Mehrkosten". Fester
Disclaimer-Baustein, sonst Abmahnrisiko.

## Phase 4 — Monetarisierung & Lokal-Launch (Woche 4)

**Feature-Crowdfunding (optional aktivierbar):** statt Bezahl-Community →
**Pledge-pro-Feature**. Community pledged kleine Beträge auf gewünschte Features,
ab Schwellwert wird gebaut. Niedrigschwellig, testet echte Zahlungsbereitschaft.

> ⚠️ **Rechtlicher Hinweis:** Sobald Geld für noch-nicht-existente Features
> eingesammelt wird, ist das je nach Ausgestaltung **Crowdfunding/Vorkasse** —
> berührt Gewährleistung, Rückabwicklung bei Nicht-Umsetzung, ggf.
> Anzahlungsregeln. Mit demselben Anwalt klären wie § 651a BGB. (Fragen lassen
> sich vorformulieren.)

**Nürnberg-Stammtisch als Pilot:** `#nürnberg`-Channel + erstes physisches
Treffen, Event-Orga-Template. Läuft's → Blaupause für weitere Städte.

## Offene Entscheidungen (vor weiterem Bau zu klären)

1. **Rhythmus:** zweiwöchentlich (Vorschlag), wöchentlich oder monatlich?
2. **Kostenschätzung:** T-Shirt-Sizing (Vorschlag, bereits so umgesetzt) oder feste €-Zahl?
3. **Pledge-Mechanik:** gleich im MVP (bereits angelegt) oder erst Phase 2 nach Launch?
4. **Startpunkt Discord:** zuerst Server-Struktur + 3 KI-Bot-Prompts (kritischer Pfad)?
