# Self-Organization — Affiliate-Anmeldungen (offene Schritte)

> Interne To-do-Liste für Affiliate-Programm-Anmeldungen. Der Research-Scout
> findet Programme und legt sie in der DB-Tabelle `affiliate_programm` ab
> (Status `gefunden` → `beworben` → `aktiv`). Ein Affiliate-Link geht erst auf
> die Website, wenn der Status `aktiv` ist und der echte `affiliate_url` (die
> ref-URL) hinterlegt wurde. Diese Datei hält die manuellen Schritte fest.

## PredictWind (Wetter) — Status: `beworben`

Programm über **Tapfiliate**, 25 % Provision auf den ersten Kauf, Auszahlung via PayPal.

- [x] **Step 1** — Tapfiliate-Account erstellt. (PayPal bei Setup angeben — ohne PayPal keine Auszahlung!)
- [ ] **Step 2 — Validierung abwarten.** PredictWind muss den Account bestätigen. Danach kommt eine ref-URL der Form:
      `https://www.predictwind.com/?ref=XXXYYYXXXYYY`
      `XXXYYYXXXYYY` = Kombination aus Vor- und Nachname des Accounts → **erscheint im Affiliate-Link, also bewusst wählen.**
- [ ] **Step 3 — ref-URL einsetzen/einbetten.** Über Medien nutzen; in Tapfiliate stehen Assets/Grafiken bereit (E-Mail, Website-Link, YouTube etc.). Ziel: PredictWind-Startseite **oder** Pricing-Seite. Cookie erkennt den Affiliate-Kauf.
  - Danach: ref-URL als `affiliate_programm.affiliate_url` eintragen + Status auf `aktiv` setzen → Link wird auf der Website sichtbar (mit Kennzeichnung + `rel="sponsored nofollow"`).

## Navionics (Seekarten) — Status: `gefunden`

Kein eigenes Programm → über den **Mutterkonzern Garmin** (Garmin Affiliate Program, i.d.R. via AvantLink/Impact).

- [ ] Beim Garmin-Partnerprogramm bewerben: https://www.garmin.com/en-US/affiliate-program/
- [ ] Aufnahmekriterien, Provision und Cookie-Dauer prüfen und hier + in `affiliate_programm.bedingungen` dokumentieren.
- [ ] Nach Freigabe: ref-/Affiliate-Link eintragen, Status auf `aktiv`.

## Verknüpfte Videos (Discovery)

- PredictWind-Erklärvideo („How to use Weather Routing") ist bereits über den Discovery-Prozess eingebettet und freigegeben → sobald PredictWind `aktiv` ist, kann der Affiliate-Link dort/darunter platziert werden.

---

_Pflege: Diese Datei bei jeder Statusänderung aktualisieren. Der nächtliche
Scout ergänzt neue Programme in `affiliate_programm`; neue Anmelde-Aufgaben
hier eintragen._
