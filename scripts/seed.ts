// Seed-Daten: 1 offene Runde + 4 Features (build/affiliate/verworfen/voting),
// 7 Tools über alle 4 Phasen, 5 Open-Source-Kandidaten, 2 Podcast-Folgen,
// 4 Partner. Board und Verzeichnis leben damit sofort.
//
// Die Affiliate- und OSS-Daten sind ECHT recherchiert (Stand Juni 2026) und im
// exakten Format abgelegt, das der nächtliche Research-Scout erzeugt — der Seed
// ist also ein realistischer „Scout hat schon gelaufen"-Zustand.
//
// Stufen pro Thema (Brief):
//   1. Premium-App (auch OHNE Affiliate)      → affiliate_tool, z.B. Navily
//   2. Beste Alternative ZWINGEND mit Affiliate→ affiliate_tool hat_programm
//   3. Kostenlose OSS-Alternative (mit Rating) → oss_kandidat typ='alternative'
//   4. Eigene Web-App aus forkbarer Basis      → BUILD-Feature + oss_kandidat typ='forkbar'
//
// Lizenz-Sorgfalt beim Forken (Ziel: verkaufbare Closed-Source-Apps):
//   permissiv (MIT/Apache) → fork_ok; Copyleft (GPL/AGPL) → fork NICHT ok,
//   Offenlegungspflicht, nur als Referenz (lizenz_hinweis dokumentiert es).
//
// Belege:
//   • Navily: premium, fast unersetzlich, KEIN öffentliches Affiliate-Programm.
//   • PredictWind hat ein echtes Affiliate-Programm (Tapfiliate, 25%) → hat_programm.
//   • Navionics: kein eigenes Programm, aber über Garmin (Mutterkonzern) → ueber_partner.
//   • Pantaenius/Splitwise/Google Fotos: kein öffentliches Programm.
//   • PackPoint: unklar → bewusst unveröffentlicht (Confidence-Guardrail-Demo).
//   • OSS: Spliit/split-pro (MIT, forkbar), OpenCPN (GPLv2, nur Referenz),
//     Immich/PhotoPrism (AGPL, nur Referenz).
//   • Affiliate-Bedingungen werden gespeichert; fehlende Voraussetzungen
//     (z.B. Mindest-Traffic) erzeugen Dev-Roadmap-Aufgaben (roadmap_item).
//
//   npm run db:seed
//
// Idempotent: leert die Inhalts-Tabellen und füllt sie neu. NICHT in
// Produktion mit echten Daten laufen lassen.

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(join(__dirname, "..", ".env"));

// Import nach loadEnv – der Pool wird ohnehin erst lazy bei connect() erzeugt.
const { getPool } = await import("../src/lib/db.ts");

async function main() {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // Inhalts-Tabellen leeren (CASCADE räumt Votes/Pledges/Clicks mit).
    await client.query(`
      TRUNCATE feature_request, affiliate_tool, oss_kandidat, community_feedback,
               roadmap_item, podcast_episode, partner, runde, vote, pledge,
               tool_click, mod_log, pipeline_log, research_log
      RESTART IDENTITY CASCADE;
    `);

    // ── Runde ───────────────────────────────────────────────────────
    const runde = await client.query<{ id: string }>(
      `INSERT INTO runde (monat, status, voting_endet_am)
       VALUES ('2026-06', 'voting', now() + interval '6 days')
       RETURNING id`,
    );
    const rundeId = runde.rows[0].id;

    // ── Feature 1: BUILD-Kandidat (eigene Web-App) ─────────────────
    const build = await client.query<{ id: string }>(
      `INSERT INTO feature_request
        (autor_id, autor_name, titel, journey_phase, problem, nutzen, status,
         size, dev_tage_min, dev_tage_max, eur_min, eur_max, sizing_begruendung,
         runde_id, roh_text)
       VALUES
        ('seed-skipper-1', 'Lena (Skipperin)',
         'Bordkassen-Splitter mit Foto-Belegen', 'auf_dem_toern',
         'Am letzten Abend wird die Bordkasse zum Zettel-Chaos. Wer hat was bezahlt?',
         'Jeder fotografiert seinen Beleg, die App rechnet automatisch ab. Kein Zettel-Chaos mehr am letzten Abend.',
         'build', 'M', 5, 8, 500, 700,
         'Foto-Upload, OCR-Betragserkennung und Abrechnungslogik sind überschaubar. Stripe-Anbindung besteht schon. Wir runden auf, weil die Belegerkennung Tests braucht.',
         $1, 'Ich hätte gern einen Bordkassen-Splitter, bei dem jeder seinen Beleg fotografiert.')
       RETURNING id`,
      [rundeId],
    );
    const buildId = build.rows[0].id;

    // Votes (47) und Pledges (Summe 240 €, 12 Unterstützer) für das Build-Feature.
    for (let i = 0; i < 47; i++) {
      await client.query(
        "INSERT INTO vote (feature_id, user_id) VALUES ($1, $2)",
        [buildId, `seed-voter-${i}`],
      );
    }
    const pledgeBetraege = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20]; // 12 × 20 € = 240 €
    for (let i = 0; i < pledgeBetraege.length; i++) {
      await client.query(
        `INSERT INTO pledge (feature_id, user_id, betrag_cent, status, stripe_payment_intent_id)
         VALUES ($1, $2, $3, 'bezahlt', $4)`,
        [buildId, `seed-pledger-${i}`, pledgeBetraege[i] * 100, `seed_pi_${i}`],
      );
    }

    // ── Feature 2: AFFILIATE ───────────────────────────────────────
    const affiliate = await client.query<{ id: string }>(
      `INSERT INTO feature_request
        (autor_id, autor_name, titel, journey_phase, problem, nutzen, status, runde_id, roh_text)
       VALUES
        ('seed-skipper-2', 'Jonas',
         'Offline-Seekarten fürs Handy', 'auf_dem_toern',
         'Unterwegs ist oft kein Netz, aber die Seekarte muss laufen.',
         'Der Bot hat eine etablierte App gefunden, die das gut löst — kein Eigenbau nötig.',
         'affiliate', $1, 'Gibt es eine App mit Offline-Seekarten fürs Handy?')
       RETURNING id`,
      [rundeId],
    );
    const affiliateId = affiliate.rows[0].id;

    // ── Feature 3: VERWORFEN ───────────────────────────────────────
    await client.query(
      `INSERT INTO feature_request
        (autor_id, autor_name, titel, journey_phase, problem, nutzen, status,
         sizing_begruendung, runde_id, roh_text)
       VALUES
        ('seed-skipper-3', 'Mira',
         'Farbmarkierungen für Crew-Identität', 'vor_buchung',
         'Wer gehört zu welcher Wache? Auf großen Törns geht das durcheinander.',
         'Farben pro Crew-Mitglied im Profil.',
         'verworfen',
         'Gute Idee. Würde aber das Onboarding zu komplex machen. Nächste Saison neu prüfen.',
         $1, 'Könnte man Crew-Mitglieder farblich markieren?')
       RETURNING id`,
      [rundeId],
    );

    // ── Feature 4: VOTING (mit OSS-Funden des Research-Scouts) ──────
    // Foto-Galerie: keine etablierte Affiliate-App empfohlen, aber starke
    // forkbare OSS-Basis (Immich/PhotoPrism) → Eigenbau denkbar.
    const fotos = await client.query<{ id: string }>(
      `INSERT INTO feature_request
        (autor_id, autor_name, titel, journey_phase, problem, nutzen, status,
         size, dev_tage_min, dev_tage_max, eur_min, eur_max, sizing_begruendung,
         runde_id, roh_text)
       VALUES
        ('seed-skipper-4', 'Tom',
         'Private Foto-Galerie für die Crew', 'danach',
         'Nach dem Törn liegen die Bilder in fünf Chat-Gruppen verstreut.',
         'Ein privates Crew-Album, in das jeder hochlädt — ohne Konto-Zwang großer Anbieter.',
         'voting', 'M', 4, 7, 500, 650,
         'Upload, Album-Freigabe und Galerie-Ansicht sind machbar. Eine forkbare OSS-Basis verkürzt den Weg deutlich.',
         $1, 'Können wir eine eigene private Foto-Galerie für die Crew bauen?')
       RETURNING id`,
      [rundeId],
    );
    const fotosId = fotos.rows[0].id;
    for (let i = 0; i < 31; i++) {
      await client.query(
        "INSERT INTO vote (feature_id, user_id) VALUES ($1, $2)",
        [fotosId, `seed-fotovoter-${i}`],
      );
    }
    for (let i = 0; i < 6; i++) {
      await client.query(
        `INSERT INTO pledge (feature_id, user_id, betrag_cent, status, stripe_payment_intent_id)
         VALUES ($1, $2, 1500, 'bezahlt', $3)`,
        [fotosId, `seed-fotopledger-${i}`, `seed_foto_pi_${i}`],
      );
    }

    // ── 6 Affiliate-Tools (Premium-Apps), echt recherchiert ────────
    // recherchiert_am = now() ⇒ der Research-Scout überspringt sie (idempotent).
    type ToolSeed = {
      feature_id: string | null;
      name: string;
      slug: string;
      kategorie: string;
      phase: string;
      kurz: string;
      url: string;
      rating: number;
      icon: string;
      pc: Record<string, unknown>;
      status: "hat_programm" | "kein_programm" | "ueber_partner" | "unbekannt";
      netzwerk: string | null;
      bedingungen?: string | null;
      erfuellt?: boolean | null;
      conf: number;
      quellen: string[];
      publish: boolean;
    };

    const tools: ToolSeed[] = [
      {
        // Dein Vorzeige-Beispiel: premium & fast unersetzlich, aber (noch) kein
        // öffentliches Affiliate-Programm → wird trotzdem empfohlen.
        feature_id: null,
        name: "Navily",
        slug: "navily",
        kategorie: "Ankerplätze & Buchung",
        phase: "auf_dem_toern",
        kurz: "Cruising-Guide mit 35.000+ Ankerplätzen/Marinas und Marina-Buchung.",
        url: "https://www.navily.com/",
        rating: 4.7,
        icon: "anchor",
        pc: {
          wofuer: "Du findest Ankerplätze und Marinas mit echten Crew-Bewertungen, Fotos und buchst Liegeplätze direkt.",
          kosten: "Basis gratis, Premium im Abo.",
          crew: "Für Fahrtensegler und alle, die Buchten und Häfen vergleichen.",
          pro: ["1,1 Mio+ Nutzer", "Sehr viele Ankerplätze", "Marina-Buchung integriert"],
          contra: ["Kein öffentliches Affiliate-Programm", "Premium für volle Features"],
        },
        status: "kein_programm",
        netzwerk: null,
        conf: 0.6,
        quellen: ["https://www.navily.com/", "https://blog.navily.com/"],
        publish: true,
      },
      {
        feature_id: affiliateId,
        name: "Navionics Boating",
        slug: "navionics-boating",
        kategorie: "Navigation",
        phase: "auf_dem_toern",
        kurz: "Offline-Seekarten mit Tiefenlinien und Hafeninfos — Standard an Bord.",
        url: "https://www.navionics.com/",
        rating: 4.5,
        icon: "map-2",
        pc: {
          wofuer: "Du navigierst offline mit aktuellen Seekarten, Tiefenlinien und Hafeninfos direkt auf dem Handy.",
          kosten: "Basis-App gratis, Karten-Abo je Region ab etwa 20 € im Jahr.",
          crew: "Für jede Crew, die auch ohne Netz sicher ankommen will.",
          pro: ["Sehr verbreitet", "Detaillierte Karten", "Gute Hafendaten"],
          contra: ["Kein eigenes Affiliate-Programm", "Seit Garmin-Übernahme weniger eigenständig"],
        },
        // Kein eigenes Programm, aber über Garmin (Mutterkonzern) monetarisierbar.
        status: "ueber_partner",
        netzwerk: "Garmin Affiliate Program (Mutterkonzern)",
        bedingungen: "Navionics hat kein eigenes Programm; Monetarisierung über Garmins Partnernetzwerk (z.B. AvantLink/Impact). Aufnahme erfordert Bewerbung/Genehmigung; Provisions-, Cookie- und ggf. Mindest-Traffic-Bedingungen vor Beitritt prüfen.",
        erfuellt: false,
        conf: 0.7,
        quellen: ["https://www.navionics.com/", "https://www.garmin.com/en-US/affiliate-program/"],
        publish: true,
      },
      {
        feature_id: null,
        name: "Pantaenius Yacht-Versicherung",
        slug: "pantaenius-yacht-versicherung",
        kategorie: "Versicherung",
        phase: "planung",
        kurz: "Europas führender Yacht-Versicherer — Haftung, Kasko, Kaution.",
        url: "https://www.pantaenius.com/",
        rating: 4.3,
        icon: "shield",
        pc: {
          wofuer: "Du sicherst Haftungs- und Kaskoschäden über einen etablierten Spezialisten ab.",
          kosten: "Individuell nach Boot und Revier; Angebot anfragen.",
          crew: "Für Eigner und Charter-Crews mit höherem Absicherungsbedarf.",
          pro: ["50+ Jahre Erfahrung", "24/7-Service", "Europaweit stark"],
          contra: ["Kein Online-Sofortabschluss", "Eher Premium-Segment"],
        },
        status: "kein_programm",
        netzwerk: null,
        conf: 0.6,
        quellen: ["https://www.pantaenius.com/", "https://superyacht.pantaenius.com/"],
        publish: true,
      },
      {
        feature_id: null,
        name: "PredictWind",
        slug: "predictwind",
        kategorie: "Wetter",
        phase: "planung",
        kurz: "Führende Windvorhersage mit mehreren Modellen und Routing.",
        url: "https://www.predictwind.com/affiliate",
        rating: 4.8,
        icon: "cloud",
        pc: {
          wofuer: "Du planst Etappen mit verlässlichen Wind-/Böenprognosen aus mehreren Modellen und Weather-Routing.",
          kosten: "Kostenlos nutzbar, Standard/Professional als Abo.",
          crew: "Für Planer und alle, die Schläge clever timen wollen.",
          pro: ["Mehrere Wettermodelle", "Weather-Routing", "Offshore-tauglich"],
          contra: ["Detailmodelle nur im Abo", "Für Tagestörns oft überdimensioniert"],
        },
        status: "hat_programm",
        netzwerk: "Tapfiliate",
        bedingungen: "25% Provision auf den ersten Kauf (Abo startet ab Free), Abwicklung über Tapfiliate, Auszahlung per PayPal. Keine Mindest-Traffic-Hürde bekannt — direkt teilnehmbar.",
        erfuellt: true,
        conf: 0.92,
        quellen: [
          "https://www.predictwind.com/affiliate",
          "https://predictwind.tapfiliate.com/",
        ],
        publish: true,
      },
      {
        feature_id: null,
        name: "PackPoint Packlisten",
        slug: "packpoint-packlisten",
        kategorie: "Vorbereitung",
        phase: "vor_buchung",
        kurz: "Packlisten nach Reiseziel, Dauer und Aktivität.",
        url: "https://www.packpnt.com/",
        rating: 4.0,
        icon: "checklist",
        pc: {
          wofuer: "Du bekommst eine Packliste, abgestimmt auf Ziel, Dauer und geplante Aktivitäten.",
          kosten: "Gratis, Premium günstig.",
          crew: "Für Erst-Charterer und alle, die nichts vergessen wollen.",
          pro: ["Schnell startklar", "Aktivitätsbasiert", "Teilbar"],
          contra: ["Nicht segel-spezifisch", "Affiliate-Lage unklar"],
        },
        // Unklar, ob Programm/Link verlässlich → bewusst nicht veröffentlicht.
        status: "unbekannt",
        netzwerk: null,
        conf: 0.4,
        quellen: ["https://www.packpnt.com/"],
        publish: false,
      },
      {
        feature_id: null,
        name: "Splitwise",
        slug: "splitwise",
        kategorie: "Bordkasse",
        phase: "auf_dem_toern",
        kurz: "Der Klassiker fürs faire Aufteilen gemeinsamer Ausgaben.",
        url: "https://www.splitwise.com/",
        rating: 4.6,
        icon: "wallet",
        pc: {
          wofuer: "Du teilst Ausgaben der Crew fair auf und siehst am Ende, wer wem was schuldet.",
          kosten: "Gratis, Pro mit Belegscan und ohne Werbung im Abo.",
          crew: "Für jede Crew mit gemeinsamer Bordkasse.",
          pro: ["Sehr ausgereift", "Mehrere Währungen", "Große Verbreitung"],
          contra: ["Belegscan nur in Pro", "Werbung in der Gratis-Version"],
        },
        status: "kein_programm",
        netzwerk: null,
        conf: 0.7,
        quellen: ["https://www.splitwise.com/", "https://en.wikipedia.org/wiki/Splitwise"],
        publish: true,
      },
      {
        feature_id: null,
        name: "Google Fotos",
        slug: "google-fotos",
        kategorie: "Erinnerung",
        phase: "danach",
        kurz: "Fotos sichern und in geteilten Alben mit der Crew teilen.",
        url: "https://photos.google.com/",
        rating: 4.6,
        icon: "photo",
        pc: {
          wofuer: "Ihr sammelt alle Bilder des Törns in einem geteilten Album statt in Chat-Gruppen.",
          kosten: "15 GB gratis, mehr Speicher über Google One.",
          crew: "Für Crews, die Erinnerungen unkompliziert teilen wollen.",
          pro: ["Sehr einfach", "Starke Suche", "Geteilte Alben"],
          contra: ["Daten bei Google", "Speicherlimit gratis"],
        },
        status: "kein_programm",
        netzwerk: null,
        conf: 0.6,
        quellen: ["https://photos.google.com/"],
        publish: true,
      },
    ];

    const toolId: Record<string, string> = {};
    for (const t of tools) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO affiliate_tool
          (feature_id, name, slug, kategorie, journey_phase, kurzbeschreibung,
           beschreibung_md, affiliate_url, rating, icon_key, pro_contra_json,
           affiliate_programm_status, affiliate_netzwerk, affiliate_bedingungen,
           affiliate_voraussetzungen_erfuellt, recherche_quellen_json,
           recherche_confidence, recherchiert_am, veroeffentlicht)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),$18)
         RETURNING id`,
        [
          t.feature_id, t.name, t.slug, t.kategorie, t.phase, t.kurz,
          t.kurz, t.url, t.rating, t.icon, JSON.stringify(t.pc),
          t.status, t.netzwerk, t.bedingungen ?? null, t.erfuellt ?? null,
          JSON.stringify(t.quellen), t.conf, t.publish,
        ],
      );
      toolId[t.slug] = res.rows[0].id;
    }

    // ── 5 Open-Source-Kandidaten (Funde des Research-Scouts) ───────
    // typ='alternative' → fertige, gut bewertete OSS (Stars = Rating-Signal).
    // typ='forkbar'     → Basis für eine eigene, konkurrenzfähige Web-App.
    type OssSeed = {
      feature_id: string | null;
      tool_slug: string | null;
      typ: "alternative" | "forkbar";
      name: string;
      repo_url: string;
      lizenz: string | null;
      sterne: number | null;
      phase: string;
      beschreibung: string;
      wettbewerb: string | null;
      lizenz_risiko: "niedrig" | "mittel" | "hoch" | "unklar";
      fork_ok: boolean;
      lizenz_hinweis: string;
      quellen: string[];
      conf: number;
      publish: boolean;
    };

    const oss: OssSeed[] = [
      // Bordkasse — eigene Web-App: forkbare Basis + freie Alternative.
      {
        feature_id: buildId,
        tool_slug: "splitwise",
        typ: "forkbar",
        name: "Spliit",
        repo_url: "https://github.com/spliit-app/spliit",
        lizenz: "MIT",
        sterne: 2020,
        phase: "auf_dem_toern",
        beschreibung: "Open-Source-Alternative zu Splitwise: Ausgaben teilen, Kategorien, wiederkehrende Posten, Beleg-Anhänge.",
        wettbewerb: "Gleicher Stack wie JTC (Next.js + PostgreSQL), Foto-Belege und Kategorien sind schon drin — wir bauen darauf auf statt bei null zu starten.",
        lizenz_risiko: "niedrig",
        fork_ok: true,
        lizenz_hinweis: "MIT erlaubt kommerzielle, geschlossene Weiterentwicklung ohne Offenlegungspflicht. Ideale Fork-Basis für eine verkaufbare App.",
        quellen: ["https://github.com/spliit-app/spliit", "https://spliit.app/"],
        conf: 0.9,
        publish: true,
      },
      {
        feature_id: buildId,
        tool_slug: "splitwise",
        typ: "alternative",
        name: "SplitPro",
        repo_url: "https://github.com/oss-apps/split-pro",
        lizenz: "MIT",
        sterne: null,
        phase: "auf_dem_toern",
        beschreibung: "Selbst-hostbare Splitwise-Alternative mit Splits, Salden, Belegen und PWA — gut gepflegt.",
        wettbewerb: null,
        lizenz_risiko: "niedrig",
        fork_ok: true,
        lizenz_hinweis: "MIT — kommerzielle Nutzung und Closed-Source-Fork erlaubt.",
        quellen: ["https://github.com/oss-apps/split-pro"],
        conf: 0.8,
        publish: true,
      },
      // Offline-Seekarten — forkbare Marine-Nav-Basis.
      {
        feature_id: affiliateId,
        tool_slug: "navionics-boating",
        typ: "forkbar",
        name: "OpenCPN",
        repo_url: "https://github.com/OpenCPN/OpenCPN",
        lizenz: "GPLv2",
        sterne: null,
        phase: "auf_dem_toern",
        beschreibung: "Etablierter Open-Source-Chartplotter mit S57-Vektorkarten, AIS und Routing.",
        wettbewerb: "Ausgereifte Marine-Navigation, aber Desktop/C++. Eine mobile Web-App wäre ein großer Umbau — eher Referenz als direkte Fork-Basis.",
        lizenz_risiko: "hoch",
        fork_ok: false,
        lizenz_hinweis: "GPLv2 (starkes Copyleft): abgeleitete Werke müssen unter GPL offengelegt werden — für eine verkaufte Closed-Source-App ungeeignet. Nur als Referenz/Lernquelle nutzen.",
        quellen: ["https://github.com/OpenCPN/OpenCPN", "https://www.opencpn.org/"],
        conf: 0.65,
        publish: true,
      },
      // Foto-Galerie — forkbare Basis + freie Alternative.
      {
        feature_id: fotosId,
        tool_slug: "google-fotos",
        typ: "forkbar",
        name: "Immich",
        repo_url: "https://github.com/immich-app/immich",
        lizenz: "AGPL-3.0",
        sterne: 92000,
        phase: "danach",
        beschreibung: "Selbst-gehostete Foto-/Video-Verwaltung mit App, Backup, Gesichtserkennung und geteilten Alben.",
        wettbewerb: "Feature-komplett und extrem aktiv (~92k Stars) — als Referenz für den Funktionsumfang top.",
        lizenz_risiko: "hoch",
        fork_ok: false,
        lizenz_hinweis: "AGPL-3.0: schon das Anbieten als Netzwerkdienst zwingt zur Offenlegung des gesamten Quellcodes — für ein verkauftes Closed-Source-Produkt ungeeignet. Für Eigenbau eher permissiv lizenzierte Basis suchen.",
        quellen: ["https://github.com/immich-app/immich", "https://immich.app/"],
        conf: 0.85,
        publish: true,
      },
      {
        feature_id: fotosId,
        tool_slug: "google-fotos",
        typ: "alternative",
        name: "PhotoPrism",
        repo_url: "https://github.com/photoprism/photoprism",
        lizenz: "AGPL-3.0",
        sterne: null,
        phase: "danach",
        beschreibung: "KI-gestützte, selbst-hostbare Foto-App (Go) mit automatischer Verschlagwortung und Galerie.",
        wettbewerb: null,
        lizenz_risiko: "hoch",
        fork_ok: false,
        lizenz_hinweis: "AGPL-3.0 (Community Edition) — Offenlegungspflicht beim Hosten. Kommerzielle Lizenz auf Anfrage möglich; sonst für verkaufte Closed-Source-App ungeeignet.",
        quellen: ["https://github.com/photoprism/photoprism", "https://www.photoprism.app/"],
        conf: 0.75,
        publish: true,
      },
    ];

    for (const o of oss) {
      await client.query(
        `INSERT INTO oss_kandidat
          (feature_id, tool_id, typ, name, repo_url, lizenz, sterne, journey_phase,
           beschreibung, wettbewerbs_einschaetzung, lizenz_risiko, fork_kommerziell_ok,
           lizenz_hinweis, quellen_json, confidence, veroeffentlicht)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          o.feature_id,
          o.tool_slug ? toolId[o.tool_slug] ?? null : null,
          o.typ, o.name, o.repo_url, o.lizenz, o.sterne, o.phase,
          o.beschreibung, o.wettbewerb, o.lizenz_risiko, o.fork_ok,
          o.lizenz_hinweis, JSON.stringify(o.quellen), o.conf, o.publish,
        ],
      );
    }

    // research_log: Themen als „erledigt" markieren, damit der Scout sie nicht
    // erneut recherchiert (sonst doppelte Arbeit beim ersten Nacht-Lauf).
    for (const slug of Object.keys(toolId)) {
      await client.query(
        `INSERT INTO research_log (ziel_typ, ziel_id, schritt, status, ausgabe)
         VALUES ('affiliate_tool', $1, 'affiliate_programm', 'ok', $2)`,
        [toolId[slug], JSON.stringify({ quelle: "seed" })],
      );
    }
    for (const fid of [buildId, affiliateId, fotosId]) {
      await client.query(
        `INSERT INTO research_log (ziel_typ, ziel_id, schritt, status, ausgabe)
         VALUES ('feature', $1, 'oss', 'ok', $2)`,
        [fid, JSON.stringify({ quelle: "seed" })],
      );
    }

    // ── Dev-Roadmap: Aufgaben aus Affiliate-Bedingungen ────────────
    // Genau das „dann brauchen wir ein Feature, um da hinzukommen": viele
    // Programme verlangen Mindest-Traffic → wir müssen Besucher zählen/ausweisen.
    await client.query(
      `INSERT INTO roadmap_item (titel, beschreibung, quelle, kategorie, prioritaet)
       VALUES
        ('Besucher-/Traffic-Zählung für Affiliate-Qualifikation',
         'Viele Affiliate-Programme verlangen Mindest-Traffic. Plausible ist eingebunden — wir brauchen ein internes Dashboard, das monatliche Besucher/Visits ausweist, um Aufnahme-Schwellen zu belegen und zu erreichen.',
         'research_scout', 'tracking', 'hoch')
       ON CONFLICT (titel) DO NOTHING`,
    );
    await client.query(
      `INSERT INTO roadmap_item (titel, beschreibung, quelle, kategorie, prioritaet, bezug_tool_id)
       VALUES
        ('Affiliate-Voraussetzung: Navionics Boating',
         'Navionics hat kein eigenes Programm — über Garmins Partnernetzwerk (AvantLink/Impact) bewerben. Aufnahmekriterien, Provision und Cookie-Dauer prüfen und dokumentieren.',
         'research_scout', 'affiliate_voraussetzung', 'mittel', $1)
       ON CONFLICT (titel) DO NOTHING`,
      [toolId["navionics-boating"]],
    );

    // ── 2 Podcast-Folgen ───────────────────────────────────────────
    await client.query(
      `INSERT INTO podcast_episode
        (titel, folge_nr, beschreibung, audio_url, dauer_sek, veroeffentlicht_am, slug)
       VALUES
        ('Wie aus einem Törn ein Business wurde', 7,
         'Vom Charter-Urlaub zur eigenen Plattform — die Crew hinter Join the Captain erzählt.',
         'https://example.com/podcast/folge-7.mp3', 2640, now() - interval '10 days', 'folge-7-toern-zum-business'),
        ('Bordkasse, Crew und Konflikte', 6,
         'Geld an Bord muss kein Streit sein. Wir reden über faire Aufteilung und klare Absprachen.',
         'https://example.com/podcast/folge-6.mp3', 2280, now() - interval '40 days', 'folge-6-bordkasse-und-crew')`,
    );

    // ── 4 Partner ──────────────────────────────────────────────────
    await client.query(
      `INSERT INTO partner (name, rolle, kurzbeschreibung, url, logo_key, sortierung)
       VALUES
        ('Adria Yachtcharter', 'Charter-Partner',
         'Boote in Kroatien und Italien, ehrlich beraten.', 'https://example.com/charter', null, 1),
        ('Nordwind Skipper-Schule', 'Ausbildung',
         'Vom Sportbootführerschein bis zum Hochsee-Schein.', 'https://example.com/schule', null, 2),
        ('Klar zur Wende Versicherung', 'Reise & Boot',
         'Versicherungen für Crew, Kaution und Reise.', 'https://example.com/versicherung-partner', null, 3),
        ('Achterlicht Foto & Film', 'Foto & Film',
         'Törn-Reportagen und Drohnen-Aufnahmen für deine Crew.', 'https://example.com/foto', null, 4)`,
    );

    await client.query("COMMIT");
    console.log(
      "Seed erfolgreich: 1 Runde, 4 Features, 7 Tools (6 publiziert), " +
        "5 OSS-Kandidaten, 2 Roadmap-Aufgaben, 2 Folgen, 4 Partner.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed fehlgeschlagen:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await getPool().end();
  }
}

main();
