// Seed für die POI-Wissensbasis (REQ-EXP-001): je Pilot-Revier Dalmatien
// (kroatien-dalmatien) und Rügen (ruegen) 6 kuratierte POIs mit echten Quellen
// (Recherche-Datum 2026-07-15, WebSearch — Primärquellen wo verfügbar: UNESCO,
// Nationalpark-/Gemeinde-Seiten; Koordinaten wo nicht anders vermerkt aus
// latitude.to/dateandtime.info, cross-geprüft gegen die bestehenden Häfen in
// src/lib/navigation/reviere.ts).
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
  quellen: Array<{ url: string; titel: string }>;
  confidence: number;
}

const POIS: SeedPoi[] = [
  // ── Dalmatien (kroatien-dalmatien) ─────────────────────────────────────
  {
    revier_id: "kroatien-dalmatien",
    typ: "sehenswuerdigkeit",
    name: "Trogir – Altstadt (UNESCO-Weltkulturerbe)",
    lat: 43.5125,
    lon: 16.25167,
    beschreibung:
      "Venezianisch geprägter Stadtkern auf einer kleinen Insel zwischen Festland " +
      "und der Nachbarinsel Čiovo, durch Brücken verbunden. Seit 1997 UNESCO-" +
      "Weltkulturerbe als bestbewahrter romanisch-gotischer Baukomplex der Adria.",
    quellen: [
      { url: "https://whc.unesco.org/en/list/810/", titel: "Historic City of Trogir – UNESCO World Heritage Centre" },
      { url: "https://latitude.to/map/hr/croatia/cities/trogir", titel: "GPS coordinates of Trogir, Croatia" },
    ],
    confidence: 0.9,
  },
  {
    revier_id: "kroatien-dalmatien",
    typ: "sehenswuerdigkeit",
    name: "Modra Špilja (Blaue Grotte, Biševo)",
    lat: 42.98021,
    lon: 16.02211,
    beschreibung:
      "Höhle in der Bucht Balun auf Biševo, rund 5 sm südwestlich von Vis. " +
      "Zwischen 11 und 12 Uhr fällt Sonnenlicht durchs Wasser und taucht die " +
      "Grotte in leuchtendes Blau. Zugang nur per Boot (Ausflüge ab Komiža).",
    saison_von: 5,
    saison_bis: 10,
    quellen: [
      { url: "https://latitude.to/articles-by-country/hr/croatia/45619/blue-grotto-bisevo", titel: "GPS coordinates of Blue Grotto (Biševo)" },
      { url: "https://www.kroati.de/kroatien-infos/insel-bisevo-blaue-grotte.html", titel: "Blaue Grotte von Bisevo" },
    ],
    confidence: 0.85,
  },
  {
    revier_id: "kroatien-dalmatien",
    typ: "hafen-highlight",
    name: "Hvar – Altstadt & Hafen",
    lat: 43.172989,
    lon: 16.440144,
    beschreibung:
      "Hafenstadt an der Südküste der Insel Hvar, vorgelagert die Pakleni-Inseln. " +
      "Spanische Festung (1282–1551), Kathedrale St. Stephan und ein Hafenkai aus " +
      "Marmor von 1455.",
    quellen: [
      { url: "https://latitude.to/map/hr/croatia/cities/hvar", titel: "GPS coordinates of Hvar, Croatia" },
      { url: "https://de.wikipedia.org/wiki/Hvar_(Stadt)", titel: "Hvar (Stadt) – Wikipedia" },
    ],
    confidence: 0.9,
  },
  {
    revier_id: "kroatien-dalmatien",
    typ: "sehenswuerdigkeit",
    name: "Korčula – Altstadt",
    lat: 42.929718,
    lon: 16.888644,
    beschreibung:
      "Mittelalterliche Altstadt auf einer Halbinsel im Fischgräten-Grundriss, von " +
      "Stadtmauern und Türmen umschlossen. Gilt als (umstrittener) Geburtsort von " +
      "Marco Polo; das angebliche Geburtshaus kann besichtigt werden.",
    quellen: [
      { url: "https://dateandtime.info/citycoordinates.php?id=3197710", titel: "Geographic coordinates of Korčula" },
      { url: "https://www.skipperguide.de/wiki/Kor%C4%8Dula", titel: "Korčula – SkipperGuide" },
    ],
    confidence: 0.85,
  },
  {
    revier_id: "kroatien-dalmatien",
    typ: "sehenswuerdigkeit",
    name: "Nationalpark Kornati (Anlaufstelle Murter)",
    lat: 43.809045,
    lon: 15.594531,
    beschreibung:
      "89 Inseln und Riffe zwischen Dugi otok und Žirje. Ganzjährig geöffnet, " +
      "bootsgrößenabhängiges Eintrittsticket außerhalb des Parks (u. a. Murter, " +
      "Biograd) günstiger als am Eingang. Koordinate zeigt die Nationalparkverwaltung " +
      "in Murter (Butina 2) als Anlaufstelle, nicht die Mitte des Archipels.",
    quellen: [
      { url: "https://www.murter-kornati.com/de/so-erreichen-sie-uns", titel: "So erreichen Sie uns – murter-kornati.com" },
      { url: "https://www.np-kornati.hr/index.php?Itemid=404&id=326&lang=en&option=com_content&view=article", titel: "Kornati National Park – Ticket information" },
    ],
    confidence: 0.75,
  },
  {
    revier_id: "kroatien-dalmatien",
    typ: "hafen-highlight",
    name: "Vis – Stadt",
    lat: 43.045937,
    lon: 16.154057,
    beschreibung:
      "Hafenstadt auf der gleichnamigen Insel, gegründet im 4. Jh. v. Chr. als " +
      "griechische Kolonie Issa. Im Zweiten Weltkrieg Hauptquartier der " +
      "jugoslawischen Partisanenbewegung, bis 1989 Marinestützpunkt.",
    quellen: [
      { url: "https://www.latlong.net/place/vis-croatia-24024.html", titel: "Where is Vis, Croatia on Map Lat Long Coordinates" },
      { url: "https://en.wikipedia.org/wiki/Vis_(town)", titel: "Vis (town) – Wikipedia" },
    ],
    confidence: 0.85,
  },

  // ── Rügen (ruegen) ──────────────────────────────────────────────────────
  {
    revier_id: "ruegen",
    typ: "sehenswuerdigkeit",
    name: "Nationalpark Jasmund – Königsstuhl",
    lat: 54.573035,
    lon: 13.659444,
    beschreibung:
      "Höchste Kreidefelsen Rügens (118 m), Wahrzeichen des Nationalparks Jasmund. " +
      "Aussichtsplattform „Königsweg" am Nationalpark-Zentrum (Stubbenkammer 2, " +
      "Sassnitz), seit 2004 gebührenpflichtig.",
    quellen: [
      { url: "https://maps.adac.de/poi/nationalpark-zentrum-koenigsstuhl-sassnitz", titel: "Sassnitz, Nationalpark-Zentrum Königsstuhl – ADAC Maps" },
      { url: "https://en.wikipedia.org/wiki/Jasmund_National_Park", titel: "Jasmund National Park – Wikipedia" },
    ],
    confidence: 0.85,
  },
  {
    revier_id: "ruegen",
    typ: "sehenswuerdigkeit",
    name: "Kap Arkona – Leuchttürme & Jaromarsburg",
    lat: 54.680041,
    lon: 13.432029,
    beschreibung:
      "Nordspitze Rügens mit Schinkelturm (1826/27), Neuem Leuchtturm (1905) und " +
      "Peilturm (1927). Fundament der slawischen Kultstätte Jaromarsburg (9.–12. " +
      "Jh.), 1168 durch den dänischen König Valdemar I. erobert.",
    quellen: [
      { url: "https://en.wikipedia.org/wiki/Cape_Arkona", titel: "Cape Arkona – Wikipedia" },
      { url: "https://www.sassnitz-ruegen.de/kap-arkona-fischerdorf-vitt/", titel: "Kap Arkona und Fischerdorf Vitt" },
    ],
    confidence: 0.85,
  },
  {
    revier_id: "ruegen",
    typ: "bucht",
    name: "Vitt – Fischerdorf",
    lat: 54.66583,
    lon: 13.43167,
    beschreibung:
      "Reetdach-Fischerdorf in einer Kliffschlucht („Liete") unweit Kap Arkona, " +
      "1290 erstmals mit Fischereirecht durch den Rügenfürsten Witzlaw II. " +
      "urkundlich erwähnt. Von See aus wegen der geschützten Schluchtlage kaum " +
      "sichtbar.",
    quellen: [
      { url: "https://en.wikipedia.org/wiki/Vitt", titel: "Vitt – Wikipedia" },
    ],
    confidence: 0.75,
  },
  {
    revier_id: "ruegen",
    typ: "sehenswuerdigkeit",
    name: "Insel Hiddensee",
    lat: 54.568,
    lon: 13.1055,
    beschreibung:
      "Autofreie Ostseeinsel westlich der Rügener Halbinsel Bug. Privater " +
      "Autoverkehr ist seit 1927 verboten; Fortbewegung per Rad oder Pferdekutsche.",
    quellen: [
      { url: "https://de.wikipedia.org/wiki/Insel_Hiddensee", titel: "Insel Hiddensee – Wikipedia" },
    ],
    confidence: 0.85,
  },
  {
    revier_id: "ruegen",
    typ: "sehenswuerdigkeit",
    name: "Stralsund – Altstadt (UNESCO-Weltkulturerbe)",
    lat: 54.313975,
    lon: 13.089973,
    beschreibung:
      "Mittelalterlicher Stadtgrundriss der Hansestadt auf der Altstadtinsel, seit " +
      "27.06.2002 gemeinsam mit Wismar UNESCO-Weltkulturerbe.",
    quellen: [
      { url: "https://www.unesco.de/staette/altstaedte-von-stralsund-und-wismar/", titel: "Altstädte von Stralsund und Wismar – Deutsche UNESCO-Kommission" },
      { url: "https://www.laengengrad-breitengrad.de/gps-koordinaten-von-stralsund", titel: "GPS-Koordinaten von Stralsund" },
    ],
    confidence: 0.9,
  },
  {
    revier_id: "ruegen",
    typ: "sehenswuerdigkeit",
    name: "Koloss von Prora",
    lat: 54.43917,
    lon: 13.57556,
    beschreibung:
      "4,5 km langer, achtteiliger KdF-Gebäudekomplex (1936–1939) der NS-" +
      "Organisation „Kraft durch Freude", geplant für 20.000 Urlauber, nie wie " +
      "vorgesehen genutzt. Heute Dokumentationszentrum und Museen.",
    quellen: [
      { url: "https://en.wikipedia.org/wiki/Prora", titel: "Prora – Wikipedia" },
    ],
    confidence: 0.85,
  },
];

async function main() {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE poi_vote, revier_poi RESTART IDENTITY CASCADE;");

    for (const poi of POIS) {
      const quellenJson = JSON.stringify(
        poi.quellen.map((q) => ({ ...q, abgerufen_am: ABGERUFEN_AM })),
      );
      await client.query(
        `INSERT INTO revier_poi
           (revier_id, typ, name, lat, lon, beschreibung, saison_von, saison_bis,
            quellen_json, confidence, stand_datum, status, reviewed_am)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, 'live', now())`,
        [
          poi.revier_id,
          poi.typ,
          poi.name,
          poi.lat,
          poi.lon,
          poi.beschreibung,
          poi.saison_von ?? null,
          poi.saison_bis ?? null,
          quellenJson,
          poi.confidence,
          STAND_DATUM,
        ],
      );
    }

    await client.query("COMMIT");
    console.log(`Fertig. ${POIS.length} POIs eingespielt (live).`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Fehler beim Seed:", err);
    throw err;
  } finally {
    client.release();
  }
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
