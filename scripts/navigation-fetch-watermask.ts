// navigation-fetch-watermask.ts — erzeugt Wassermasken je Revier für das
// Land-Vermeidungs-Routing (src/lib/navigation/searoute.ts).
//
// Quelle: OSM-Küstenlinien als Land-MultiPolygon (@geo-maps/earth-coastlines-1km,
// ~1 km Auflösung, offline — keine API nötig). Wasser = NICHT im Landpolygon.
// Scanline-Verfahren (even-odd über alle Ringe) statt Punkt-in-Polygon je Zelle:
// eine Kantenliste pro Zeilen-Breitengrad, dann Spalten füllen — schnell genug
// für alle Reviere in einem Lauf.
//
// Binnenseen (Brombachsee, IJsselmeer) sind in Küstenlinien-Daten Land und
// kommen stattdessen aus @geo-maps/earth-lakes-1km (Wasser = IM See-Polygon).
// 1-km-Auflösung ist PLANUNGSqualität: enge Sunde können zulaufen, winzige
// Schären fehlen. Deshalb bleibt jede Route als "Planungshilfe" gekennzeichnet.
//
// Lauf:  npm run nav:watermask            (alle Küsten-Reviere)
//        npm run nav:watermask -- ruegen  (einzelne Reviere)
// Output: src/lib/navigation/masks/<id>.json + masks/index.ts (Registry).

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { alleReviere } from "../src/lib/navigation/reviere";
import { encodeMask, type WaterMask } from "../src/lib/navigation/watermask";
import { buildMaskFromLand, buildMaskFromWater, type Ring } from "../src/lib/navigation/maskgen";

const require = createRequire(import.meta.url);

// Binnenreviere: Küstenlinien kennen dort kein Wasser -> SEE-Polygone
// (@geo-maps/earth-lakes-1km) mit invertierter Logik (Wasser = im Polygon).
const BINNEN_AUS_SEEN = new Set(["brombachsee", "ijsselmeer"]);

function main(): void {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const wanted = alleReviere().filter((r) => (args.length ? args.includes(r.id) : true));
  if (!wanted.length) {
    console.error(`Kein Revier gefunden. Bekannt: ${alleReviere().map((r) => r.id).join(", ")}`);
    process.exit(1);
  }

  console.log("Lade OSM-Küstenlinien + Seen (1 km) …");
  const loadPolys = (pkg: string): Ring[][] => {
    const geo = require(pkg)() as {
      type: string;
      geometries: Array<{ type: string; coordinates: Ring[][] }>;
    };
    return geo.geometries.flatMap((g) => (g.type === "MultiPolygon" ? g.coordinates : []));
  };
  const polygons = loadPolys("@geo-maps/earth-coastlines-1km");
  const seen = loadPolys("@geo-maps/earth-lakes-1km");
  console.log(`${polygons.length} Landpolygone, ${seen.length} Seepolygone geladen.`);

  const outDir = path.join(process.cwd(), "src/lib/navigation/masks");
  mkdirSync(outDir, { recursive: true });

  const generated: string[] = [];
  for (const revier of wanted) {
    const binnen = BINNEN_AUS_SEEN.has(revier.id);
    const mask = binnen
      ? buildMaskFromWater(revier.bbox, seen.flat())
      : buildMaskFromLand(revier.bbox, polygons.flat());
    const water = countWater(mask);
    const frac = water / (mask.rows * mask.cols);
    const enc = encodeMask(mask);
    const file = path.join(outDir, `${revier.id}.json`);
    writeFileSync(
      file,
      JSON.stringify(
        {
          ...enc,
          meta: {
            revier: revier.id,
            source: binnen
              ? "@geo-maps/earth-lakes-1km (OSM, ODbL)"
              : "@geo-maps/earth-coastlines-1km (OSM, ODbL)",
            cell_deg: [
              (revier.bbox[2] - revier.bbox[0]) / mask.rows,
              (revier.bbox[3] - revier.bbox[1]) / mask.cols,
            ],
            hinweis: "Planungsqualität ~1 km — keine amtliche Seekarte.",
          },
        },
        null,
        0,
      ),
    );
    generated.push(revier.id);
    console.log(
      `- ${revier.id}: ${mask.rows}x${mask.cols} Zellen, Wasseranteil ${(frac * 100).toFixed(1)} % -> ${path.relative(process.cwd(), file)}`,
    );
  }

  // Registry IMMER aus dem Verzeichnisinhalt bauen, nie nur aus diesem Lauf:
  // `npm run nav:watermask -- ruegen` hätte sonst alle anderen Masken still
  // aus der Registry geworfen -> Landvermeidung überall aus (Review-Finding #6).
  const alleJson = readdirSync(outDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
  writeRegistry(outDir, alleJson);
  console.log(
    `Registry masks/index.ts mit ${alleJson.length} Masken geschrieben (davon ${generated.length} neu erzeugt).`,
  );
}

function countWater(mask: WaterMask): number {
  let water = 0;
  const total = mask.rows * mask.cols;
  for (let i = 0; i < total; i++) {
    if ((mask.bits[i >> 3] & (1 << (i & 7))) !== 0) water++;
  }
  return water;
}

/** masks/index.ts neu schreiben: statische Imports aller vorhandenen Masken. */
function writeRegistry(outDir: string, ids: string[]): void {
  const sorted = [...ids].sort();
  const imports = sorted
    .map((id, i) => `import m${i} from "./${id}.json" with { type: "json" };`)
    .join("\n");
  const entries = sorted.map((id, i) => `  "${id}": m${i} as unknown as EncodedMask,`).join("\n");
  const content = `// AUTOGENERIERT von scripts/navigation-fetch-watermask.ts — nicht von Hand editieren.
// Registry der eingecheckten Wassermasken (OSM-Küstenlinien, ~1 km, Planungsqualität).
${imports}
import { decodeMask, type EncodedMask, type WaterMask } from "../watermask";

const REGISTRY: Record<string, EncodedMask> = {
${entries}
};

export const AVAILABLE_MASKS: string[] = Object.keys(REGISTRY);

const cache = new Map<string, WaterMask>();

/** Dekodierte Wassermaske des Reviers oder null (z. B. Binnensee ohne Maske). */
export function getMaskForRevier(revierId: string): WaterMask | null {
  const enc = REGISTRY[revierId];
  if (!enc) return null;
  let mask = cache.get(revierId);
  if (!mask) {
    mask = decodeMask(enc);
    cache.set(revierId, mask);
  }
  return mask;
}
`;
  writeFileSync(path.join(outDir, "index.ts"), content);
}

main();
