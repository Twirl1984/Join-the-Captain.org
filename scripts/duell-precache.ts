// duell-precache.ts — hält Precache-Liste und Version des Duell-Service-Workers synchron.
//
// Der SW (public/toern-duell/sw.js) cached ALLE App-Dateien beim Install. Wird eine
// Datei geändert/hinzugefügt, ohne dass Liste + Versions-Hash neu erzeugt werden,
// liefert ein bereits installierter SW den alten Stand offline aus. Darum:
//   npm run duell:sw         schreibt Liste + Hash in sw.js
//   Drift-Test (Unit)        schlägt an, wenn sw.js nicht zum Dateistand passt
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const APP_DIR = path.join(REPO, "public", "toern-duell");
const AUSGENOMMEN = new Set(["sw.js", "README.md", "PLAN.md", ".DS_Store"]);

/** Alle ausgelieferten App-Dateien (relativ, sortiert) ohne SW selbst und Doku. */
export function appDateien(dir = APP_DIR): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (AUSGENOMMEN.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p).split(path.sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

export function versionsHash(dateien: string[], dir = APP_DIR): string {
  const h = crypto.createHash("sha256");
  for (const f of dateien) h.update(f).update("\0").update(fs.readFileSync(path.join(dir, f))).update("\0");
  return h.digest("hex").slice(0, 10);
}

/** Erwarteter SW-Text: Marker-Zeilen werden mit aktueller Liste/Version ersetzt. */
export function sollSw(swText: string, dir = APP_DIR): string {
  const dateien = appDateien(dir);
  const liste = dateien.map((f) => `  ${JSON.stringify(f)},`).join("\n");
  return swText
    .replace(/const VERSION = ".*?"; \/\/ SYNC:VERSION/, `const VERSION = "duell-${versionsHash(dateien, dir)}"; // SYNC:VERSION`)
    .replace(/\/\/ SYNC:START[\s\S]*?\/\/ SYNC:END/, `// SYNC:START\n${liste}\n  // SYNC:END`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const swPfad = path.join(APP_DIR, "sw.js");
  const alt = fs.readFileSync(swPfad, "utf8");
  const neu = sollSw(alt);
  if (neu !== alt) fs.writeFileSync(swPfad, neu);
  console.log(neu === alt ? "duell-sw: bereits aktuell" : "duell-sw: Precache-Liste/Version aktualisiert");
}
