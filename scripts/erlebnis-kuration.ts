// Kurations-Routine (REQ-EXP-002) — Append-and-Review für revier_poi.
//
//   npm run erlebnis:kuration
//
// Zwei Durchgänge, wie im Skill .claude/skills/erlebnis-wissen/SKILL.md:
// 1. Review bestehender live-Einträge (älteste zuerst): Events mit
//    überschrittenem gueltig_bis → archiviert; tote Quelle → prüfen;
//    sonst reviewed_am auffrischen. Kein Eintrag bleibt > 6 Monate ungereviewt.
// 2. Promotion von Entwürfen (Append-Inbox) nach live, wenn Confidence ≥
//    Schwelle UND die Quelle erreichbar ist — sonst bleibt der Entwurf liegen.
//
// Gedacht für denselben nächtlichen Cron wie qa-smoke (VPS, docs/erlebnis-
// system.md). Schreibt einen kurzen Markdown-Report nach RESEARCH_REPORT_DIR.

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "./load-env.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
loadEnv(join(root, ".env"));

const {
  listReviewFaelligePois,
  listEntwuerfe,
  setPoiStatus,
  markPoiReviewed,
} = await import("../src/lib/erlebnis/poi.ts");
const { entscheideReview, erfuelltAutoPublishSchwelle, urlErreichbar } = await import(
  "../src/lib/erlebnis/kuration.ts"
);

function stempel(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function ersteQuelle(poi: { quellen_json: { url: string }[] }): string | null {
  return poi.quellen_json?.[0]?.url ?? null;
}

async function main() {
  const start = stempel();
  const jetzt = new Date();
  console.log(`[erlebnis-kuration] Lauf-Start ${start}`);

  // ── 1. Review bestehender live-Einträge ──────────────────────────
  const reviewFaellig = await listReviewFaelligePois();
  let archiviert = 0;
  let zuPruefen = 0;
  let aufgefrischt = 0;

  for (const poi of reviewFaellig) {
    const url = ersteQuelle(poi);
    const erreichbar = url ? await urlErreichbar(url) : false;
    const aktion = entscheideReview(poi, jetzt, erreichbar);

    if (aktion.typ === "archivieren") {
      await setPoiStatus(poi.id, "archiviert");
      archiviert++;
      console.log(`[erlebnis-kuration] archiviert: ${poi.name} (${aktion.grund})`);
    } else if (aktion.typ === "pruefen") {
      await setPoiStatus(poi.id, "pruefen");
      zuPruefen++;
      console.log(`[erlebnis-kuration] prüfen: ${poi.name} (Quelle nicht erreichbar: ${url})`);
    } else {
      await markPoiReviewed(poi.id);
      aufgefrischt++;
    }
  }

  // ── 2. Promotion von Entwürfen (Append-Inbox) ────────────────────
  const entwuerfe = await listEntwuerfe();
  let promoviert = 0;

  for (const poi of entwuerfe) {
    const url = ersteQuelle(poi);
    const erreichbar = url ? await urlErreichbar(url) : false;
    if (erfuelltAutoPublishSchwelle(poi, erreichbar)) {
      await setPoiStatus(poi.id, "live");
      await markPoiReviewed(poi.id);
      promoviert++;
      console.log(`[erlebnis-kuration] promoviert (entwurf→live): ${poi.name}`);
    }
  }

  const zeilen = [
    `# Erlebnis-Kuration — Lauf ${start}`,
    "",
    `- Review-fällige live-POIs geprüft: **${reviewFaellig.length}**`,
    `  - reviewed_am aufgefrischt: ${aufgefrischt}`,
    `  - archiviert (Event abgelaufen): ${archiviert}`,
    `  - auf 'prüfen' gesetzt (Quelle tot): ${zuPruefen}`,
    `- Entwürfe geprüft: **${entwuerfe.length}**, promoviert (entwurf→live): ${promoviert}`,
    "",
  ];
  const report = zeilen.join("\n");
  console.log("\n" + report);

  const dir = process.env.RESEARCH_REPORT_DIR || join(root, "reports");
  try {
    mkdirSync(dir, { recursive: true });
    const datei = join(dir, `erlebnis-kuration-${start.replace(/[:]/g, "-")}.md`);
    writeFileSync(datei, report, "utf8");
    console.log(`[erlebnis-kuration] Report: ${datei}`);
  } catch (err) {
    console.warn("[erlebnis-kuration] Report konnte nicht geschrieben werden:", err);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[erlebnis-kuration] Fataler Fehler:", err);
  process.exit(1);
});
