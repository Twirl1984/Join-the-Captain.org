# JTC Design-Paket — join-the-captain.org

**Projekt:** Join the Captain — Community- & Medien-Standbein
**Umfang:** `.org`-Gesamtsite + Feature-Board (Kernstück)
**Zielformat:** Claude Design / Canva / Figma-ready
**Version:** 1.0 · Juni 2026
**Autor:** Dr. Christoph Funda

> **Konsolidierungs-Hinweis:** Der Community-Feature-Loop, ursprünglich für `.de` gedacht, lebt jetzt auf `.org`. `.de` bleibt die schlanke Buchungsplattform. Dieses Paket beschreibt die komplette `.org`-Designwelt: die Site-Struktur (Teil B) und das Feature-Board als Herzstück (Teil C). Teil A gilt für beide.

---

# TEIL A — Gemeinsame Marken- & Design-Grundlage

*(Gilt für alle Screens in diesem Paket.)*

## A.1 Stil-Leitbild
Maritim-modern, ruhig, hochwertig, redaktionell. Kein Kitsch, keine Anker-Romantik, kein Wellen-Hintergrund, keine Segelpfeifen-Deko. Die Farben und Icons tun die Arbeit. Feature-Karten fühlen sich an wie ein lean Karten-Deck — stackbar, klar, swipe-fähig auf Mobile.

## A.2 Farben (JTC-Palette)
```
Primär:    Navy Deep    #0B2545   Header, Hero, große Flächen
           Navy Mid     #13315C   Akzentflächen, Borders, Secondary
           Teal         #2EA39E   Primary CTA, Icons, Highlights

Sekundär:  Gold         #C9A24B   Pledge, Podcast, Warming
           Gold Light   #D4A85B   Progress-Bars, lighter Accent

Neutral:   Salt-White   #F4EEE2   Text auf Navy, helle Flächen
           Weiß         #FFFFFF   Card-Background
           Grau 50      #F1EFE8   Dividers, light Flächen
           Grau 200     #B4B2A9   Text Secondary
           Dunkelgrau   #444441   Text Primary auf Weiß

Phasen-Akzente (Journey-Tags):
           Vor Buchung  neutral/grau
           Planung      Blau   BG #E6F1FB · Text #185FA5
           Auf dem Törn Teal   BG #E1F5EE · Text #0F6E56
           Danach       Gold   BG #FAEEDA · Text #854F0B
```

## A.3 Typographie — Poppins
```
H1   Bold 28px    Seitentitel (selten)
H2   Bold 22px    Bereich-/Hero-Titel
H3   Medium 16px  Card-Titel, Wunsch-Titel
Body Regular 14px Beschreibungen, Standard
Label Medium 12px Tags, Badges, Filter-Pills
Caption Reg 11px  Timestamp, Affiliate-Hinweis, Meta
```

## A.4 Ton (Brand Voice)
- **Du-Form** konsequent („Was wünschst du dir?", nie „Sie").
- **Kurze Sätze.** Max 2 Zeilen pro Info-Block.
- **Maritim-natürlich:** Wunsch, Törn, Crew, Skipper, Bordkasse, Revier, Runde.
- **Nicht:** „Ahoi", „revolutionär", „mega", Ausrufezeichen-Inflation (max 1/Screen).
- **Pledge-Sprache:** „Unterstütze", „Feature-Pledge", „beitragen", „Community-Funded".
  **Niemals:** „investiere", „Anteil", „Beteiligung", „Rendite".
- Vor jeder finalen Copy: `/mnt/skills/user/jtc-brand-voice/SKILL.md` konsultieren.

## A.5 Icons
- Tabler **Outline** (nicht filled), durchgängig.
- Größen: 16px Body · 20px Button · 24px Header.
- Farbe: Teal primär, Navy Secondary, Gold für Pledge/Podcast.

## A.6 Globale Regeln
- **Affiliate-Kennzeichnung Pflicht (UWG):** jeder Affiliate-Link sichtbar als „Affiliate · ohne Mehrkosten".
- Externe Links: `target=_blank rel="noopener noreferrer"`.
- Kontrast ≥ 4.5:1 (WCAG AA). Icon-only Buttons mit `aria-label`.
- Animationen nur bei Hover, < 150ms. Font-Sizes skalieren nicht (Lesbarkeit first).
- Touch-Targets ≥ 44px auf Mobile.
- Breakpoints: 320px Mobile · 768px Tablet · 1200px Desktop.

---

# TEIL B — `.org`-Site (Medien- & Affiliate-Standbein)

Content- und empfehlungsgetrieben. Vier Bereiche, die sich Daten teilen: Feature-Loop (Teil C), Tool-Verzeichnis, Podcast, Segler-Entrepreneurs.

## B.1 Startseite (Aufbau oben → unten)

### 1) Header — Navy Deep, volle Breite
- Links: Logo (`ti-compass` im Teal-Quadrat 30px) + „join-the-captain**.org**" (Medium 15px, „.org" in Teal-hell).
- Nav: Tools · Podcast · Entrepreneurs · Community.
- Rechts: Teal-Button „Zur Buchung →" (verlinkt auf `.de`). Mobile: Burger.

### 2) Hero — Navy Mid, centered, Border-radius 12px, Padding 22px
- H2 Salt-White: „Alles für deinen Törn — von der Planung bis nach dem Anlegen"
- Subline (Teal-hell, max 440px): „Geprüfte Tools, ehrliche Empfehlungen und Stimmen aus der Szene. Von Seglern für Segler."

### 3) Tool-Verzeichnis-Auszug „Tools für deinen Törn"
- Abschnitts-Label + Filter-Pills nach Journey-Phase:
  `[Alle]` (aktiv, Teal BG) · Vor Buchung · Planung · Auf dem Törn · Danach (inaktiv: Weiß + 0.5px Border).
- Tool-Karten-Grid: `auto-fit, minmax(200px, 1fr)`.

**Tool-Karte:**
```
┌──────────────────────────────┐
│ [Icon 34px]  Navi & Seekarten │  ← Icon im Navy-Quadrat + Titel Medium 13px
│              [Auf dem Törn]   │  ← Journey-Tag (farbig nach Phase)
│                               │
│ Offline-Karten fürs Mittelmeer│  ← Kurzbeschreibung Regular 11px, 2 Zeilen
│ und die Ostsee.               │
│                               │
│ Affiliate · ohne Mehrkosten   │  ← Caption grau (links)
│                   Ansehen →   │  ← Teal, ti-arrow-right (rechts)
└──────────────────────────────┘
```
Beispiel-Tools (über alle Phasen): Navi & Seekarten (Auf dem Törn), Skipper-Versicherung (Danach), Wetter & Wind (Planung), Bordkassen-Splitter (Auf dem Törn), Packlisten-Generator (Vor Buchung), Foto-Sharing für die Crew (Danach).

### 4) Podcast-Strip — Navy Deep, horizontal, Border-radius 12px
- Links: `ti-microphone-2` im Teal-Quadrat 46px.
- Mitte: Label „DER PODCAST" (Teal, uppercase, letter-spacing) / Titel „Segeln & Selbstständigkeit" (Salt-White Medium 15px) / „Folge 7 · Wie aus einem Törn ein Business wurde" (Grau 12px).
- Rechts: Gold-Button „▶ Hören".

### 5) Segler-Entrepreneurs — Weiß-Card, 0.5px Border
- Label „Segler-Entrepreneurs" + „Kollegen, die gute Arbeit machen".
- Partner-Chips: Avatar-Kreis (Initialen auf Navy) + Name + Rolle.
  Beispiele: Yachtcharter (Charter-Partner), Skipper-Schule (Ausbildung), Reise-Versicherung, Foto & Film.

### 6) Affiliate-Disclaimer-Footer — centered, Caption grau, `ti-info-circle` Teal
„Mit Affiliate gekennzeichnete Links bringen JTC eine Provision — für dich ohne Mehrkosten."

## B.2 Tool-Detail-Seite
- Hero: App-Icon + Name + Journey-Phase-Tag.
- Abschnitte: **Wofür es gut ist** · **Was es kostet** · **Für welche Crew** · **Unsere ehrliche Einschätzung** (Pro/Contra-Liste).
- Prominenter Teal-CTA „Zur App →", Affiliate-Kennzeichnung direkt darunter.
- Verwandte Tools als Karten-Reihe am Ende.

## B.3 Podcast-Seite
- Folgen-Liste (RSS/Embed), Player, sprechende Slugs, Folgen-Nummer + Datum + Dauer.

## B.4 Entrepreneurs-Seite
- Partner-Netzwerk-Grid, je Partner: Logo/Initialen, Name, Rolle, Kurzbeschreibung, Link.

## B.5 `.org` States & Responsive
- Filter-Pill aktiv = Teal BG; inaktiv = Weiß + Border.
- Tool-Karte Hover: Border 0.5px→1px Teal, minimaler Schatten.
- Desktop 3–4 Spalten · Tablet 2 · Mobile 1. Nav → Burger.

---

# TEIL C — Feature-Board (Kernstück, maximal ausgearbeitet)

Die zentrale Oberfläche unter `/community`. Hier reichen Segler monatlich Feature-Wünsche ein, eine KI strukturiert und prüft sie, die Community votet, und es entstehen drei Ergebnisse: **BUILD** (wird gebaut), **AFFILIATE** (App existiert schon, wir empfehlen sie), **VERWORFEN** (sinnvoll, aber nicht Priorität).

**Das Board soll:** transparent machen, wie Entscheidungen entstehen · inklusiv wirken (jede/r wünscht & votet) · Vertrauen in die KI-Prüfung schaffen · Pledges sichtbar machen ohne zu drängen · Affiliate-Apps elegant empfehlen.

## C.1 Seitenaufbau (oben → unten)

### 1) Header — Navy Deep, 60px
- Links: Logo (`ti-anchor`/`ti-compass` im Teal-Quadrat) + „Join the Captain · Community".
- Rechts: Status-Pill (Navy Mid BG, `ti-clock` Teal, „Voting endet in 6 Tagen") + Discord-Button (Outline Teal, `ti-brand-discord`, „Zur Community").

### 2) Mini-Stepper — Weiß, 0.5px Border, Padding 12px
Vier Schritte, Desktop inline / Mobile 2×2. Icon 20px Teal + Label Medium 12px, Divider Grau 50 dazwischen:
```
[ti-bulb] Wunsch posten → [ti-robot] KI prüft →
[ti-thumb-up] Community votet → [ti-flag] Ergebnis
```

### 3) Input-Section „Wunsch einreichen" — Weiß, 0.5px Border, Border-radius 12px, Padding 16px
- Textfield (Placeholder „Was wünschst du dir für deinen Törn?", Border-bottom 0.5px, min-height 40px).
- Teal-Button „Wunsch einreichen" (`ti-send`, Hover → Navy BG, Scale 1.02; Mobile vollbreite).
- Hinweis darunter (Regular 12px Grau): „Der Bot strukturiert deinen Wunsch und prüft, ob es dafür schon eine App gibt."

### 4) Abschnitts-Label
„Aktuelle Runde · 3 Vorschläge" (links) + „sortiert nach Votes" (rechts, Grau 12px).

### 5) Feature-Karten-Grid
`auto-fit, minmax(280px, 1fr)`. Desktop ≥1200px: 3 Spalten · Tablet 768–1199px: 2 · Mobile ≤600px: 1.
Card allgemein: Weiß BG, 0.5px Border Grau 50, Border-radius 12px, Padding 16px 18px, flat (kein Schatten).

### 6) KI-Moderation-Footer — centered, Grau 12px, `ti-shield-check` Teal
„Der KI-Crewguard hält den Ton an Bord freundlich."

## C.2 Die drei Kartentypen

### TYP A — BUILD-Kandidat (primär)
```
┌───────────────────────────────────────────┐
│ Bordkassen-Splitter mit Foto-Belegen      │ ← H3 Medium 16px Navy
│ [Auf dem Törn]  [Größe M · 5–8 Dev-Tage]  │ ← Journey-Tag + Sizing-Tag
│                       [BUILD-KANDIDAT ⚒]  │ ← Status-Badge Teal, rechts
│                                           │
│ Jeder fotografiert seinen Beleg, die App  │ ← Body Regular 14px
│ rechnet automatisch ab. Kein Zettel-Chaos │
│ mehr am letzten Abend.                    │
│                                           │
│ Pledge: 240 € von 600 €    12 Unterstützer│ ← Info-Zeile (rechts Gold)
│ [████████          ] 40%                  │ ← Progress-Bar Gold #D4A85B
│                                           │
│ [👍 Vote · 47]      [♥ 10 € beitragen]    │ ← Buttons (Outline Teal / Gold)
└───────────────────────────────────────────┘
```
- **Status-Badge:** Teal BG, Salt-White Text, `ti-hammer` 12px, „BUILD-KANDIDAT", Border-radius 6px.
- **Sizing-Tag:** Gold-Light 30% BG, Navy Text, `ti-ruler-2`, „Größe M · 5–8 Dev-Tage".
- **Progress-Bar:** BG Grau 50, Fill Gold #D4A85B, 6px hoch, Border-radius 3px.
- **Buttons (Flexbox, Gap 8px, Mobile gestapelt vollbreite):**
  - Vote: Outline Teal, `ti-thumb-up`, „Vote · 47", Hover BG Teal 10%.
  - Pledge: Outline Gold, `ti-heart`, „10 € beitragen", Hover BG Gold 10%.

### TYP B — Affiliate-Empfehlung
```
┌───────────────────────────────────────────┐
│ Offline-Seekarten fürs Handy              │ ← H3
│ [Auf dem Törn]                            │ ← Journey-Tag
│                       [GIBT'S SCHON 🔗]   │ ← Status-Badge Blau, rechts
│                                           │
│ Der Bot hat eine etablierte App gefunden, │ ← Body
│ die das gut löst — kein Eigenbau nötig.   │
│                                           │
│ ┌─ App-Sub-Card (Grau 50 BG) ──────────┐ │
│ │ [Icon] Empfohlene Navi-App           │ │
│ │        Affiliate-Link · ohne Mehrkosten│ │
│ │                          [Ansehen →] │ │
│ └──────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```
- **Status-Badge:** Blau BG #185FA5, Text #E6F1FB, `ti-external-link`, „GIBT'S SCHON".
- **App-Sub-Card:** Grau 50 BG, Border-radius 8px, Flex. Logo 40px (Navy BG, themenpassendes Tabler-Icon Teal) + Mitte (Name Medium 14px / „Affiliate-Link · für dich ohne Mehrkosten" 11px grau italic) + Button rechts (Outline Teal, `ti-arrow-right`, „Ansehen").

### TYP C — Verworfen (faded)
```
┌───────────────────────────────────────────┐
│ Farbmarkierungen für Crew-Identität       │ ← H3 gedimmt
│ [Vor Buchung]            [VERWORFEN]      │ ← grauer Badge
│ Gute Idee. Würde aber das Onboarding zu   │ ← Body grau
│ komplex machen. Nächste Saison neu prüfen.│
│ Abstimmung beendet · 12 Votes             │ ← Info klein grau
└───────────────────────────────────────────┘
```
- Card Opacity 0.7, Text Grau 200, Status-Badge Grau 200 BG / Dunkelgrau Text, Buttons disabled (opacity 0.4) oder ausgeblendet.

## C.3 States
- **Hover (Karte):** Border 0.5px→1px Teal, leichter Schatten `0 0 8px rgba(0,0,0,0.05)`.
- **Voted:** Vote-Button → „✓ Voted · 48", Text/Border Grau.
- **Pledging:** unter dem Pledge-Button erscheint inline ein Betrag-Input (€) + „Beitragen"-Submit (Gold).
- **Pledge Success:** Button → „✓ 10 € beigetragen".
- **Empty State:** BG Grau 50, centered, Padding 40px, `ti-inbox`, „Noch keine Wünsche eingereicht" + Outline-Teal-Button „Wunsch einreichen →".
- **Loading:** Karten-Skelette mit Shimmer (Grau-50-Platzhalter), Fade-in.

## C.4 Copy-Beispiele
- **Build** — Titel: „Bordkassen-Splitter mit Foto-Belegen" · Body: „Jeder fotografiert seinen Beleg, die App rechnet automatisch ab. Kein Zettel-Chaos mehr am letzten Abend." · Pledge: „240 € von 600 € · 12 Unterstützer".
- **Affiliate** — Titel: „Offline-Seekarten fürs Handy" · Body: „Der Bot hat eine etablierte App gefunden, die das gut löst — kein Eigenbau nötig." · Disclaimer: „Affiliate-Link · für dich ohne Mehrkosten".
- **Verworfen** — Body: „Gute Idee. Würde aber das Onboarding zu komplex machen. Nächste Saison neu prüfen."

## C.5 Feature-Detail-Seite (`/community/:id`)
Volle Beschreibung · KI-Sizing-Begründung · Pledge-Liste · Kommentare.

---

# TEIL D — Lieferable & Designer-Notizen

## D.1 Was geliefert werden soll
1. **Startseite `.org`** (Desktop + Mobile)
2. **Feature-Board** `/community` (Desktop + Mobile), alle 3 Kartentypen, alle States (Default / Hover / Voted / Pledging / Empty)
3. **Tool-Verzeichnis** `/tools` + **Tool-Detail** `/tools/:slug`
4. **Podcast-** und **Entrepreneurs-Seite**
5. **Kurzer Style-Guide:** Farb-Tokens, Typo, Button-/Input-Styles, Tool-Karten- & Feature-Karten-Style, Affiliate-Badge.

## D.2 Designer-Notizen
- **Keine Ablenkung:** jede Komponente hat eine klare Funktion. Keine dekorativen Grafiken oder Muster.
- **Maritim, nicht kitschig:** Farben und Icons reichen.
- **Karten-Deck-Gefühl** bei Feature-Karten: lean, stackbar.
- **KI als Vertrauensfaktor:** Crewguard und Bot-Struktur-Notizen transparent, nicht versteckt, nicht zu prominent.
- **Pledge-Sprache strikt:** nirgends „investieren"/„Anteil"/„Rendite". Immer „Unterstützen"/„beitragen".
- **Affiliate-Kennzeichnung** an jedem externen Empfehlungs-Link sichtbar.

## D.3 Optional — Dark Mode
Navy Deep ↔ Salt-White getauscht, Grau-Spektrum invertiert, Teal & Gold bleiben (mit Opacity-Anpassung).

---

*Ende des Pakets. Beide Briefs (`.org`-Site + Feature-Board) sind hier konsolidiert und teilen Teil A (Marke) sowie Teil D (Lieferable). Ablage empfohlen unter `/docs/design-paket.md` im Repo, damit Claude Code die Specs direkt zur Hand hat.*
