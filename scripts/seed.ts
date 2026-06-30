// Seed-Daten: 1 offene Runde + 3 Features (build/affiliate/verworfen),
// 6 Tools über alle 4 Phasen, 2 Podcast-Folgen, 4 Partner.
// Board und Verzeichnis leben damit sofort.
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
      TRUNCATE feature_request, affiliate_tool, podcast_episode, partner,
               runde, vote, pledge, tool_click, mod_log, pipeline_log
      RESTART IDENTITY CASCADE;
    `);

    // ── Runde ───────────────────────────────────────────────────────
    const runde = await client.query<{ id: string }>(
      `INSERT INTO runde (monat, status, voting_endet_am)
       VALUES ('2026-06', 'voting', now() + interval '6 days')
       RETURNING id`,
    );
    const rundeId = runde.rows[0].id;

    // ── Feature 1: BUILD-Kandidat ──────────────────────────────────
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

    // ── 6 Affiliate-Tools über alle Phasen ─────────────────────────
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
    };

    const tools: ToolSeed[] = [
      {
        feature_id: affiliateId,
        name: "Navi & Seekarten",
        slug: "navi-seekarten",
        kategorie: "Navigation",
        phase: "auf_dem_toern",
        kurz: "Offline-Seekarten fürs Mittelmeer und die Ostsee — auch ohne Netz.",
        url: "https://example.com/navi?ref=jtc",
        rating: 4.7,
        icon: "map-2",
        pc: {
          wofuer: "Du navigierst offline mit aktuellen Seekarten, Tiefenlinien und Hafeninfos direkt auf dem Handy.",
          kosten: "Basis kostenlos, Karten-Pakete je Revier ab etwa 20 € im Jahr.",
          crew: "Für jede Crew, die auch ohne Netz sicher ankommen will.",
          pro: ["Karten funktionieren offline", "Regelmäßige Updates", "Gute Hafendaten"],
          contra: ["Karten-Pakete kosten extra", "Akkuhunger bei Dauerbetrieb"],
        },
      },
      {
        feature_id: null,
        name: "Skipper-Versicherung",
        slug: "skipper-versicherung",
        kategorie: "Versicherung",
        // Versicherung gehört VOR den Törn — danach ist es zu spät.
        phase: "planung",
        kurz: "Schutz für Skipper und Crew — Haftung, Kaution, Unfall.",
        url: "https://example.com/versicherung?ref=jtc",
        rating: 4.4,
        icon: "shield",
        pc: {
          wofuer: "Du sicherst Kautionsschäden und Haftungsfälle ab, ohne im Schadenfall lange zu streiten.",
          kosten: "Jahrespolice ab etwa 90 €, Tagespolicen für einzelne Törns möglich.",
          crew: "Für Charter-Crews und alle, die fremde Boote fahren.",
          pro: ["Deckt die Charter-Kaution", "Schnelle Abwicklung", "Tagesschutz wählbar"],
          contra: ["Selbstbeteiligung je nach Tarif", "Nicht jedes Revier abgedeckt"],
        },
      },
      {
        feature_id: null,
        name: "Wetter & Wind",
        slug: "wetter-und-wind",
        kategorie: "Wetter",
        phase: "planung",
        kurz: "Windvorhersage und Böen-Modelle für deine Törnplanung.",
        url: "https://example.com/wetter?ref=jtc",
        rating: 4.8,
        icon: "cloud",
        pc: {
          wofuer: "Du planst Etappen anhand verlässlicher Wind- und Böenprognosen und siehst mehrere Modelle im Vergleich.",
          kosten: "Kostenlos nutzbar, Premium mit mehr Modellen ab etwa 20 € im Jahr.",
          crew: "Für Planer und alle, die Schläge clever timen wollen.",
          pro: ["Mehrere Wettermodelle", "Übersichtliche Karten", "Gute App"],
          contra: ["Premium für Detailmodelle", "Prognosen bleiben Prognosen"],
        },
      },
      {
        feature_id: null,
        name: "Packlisten-Generator",
        slug: "packlisten-generator",
        kategorie: "Vorbereitung",
        phase: "vor_buchung",
        kurz: "Törn-Packlisten nach Revier, Dauer und Crew-Größe.",
        url: "https://example.com/packliste?ref=jtc",
        rating: 4.2,
        icon: "checklist",
        pc: {
          wofuer: "Du bekommst eine fertige Packliste, abgestimmt auf Revier, Jahreszeit und Crew-Größe.",
          kosten: "Kostenlos.",
          crew: "Für Erst-Charterer und alle, die nichts vergessen wollen.",
          pro: ["Schnell startklar", "Nach Revier sortiert", "Teilbar mit der Crew"],
          contra: ["Wenig individuell", "Keine App, nur Web"],
        },
      },
      {
        feature_id: null,
        name: "Bordkassen-Splitter",
        slug: "bordkassen-splitter",
        kategorie: "Bordkasse",
        phase: "auf_dem_toern",
        kurz: "Gemeinsame Ausgaben fair aufteilen — fürs erste Revier.",
        url: "https://example.com/bordkasse?ref=jtc",
        rating: 4.1,
        icon: "wallet",
        pc: {
          wofuer: "Du teilst Ausgaben der Crew fair auf und siehst am Ende, wer wem was schuldet.",
          kosten: "Kostenlos, Pro-Version mit Foto-Belegen ab etwa 3 € im Monat.",
          crew: "Für jede Crew mit gemeinsamer Bordkasse.",
          pro: ["Faire Aufteilung", "Mehrere Währungen", "Export möglich"],
          contra: ["Foto-Belege nur in Pro", "Werbung in der Gratis-Version"],
        },
      },
      {
        feature_id: null,
        name: "Foto-Sharing für die Crew",
        slug: "foto-sharing-crew",
        kategorie: "Erinnerung",
        phase: "danach",
        kurz: "Alle Törn-Fotos an einem Ort — privat geteilt mit der Crew.",
        url: "https://example.com/fotos?ref=jtc",
        rating: 4.5,
        icon: "photo",
        pc: {
          wofuer: "Ihr sammelt alle Bilder des Törns in einem privaten Album, ohne Chat-Gruppen-Chaos.",
          kosten: "Kostenlos bis zu einem Speicherlimit, mehr Platz ab etwa 2 € im Monat.",
          crew: "Für Crews, die Erinnerungen teilen statt suchen wollen.",
          pro: ["Privates Album", "Volle Auflösung", "Einfacher Beitritt"],
          contra: ["Speicherlimit gratis", "Konto nötig"],
        },
      },
    ];

    for (const t of tools) {
      await client.query(
        `INSERT INTO affiliate_tool
          (feature_id, name, slug, kategorie, journey_phase, kurzbeschreibung,
           beschreibung_md, affiliate_url, rating, icon_key, pro_contra_json, veroeffentlicht)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)`,
        [
          t.feature_id, t.name, t.slug, t.kategorie, t.phase, t.kurz,
          t.kurz, t.url, t.rating, t.icon, JSON.stringify(t.pc),
        ],
      );
    }

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
    console.log("Seed erfolgreich: 1 Runde, 3 Features, 6 Tools, 2 Folgen, 4 Partner.");
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
