# Research-Scout — nächtliche Affiliate- & Open-Source-Recherche

Der **Research-Scout** ergänzt den synchronen App-Scout (`src/lib/pipeline.ts`,
nur Modellwissen) um eine tiefe, **web-gestützte Nacht-Recherche**. Er arbeitet
offene Themen ab, ist still, wenn nichts Neues anliegt, und wacht von selbst
auf, sobald neue Wünsche/Tools im Board liegen — oder die Community meldet.

## Stufen-Leitbild pro Thema

Für jedes Thema strebt der Scout vier Ebenen an — von „sofort empfehlbar" bis
„selber bauen":

1. **Premium-App (auch ohne Affiliate)** — das beste etablierte Tool wird immer
   gelistet, selbst wenn es kein Partnerprogramm hat (z. B. **Navily** — fast
   unersetzlich, aber kein öffentliches Affiliate-Programm).
2. **Beste Alternative — zwingend mit Affiliate** — hat die Premium-App kein
   eigenes Programm, prüft der Scout zuerst den **Mutterkonzern/ein Netzwerk**
   (z. B. **Navionics → Garmin Affiliate Program** ⇒ Status `ueber_partner`).
   Geht auch das nicht, sucht er eine vergleichbar gute Alternative, **die ein
   eigenes Programm hat**, und legt sie als eigenes Tool an (`hat_programm`).
3. **Kostenlose OSS-Alternative (mit gutem Rating)** — fertige Open-Source-App,
   Stars als Qualitätssignal (`oss_kandidat`, `typ='alternative'`).
4. **Eigene Web-App aus forkbarer Basis** — wenn die Community Wünsche hat, die
   keiner abdeckt: ein Repo, das JTC weiterentwickeln kann, mit Wettbewerbs- und
   **Lizenz-Einschätzung** (`oss_kandidat`, `typ='forkbar'`).

Funde werden **auto-publiziert** (kein händisches Review). Guardrails statt
Handarbeit: Auto-Publish nur bei `confidence ≥ RESEARCH_MIN_CONFIDENCE` **und**
erreichbarem Link (HTTP-Check). Dubioses landet als unveröffentlichter Entwurf.

## Affiliate-Bedingungen & Auto-Roadmap

Jedes Programm hat **Teilnahmebedingungen**, die klar sein müssen, bevor wir
werben: Mindest-Traffic/Besucherzahl, Genehmigung/Aufnahmekriterien, Provision,
Cookie-Dauer, Auszahlschwelle. Der Scout recherchiert sie und legt sie in
`affiliate_tool.affiliate_bedingungen` ab; ob wir sie voraussichtlich erfüllen,
steht in `affiliate_voraussetzungen_erfuellt`.

**Auto-Roadmap:** Fehlt uns eine Voraussetzung (klassisch: ein Programm verlangt
Mindest-Traffic, den wir erst messen/erreichen müssen), erzeugt der Scout
automatisch eine **interne Dev-Aufgabe** in `roadmap_item` (`quelle =
research_scout`, idempotent über den Titel). So landet „dafür brauchen wir noch
ein Feature" direkt in der Roadmap statt verloren zu gehen. Beispiel-Seed:
„Besucher-/Traffic-Zählung für Affiliate-Qualifikation".

> `roadmap_item` ist die **interne** Entwickler-Roadmap und getrennt von der
> Community-Pipeline (`feature_request`).

## Lizenz-Sorgfalt beim Forken (wichtig)

Ziel sind **eigene, verkaufbare Apps** (Closed-Source). Damit wir nicht in einen
Rechtsstreit geraten oder alles offenlegen müssen, bewertet der Scout jede
forkbare Basis nach Lizenzmodell und dokumentiert die Folgen:

| `lizenz_risiko` | Lizenzen | `fork_kommerziell_ok` | Bedeutung |
|---|---|---|---|
| `niedrig` | MIT, Apache-2.0, BSD | `true` | permissiv — bedenkenlos forkbar, kein Offenlegungszwang |
| `mittel` | MPL, LGPL | mit Sorgfalt | schwaches Copyleft — nur geänderte Dateien betroffen |
| `hoch` | GPL, **AGPL** | `false` | starkes Copyleft — **Offenlegungspflicht**, für verkaufte Closed-Source-App ungeeignet (nur als Referenz) |
| `unklar` | keine/uneindeutig | `false` | erst klären, bevor geforkt wird |

Die Begründung steht je Kandidat in `lizenz_hinweis` — alles sauber
dokumentiert. Beispiele aus dem Seed: **Spliit/SplitPro** (MIT → forkbar),
**OpenCPN** (GPLv2 → nur Referenz), **Immich/PhotoPrism** (AGPL → nur Referenz).

## Datenmodell (Migration `0002_research_scout.sql`)

| Objekt | Zweck |
|---|---|
| `affiliate_tool.*` (0002) | `affiliate_programm_status` (`hat_programm`\|`kein_programm`\|`ueber_partner`\|`unbekannt`), `affiliate_netzwerk`, `recherche_quellen_json`, `recherche_confidence`, `recherchiert_am` |
| `affiliate_tool.*` (0003) | `affiliate_bedingungen`, `affiliate_voraussetzungen_erfuellt` |
| `oss_kandidat` | gefundene OSS: `typ` = `alternative` \| `forkbar`, Repo, Lizenz, Sterne, `wettbewerbs_einschaetzung`, `lizenz_risiko`, `fork_kommerziell_ok`, `lizenz_hinweis` |
| `roadmap_item` (0003) | interne Dev-Aufgaben (auto aus Affiliate-Bedingungen + manuell) |
| `research_log` | Idempotenz/Retry (ein OK-Lauf pro Ziel+Schritt) |
| `community_feedback` | Crew-Review: `signal` = `melden` \| `hilfreich` |

## Idempotenz & „Wieder antriggern"

- **Still:** Bereits recherchierte Themen stehen mit `status='ok'` im
  `research_log` und werden übersprungen. Gibt es nichts Offenes, tut der Lauf
  nichts (≈ „heruntergefahren").
- **Aufwachen:** Ein neuer Wunsch (`feature_request`) bzw. ein neuer
  `affiliate_tool`-Entwurf (vom App-Scout) ist automatisch ein offenes Thema →
  der nächste Nacht-Lauf nimmt es.
- **Community reagiert:** Ab `RESEARCH_MELDE_SCHWELLE` `melden`-Signalen
  depubliziert das System den Fund (`veroeffentlicht=false`) und löscht den
  `research_log`-Eintrag → der nächste Lauf recherchiert das Thema neu.
  (`POST /api/feedback`, Logik in `reagiereAufFeedback`.)

## Stellschrauben (`.env`)

```env
ANTHROPIC_API_KEY=sk-ant-...   # nötig (web_search); fehlt er → Lauf wird still übersprungen
RESEARCH_MAX_ITEMS=12          # Themen pro Queue & Lauf (Kosten-Deckel)
RESEARCH_WEB_MAX_USES=4        # Web-Suchen pro Thema
RESEARCH_MIN_CONFIDENCE=0.5    # ab hier Auto-Publish
RESEARCH_MELDE_SCHWELLE=3      # Meldungen bis Depublizieren + Neu-Recherche
RESEARCH_REPORT_DIR=./reports  # Lauf-Reports
```

## Lokal testen

```bash
npm run db:migrate      # zieht 0002 automatisch
npm run db:seed         # Demo inkl. vorrecherchierter Funde
npm run research:run    # einmaliger Scan über offene Themen
```

## Nächtlich auf dem VPS

`scripts/research-cron.sh` startet den Scan in einem Einweg-Node-Container im
Compose-Netz der Instanz (gleiches Muster wie die Migration in
[deploy-test-vps.md](deploy-test-vps.md)) — kein Host-Node nötig.

```bash
# Prod-Instanz (Projekt jtc-org). Test-Instanz: JTC_COMPOSE_PROJECT/FILE/NETWORK/DB_URL setzen.
crontab -e
# 03:17 Uhr nachts:
17 3 * * *  /srv/jtc-org/repo/scripts/research-cron.sh >> /var/log/jtc-research.log 2>&1
```

Überschreibbare Env-Variablen des Cron-Scripts: `JTC_COMPOSE_PROJECT`,
`JTC_COMPOSE_FILE`, `JTC_NETWORK`, `JTC_DB_URL`.

## Verhältnis zum App-Scout

| | App-Scout (Pipeline-Schritt 2) | Research-Scout (nächtlich) |
|---|---|---|
| Auslöser | sofort bei Einreichung | Cron, scannt offene Themen |
| Quelle | nur Modellwissen | **Live-Web-Suche** |
| Ergebnis | Affiliate-Entwurf (Link leer) | füllt Programm/Link, **publiziert**, findet OSS |
| Review | redaktionell | **Community** (melden → Reaktion) |

Der App-Scout legt schnell den Entwurf an, der Research-Scout vervollständigt
ihn nachts mit echten Daten und ergänzt die Open-Source-Funde.
