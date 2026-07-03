// navigation-fetch-watermask.ts — erzeugt Wassermasken je Revier für das
// Land-Vermeidungs-Routing (src/lib/navigation/searoute.ts).
//
// Quelle: OSM-Küstenlinien als Land-MultiPolygon (@geo-maps/earth-coastlines-1km,
// ~1 km Auflösung, offline — keine API nötig). Wasser = NICHT im Landpolygon.
// Scanline-Verfahren (even-odd über alle Ringe) statt Punkt-in-Polygon je Zelle:
// eine Kantenliste pro Zeilen-Breitengrad, dann Spalten füllen — schnell genug
// für alle Reviere in einem Lauf.
//
// GRENZEN: Binnenseen (Brombachsee, IJsselmeer) sind in Küstenlinien-Daten Land
// und werden übersprungen — sie brauchen später OSM-Wasserflächen als Quelle.
// 1-km-Auflösung ist PLANUNGSqualität: enge Sunde können zulaufen, winzige
// Schären fehlen. Deshalb bleibt jede Route als "Planungshilfe" gekennzeichnet.
//
// Lauf:  npm run nav:watermask            (alle Küsten-Reviere)
//        npm run nav:watermask -- ruegen  (einzelne Reviere)
// Output: src/lib/navigation/masks/<id>.json + masks/index.ts (Registry).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { alleReviere } from "../src/lib/navigation/reviere";
import { encodeMask, type WaterMask } from "../src/lib/navigation/watermask";
import { buildMaskFromLand, type Ring } from "../src/lib/navigation/maskgen";

const require = createRequire(import.meta.url);

/** Binnenreviere: Küstenlinien-Daten kennen dort kein Wasser -> überspringen. */
const BINNEN_OHNE_MASKE = new Set(["brombachsee", "ijsselmeer"]);

function main(): void {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const wanted = alleReviere().filter((r) =>
    args.length ? args.includes(r.id) : !BINNEN_OHNE_MASKE.has(r.id),
  );
  if (!wanted.length) {
    console.error(`Kein Revier gefunden. Bekannt: ${alleReviere().map((r) => r.id).join(", ")}`);
    process.exit(1);
  }

  console.log("Lade OSM-Küstenlinien (1 km) …");
  const geo = require("@geo-maps/earth-coastlines-1km")() as {
    type: string;
    geometries: Array<{ type: string; coordinates: Ring[][] }>;
  };
  const polygons = geo.geometries.flatMap((g) => (g.type === "MultiPolygon" ? g.coordinates : []));
  console.log(`${polygons.length} Landpolygone geladen.`);

  const outDir = path.join(process.cwd(), "src/lib/navigation/masks");
  mkdirSync(outDir, { recursive: true });

  const generated: string[] = [];
  for (const revier of wanted) {
    if (BINNEN_OHNE_MASKE.has(revier.id)) {
      console.log(`- ${revier.id}: Binnensee, übersprungen (braucht OSM-Wasserflächen).`);
      continue;
    }
    const mask = buildMaskFromLand(revier.bbox, polygons.flat());
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
            source: "@geo-maps/earth-coastlines-1km (OSM, ODbL)",
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

  writeRegistry(outDir, generated);
  console.log(`Registry masks/index.ts mit ${generated.length} Masken geschrieben.`);
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
