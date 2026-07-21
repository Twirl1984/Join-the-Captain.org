# Übergabe: Erlebnis-Artikel + Deep-Research + Sommer-Törns (für einen neuen Chat)

Stand 2026-07-21. Dieser Chat hat i18n, Marketing-Seiten, Conversion-Messung und
einen Video-Analyse-Prototyp gebaut und wird hier **bewusst beendet**. Diese Datei
ist die Übergabe: Eine frische Session soll das folgende Feature integrieren.

## Das Ziel (Wunsch des Betreibers)

Ein **schöner Artikel auf der Website** mit vertiefendem Inhalt aus **Deep Research**
und Empfehlungen → auf **konkrete Törns gemappt** → als **buchbare Wochen für diesen
Sommer** (Ende August / September 2026, die Chris als Skipper selbst fahren kann).

Das schließt den Funnel: Reel/Recherche → Artikel (.org = Reichweite/SEO) → konkreter
Törn → Bewerbung auf **.de** (Crew-Matching = Umsatz).

## Architektur, die man verstanden haben muss

- **`.de` = das Geld:** Crew-Matching-Marktplatz (~20 % Fee). Hier entstehen die
  „Fahrten, auf die sich Leute bewerben". Eigenes Repo `~/github/join-the-captain`.
- **`.org` = die Reichweite:** Törnplanung, Tools, Erlebnisse, Content/SEO — der
  Funnel, der Leute zu .de bringt. Repo `~/github/Join-the-Captain.org` (Next.js 15).
- **Instagram `join.the.captain` / YouTube = oben im Trichter.**
- **BayStartUP-Jury (Phase III):** Reichweite/Funnel ist das **existenzentscheidende
  Risiko** — genau hier setzt dieses Feature an. Jury-Feedback:
  `~/github/join-the-captain/Businessplanning/Feedback_PhaseIII_BayernStartup/`.
  Businessplan: `.../Businessplan_JoinTheCaptain.md` (Executive Summary lesen!).

## Was SCHON existiert (nicht neu bauen)

- **Conversion-Messung (REQ-BIZ-001), LIVE:** Plausible-Events + UTM. Spec in
  `docs/conversion-messung.md`. Namen zentral in `src/lib/analytics/ereignisse.ts`.
  → Jeder neue Artikel/CTA sollte diese Events/UTM nutzen. **Offen für den Betreiber:**
  die 5 Ziele einmal im Plausible-Dashboard anlegen.
- **Zweisprachigkeit (REQ-I18N-001):** UI DE/EN über `src/lib/i18n/`. Wörterbuch
  `woerterbuch.ts`. **Inhalt** (DB-Texte) ist NICHT übersetzt — Artikel zunächst
  Deutsch, EN als Angebot. Rechts-/Haftungstexte bleiben deutsch (`lang="de"`).
- **Produkt-/Preisseite `/preise`, Aufruf auf geteilten Törns** (REQ-EXP-010/011).
- **Erlebnis-/POI-System:** `src/lib/erlebnis/`, Tabellen `revier_poi`/`poi_vote`,
  Append-and-Review-Skill `.claude/skills/erlebnis-wissen`. Konzept
  `docs/erlebnis-system.md`. **Auf Produktion sind die POIs leer** (neu, kein Verlust).
- **Video-Analyse-Fähigkeit (Prototyp in diesem Chat, funktioniert):**
  `ffmpeg` (Frames) + `whisper-cli` mit `~/.whisper-models/ggml-medium.bin` (Transkript).
  Der Betreiber legt Videos in `spannende_routen/IG/` ab, der Agent verarbeitet die
  LOKALEN Dateien (legitim, kein Scraping). Erstes Beispiel unten.
- **Reviere** (`src/lib/navigation/reviere.ts`): Nordsee, Ostsee, Rügen, Dänische
  Südsee, Kieler Bucht, Nordfriesland, Kroatien, Balearen, Griechenland, Binnen …
  **KEIN Schweden/Bohuslän-Revier** — für schwedische Schären-Inhalte anlegen.

## Was zu bauen ist (Kern der Übergabe)

1. **Artikel-System** — bisher ist `/wissen` nur video-basiert (`getWissenVideos`).
   Passt zu **REQ-EXP-008 „Revier-Wiki mit Linting"** (Status: geplant): je Revier ein
   LLM-kompilierter Artikel als Inhaltsquelle, mit Linting-Zyklus (Karpathy
   Append-and-Review). Der Betreiber will „einen schönen Artikel mit Deep Research".
2. **Deep-Research-Anbindung** — der `deep-research`-Skill existiert. Recherche zu
   einem Revier/Thema → Quellen → Empfehlungen → in den Artikel.
3. **Mapping auf Törns** — Recherche/Artikel → konkrete Route (über die
   .org-Planung) → **Törn-Vorschlag** (REQ-EXP-006) → als buchbare Woche auf **.de**.
4. **Sommer-Planung** — konkrete Wochen **Ende August / September 2026**, die Chris
   fahren kann. Heute ist 2026-07-21; das ist die kommende Saison.

## Konkreter erster Input: Bohuslän-Reel (schon analysiert)

Quelle: Instagram-Reel @work_sail_balance (`spannende_routen/IG/744a06446e214a5b86090ad80fc31e78.mp4`),
per Whisper transkribiert. Törn Kiel→Oslo→zurück, schwedische Westküste. Extrahiert:

- **Smögen** (Partyplace) → **Gullholmen** (60er-Charme) → **Sund hinter Tjörn/Orust**
  (in 30-kn-Böen geschützte Ankerplätze — ⚠️ **nur mit Masthöhe unter 26 m**, Brücke!)
  → **Åstol/Dyrön** (Dyrön: Mufflons, Schlucht, Schwedens bestbewertete Sauna) →
  **Marstrand** (touristisch, 50 € Hafen, lohnt) → **Brannö** (überlaufen) →
  **Bucht vor Kungsbacka** → Anholt → Dänische Südsee → Kiel.
- **Timing-Intelligenz:** schwedische Sommerferien → Häfen brechen über → Ankerbuchten
  statt Marinas planen.
- **App-Gold:** die Masthöhe-<26 m-Randbedingung ist eine echte Routen-Restriktion
  (Brückenhöhe) — genau der Mehrwert der .org-Planung.

Das ist der erste Artikel-Kandidat: „Die geschützte Schären-Route" + ein Törn-Vorschlag
Ende August (Bohuslän ist im Spätsommer schwächer besucht als in den schwed. Ferien).

## Offene Entscheidungen für den neuen Chat / Betreiber

1. Neues Revier **„Bohuslän / Schweden-West"** in `reviere.ts` anlegen? (empfohlen)
2. Artikel-Datenmodell: neue Tabelle `revier_artikel` (REQ-EXP-008) oder erst als
   MDX/statischer Inhalt? Empfehlung: klein anfangen (ein Artikel), dann Muster.
3. Wie hängt der Törn-Vorschlag konkret an **.de** (Deep-Link / manuelle Übernahme)?
4. Content-Loop (Video → Telegram-Push): in diesem Chat vorbereitet, **Telegram-Bot
   darf mitgenutzt werden** (Betreiber-Freigabe), Bot-Token liegt auf dem VPS
   (Morning-Session nutzt ihn). Chat-ID vom Betreiber holen.

## Prozess & Technik (bindend)

- **Vorgehen:** ASPICE/ISTQB, REQ-IDs in `docs/REQUIREMENTS.md`, Tests mit
  `[REQ-…]`-Tags, `npm run verify` grün. Skills: `dev-loop`, `dev-tdd`,
  `qa-adversarial`, `aspice-istqb-workflow`, `erlebnis-wissen`, `deep-research`.
- **Reine Logik I/O-frei** (offline testbar), Muster wie `src/lib/navigation`.
- **Trace-Gate ist scharf:** REQ-Zeilen exakt `(Status: umgesetzt|in-arbeit|geplant)`,
  jeder Test-Tag muss auf ein existierendes REQ zeigen (sonst bricht `trace`).
- **Deploy-Weg (in diesem Chat erprobt, funktioniert):**
  rsync nach `root@194.164.197.23:/srv/jtc-org-test/repo/` (SSH von diesem Mac aus,
  NICHT aus einem Cloud-Container) → `docker compose -p jtc-org-test -f
  docker-compose.test.yml up -d --build` → bei neuer Migration VORHER
  `npx -y tsx scripts/migrate.ts` im Einweg-Container (Runtime-Image hat kein tsx →
  `npx`; `scripts/seed.ts` läuft NICHT im Image, weil `src/` fehlt). `.htpasswd`/nginx
  NICHT anfassen. `:443` ist öffentlich, `:3100` passwortgeschützt. **DB vor jeder
  Migration sichern** (`pg_dump`, Beispiel-Backup: `/root/jtc-org-test-db-*.sql`).
- **Arbeitskopie:** ein sauberer Clone/Worktree im Scratchpad; git-Binary
  `/Library/Developer/CommandLineTools/usr/bin/git`; git-Identität
  `Twirl1984@users.noreply.github.com`. `main` nur mit Freigabe, volles Gate vorher.

## Weitere offene Punkte (nicht Teil dieses Features, aber bekannt)

- Feature-Pipeline (Cloud-Routine) **läuft leer**; VPS-dev-sessions haben
  **Shell-Syntaxfehler** — beide autonomen Loops sind aktuell defekt.
- `0009_app_interesse.sql` (E-Mail-Vormerkung) ist **zurückgehalten** bis die
  Datenschutzerklärung die Verarbeitung abdeckt (Menschen-Text).
- Englische Rechtstexte (Affiliate-/Haftungshinweis) brauchen juristische Prüfung.
