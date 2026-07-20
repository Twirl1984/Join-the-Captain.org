// Seed-Daten für revier_poi (REQ-EXP-001) — Pilot-Reviere Rügen + Dalmatien.
//
// ECHT recherchiert (Web-Suche 2026-07-15, Quellen s. quellen_json je Eintrag).
// Bewusste Auswahl: nur permanente, von See aus erreichbare Landmarken mit
// Wikipedia-/Wikidata-Beleg (Overpass-/Wikipedia-Ingest-Kanäle laut
// docs/erlebnis-system.md) — KEINE Foren-/Community-Bewertungen, KEINE
// erfundenen Event-Termine. status='live' direkt gesetzt: manuell recherchiert
// und mit erreichbarem Quell-Link verifiziert (Guardrail aus
// .claude/skills/erlebnis-wissen/SKILL.md — Auto-Publish-Schwelle erfüllt).
//
// Bewusst NICHT befüllt: typ='bucht' (Windschutz-Sektoren) und typ='versorgung'
// (Liegeplatz-Details) brauchen Segelrevier-Fachquellen (Navily & Co., "Lizenz
// vor Eigenbau" — docs/erlebnis-system.md §Rechts-Leitplanken). Das ist ein
// offener Punkt für die nächste Kurations-Runde, kein Zufallslückenfüller.
//
//   npm run db:seed:erlebnis
//
// Idempotent: leert revier_poi/poi_vote und füllt sie neu.

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv(join(__dirname, "..", ".env"));

const { getPool } = await import("../src/lib/db.ts");

const ABGERUFEN_AM = "2026-07-15";
const STAND_DATUM = "2026-07-15";

interface SeedPoi {
  revier_id: string;
  typ: string;
  name: string;
  lat: number;
  lon: number;
  beschreibung: string;
  saison_von?: number;
  saison_bis?: number;
  confidence: number;
  quelle_url: string;
  quelle_titel: string;
}

const POIS: SeedPoi[] = [
  // ── Rügen ──────────────────────────────────────────────────────────
  {
    revier_id: "ruegen",
    typ: "sehenswuerdigkeit",
    name: "Kap Arkona (Leuchttürme)",
    lat: 54.679611,
    lon: 13.432611,
    beschreibung:
      "Nordspitze Rügens (Wittow) mit zwei Leuchttürmen (Schinkel-Turm 1826/1827, großer Turm 1901–1905, 35 m, Feuerhöhe 75 m ü. NN). Beide besichtigbar.",
    confidence: 0.95,
    quelle_url: "https://de.wikipedia.org/wiki/Leuchtturm_Kap_Arkona",
    quelle_titel: "Leuchtturm Kap Arkona – Wikipedia",
  },
  {
    revier_id: "ruegen",
    typ: "sehenswuerdigkeit",
    name: "Königsstuhl (Kreidefelsen, Nationalpark Jasmund)",
    lat: 54.573056,
    lon: 13.6625,
    beschreibung:
      "Bekannteste Kreidefelsformation der Stubbenkammer im Nationalpark Jasmund, 118 m über der Ostsee. Nationalpark-Zentrum mit Skywalk am Fuß.",
    confidence: 0.95,
    quelle_url: "https://de.wikipedia.org/wiki/K%C3%B6nigsstuhl_(R%C3%BCgen)",
    quelle_titel: "Königsstuhl (Rügen) – Wikipedia",
  },
  {
    revier_id: "ruegen",
    typ: "hafen-highlight",
    name: "Fischerdorf Vitt",
    lat: 54.665833,
    lon: 13.431667,
    beschreibung:
      "Denkmalgeschütztes Reetdach-Fischerdorf in einer Steilküsten-Schlucht (Liete) direkt bei Kap Arkona, urkundlich seit 1290. Von See aus wegen der Lage kaum sichtbar, zu Fuß vom Kap erreichbar.",
    confidence: 0.9,
    quelle_url: "https://de.wikipedia.org/wiki/Vitt",
    quelle_titel: "Vitt – Wikipedia",
  },
  {
    revier_id: "ruegen",
    typ: "sehenswuerdigkeit",
    name: "Störtebeker-Freilichtbühne Ralswiek",
    lat: 54.476389,
    lon: 13.445833,
    beschreibung:
      "Naturbühne am Ufer des Großen Jasmunder Boddens, seit 1993 Spielstätte der Störtebeker-Festspiele (Ende Juni bis Anfang September). Genaue Termine je Saison auf der offiziellen Seite prüfen.",
    saison_von: 6,
    saison_bis: 9,
    confidence: 0.9,
    quelle_url: "https://de.wikipedia.org/wiki/St%C3%B6rtebeker-Festspiele",
    quelle_titel: "Störtebeker-Festspiele – Wikipedia",
  },
  {
    revier_id: "ruegen",
    typ: "versorgung",
    name: "Sassnitz (Hafenstadt)",
    lat: 54.5157,
    lon: 13.64451,
    beschreibung:
      "Nördlichste Hafenstadt Rügens auf dem Jasmund-Plateau, historischer Stadthafen mit Hafen- und Fischereimuseum; Versorgung, Bahnanschluss (Bahnhof Sassnitz).",
    confidence: 0.85,
    quelle_url: "https://de.wikipedia.org/wiki/Sassnitz",
    quelle_titel: "Sassnitz – Wikipedia",
  },
  {
    revier_id: "ruegen",
    typ: "sehenswuerdigkeit",
    name: "Rugard mit Ernst-Moritz-Arndt-Turm",
    lat: 54.42175,
    lon: 13.44485,
    beschreibung:
      "Mit 91 m höchste Erhebung Mittelrügens am Rand von Bergen auf Rügen; Aussichtsturm von 1877 mit Panoramablick über die Insel.",
    confidence: 0.9,
    quelle_url: "https://de.wikipedia.org/wiki/Rugard",
    quelle_titel: "Rugard – Wikipedia",
  },

  // ── Dalmatien (Split-Umgebung) ────────────────────────────────────
  {
    revier_id: "kroatien-dalmatien",
    typ: "sehenswuerdigkeit",
    name: "Diokletianpalast Split",
    lat: 43.507849,
    lon: 16.439876,
    beschreibung:
      "Spätantike Palastanlage Kaiser Diokletians (um 305 n. Chr.), Kern der Altstadt von Split, seit 1979 UNESCO-Welterbe, durchgängig bewohnt.",
    confidence: 0.95,
    quelle_url: "https://de.wikipedia.org/wiki/Diokletianspalast",
    quelle_titel: "Diokletianspalast – Wikipedia",
  },
  {
    revier_id: "kroatien-dalmatien",
    typ: "sehenswuerdigkeit",
    name: "Nationalpark Kornati",
    lat: 43.8,
    lon: 15.233,
    beschreibung:
      "Dichtestes Inselarchipel des Mittelmeers (89 Inseln, Šibenik-Knin), seit 1980 Nationalpark; markante Kliffs (Krune) an den Außeninseln zur offenen See.",
    confidence: 0.9,
    quelle_url: "https://en.wikipedia.org/wiki/Kornati",
    quelle_titel: "Kornati – Wikipedia (EN)",
  },
  {
    revier_id: "kroatien-dalmatien",
    typ: "sehenswuerdigkeit",
    name: "Festung Fortica & Altstadt Hvar",
    lat: 43.140831,
    lon: 16.728331,
    beschreibung:
      "Venezianische Festung (1282–1551) über der Altstadt von Hvar mit Blick auf die Pakleni-Inseln; Pjaca-Hauptplatz von 1449 als Zentrum der Altstadt.",
    confidence: 0.9,
    quelle_url: "https://de.wikipedia.org/wiki/Hvar_(Stadt)",
    quelle_titel: "Hvar (Stadt) – Wikipedia",
  },
  {
    revier_id: "kroatien-dalmatien",
    typ: "sehenswuerdigkeit",
    name: "Altstadt Trogir (UNESCO-Welterbe)",
    lat: 43.5125,
    lon: 16.25167,
    beschreibung:
      "Inselstadt zwischen Festland und Čiovo, seit 1997 UNESCO-Welterbe; am besten erhaltener romanisch-gotischer Stadtkern Mitteleuropas, ca. 27 km westlich von Split.",
    confidence: 0.95,
    quelle_url: "https://en.wikipedia.org/wiki/Trogir",
    quelle_titel: "Trogir – Wikipedia (EN)",
  },
  {
    revier_id: "kroatien-dalmatien",
    typ: "sehenswuerdigkeit",
    name: "Blaue Grotte (Modra Špilja), Biševo",
    lat: 42.980389,
    lon: 16.0215,
    beschreibung:
      "Naturhöhle in der Bucht Balun an der Ostseite von Biševo (bei Komiža/Vis); bei Sonne und ruhiger See leuchtet das durchscheinende Licht das Wasser blau.",
    confidence: 0.9,
    quelle_url: "https://de.wikipedia.org/wiki/Modra_%C5%A1pilja",
    quelle_titel: "Blaue Grotte (Biševo) – Wikipedia",
  },
  {
    revier_id: "kroatien-dalmatien",
    typ: "sehenswuerdigkeit",
    name: "Nationalpark Krka (Skradinski buk)",
    lat: 43.805731,
    lon: 15.963181,
    beschreibung:
      "Wasserfall-Kaskade (17 Stufen, ca. 45,7 m Gesamthöhe) am Unterlauf der Krka bei Skradin, meistbesuchter der sieben Wasserfälle im Nationalpark.",
    confidence: 0.9,
    quelle_url: "https://en.wikipedia.org/wiki/Krka_National_Park",
    quelle_titel: "Krka National Park – Wikipedia (EN)",
  },
];

async function main() {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`TRUNCATE revier_poi, poi_vote RESTART IDENTITY CASCADE;`);

    for (const poi of POIS) {
      await client.query(
        `INSERT INTO revier_poi
           (revier_id, typ, name, lat, lon, beschreibung, saison_von, saison_bis,
            quellen_json, confidence, stand_datum, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'live')`,
        [
          poi.revier_id,
          poi.typ,
          poi.name,
          poi.lat,
          poi.lon,
          poi.beschreibung,
          poi.saison_von ?? null,
          poi.saison_bis ?? null,
          JSON.stringify([{ url: poi.quelle_url, titel: poi.quelle_titel, abgerufen_am: ABGERUFEN_AM }]),
          poi.confidence,
          STAND_DATUM,
        ],
      );
    }

    await client.query("COMMIT");
    console.log(`✓ ${POIS.length} POIs eingespielt (revier_poi).`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await getPool().end();
  }
}

main().catch((err) => {
  console.error("Seed fehlgeschlagen:", err);
  process.exit(1);
});
