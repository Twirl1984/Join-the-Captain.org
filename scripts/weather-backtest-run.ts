// weather-backtest-run.ts — wertet fixtures/weather-backtest.jsonl aus.
//
// Rechnet den Sensitivitäts-Sweep (FP/FN je Regler-Stellung) und eine
// empfohlene Default-Stellung, schreibt eine Markdown-Tabelle nach
// docs/weather-backtest-results.md und gibt eine Kurzfassung auf stderr aus.
//
// Lauf:  npx tsx scripts/weather-backtest-run.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sweep, recommendSensitivity, type LabeledSample } from "../src/lib/weather/backtest";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IN = path.join(REPO, "fixtures", "weather-backtest.jsonl");
const OUT = path.join(REPO, "docs", "weather-backtest-results.md");

function load(): LabeledSample[] {
  if (!fs.existsSync(IN)) {
    console.error(`Keine Daten: ${IN}. Erst scripts/weather-backtest-fetch.ts laufen lassen.`);
    process.exit(1);
  }
  return fs
    .readFileSync(IN, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LabeledSample);
}

const pct = (x: number) => (x * 100).toFixed(1) + "%";

function main() {
  const samples = load();
  const grid = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const rows = sweep(samples, grid);
  const rec = recommendSensitivity(samples, { maxFnr: 0.05, fnCost: 5, fpCost: 1, kind: "sturm" });

  const nStorm = samples.filter((s) => s.observed.sturm).length;
  const nTstorm = samples.filter((s) => s.observed.gewitter).length;

  const lines: string[] = [];
  lines.push("# Backtest-Ergebnisse — Unwetterwarnungen (FP/FN)");
  lines.push("");
  lines.push(
    `Datensatz: **${samples.length}** stündliche Samples (archivierte Open-Meteo-Vorhersage ` +
      `vs. ERA5-Wahrheit), über die Revier-Häfen. Echte Stürme: **${nStorm}**, echte Gewitter (weather_code): **${nTstorm}**.`,
  );
  lines.push("");
  lines.push("**FP** = Fehlalarm (gewarnt, nichts passiert · Kosten: unnötig abgesagter Törn).");
  lines.push("**FN** = verpasste Warnung (nicht gewarnt, Unwetter trat ein · teuerste Fehlerart).");
  lines.push(`Regler 0 = risikofreudig (wenige FP, mehr FN) · 1 = vorsichtig (wenige FN, mehr FP).`);
  lines.push("");
  lines.push("## Sturm-Warnung je Regler-Stellung");
  lines.push("");
  lines.push("| Regler | Schwelle Böe | FP-Rate | FN-Rate | Precision | Recall |");
  lines.push("|---:|---:|---:|---:|---:|---:|");
  for (const r of rows) {
    const s = r.perKind.sturm.rates;
    const thr = (40 + (28 - 40) * r.sensitivity).toFixed(0);
    lines.push(
      `| ${r.sensitivity.toFixed(1)} | ${thr} kn | ${pct(s.fpr)} | ${pct(s.fnr)} | ${pct(s.precision)} | ${pct(s.recall)} |`,
    );
  }
  lines.push("");
  lines.push("## Gewitter-Warnung je Regler-Stellung");
  lines.push("");
  lines.push("| Regler | FP-Rate | FN-Rate | Precision | Recall |");
  lines.push("|---:|---:|---:|---:|---:|");
  for (const r of rows) {
    const g = r.perKind.gewitter.rates;
    lines.push(
      `| ${r.sensitivity.toFixed(1)} | ${pct(g.fpr)} | ${pct(g.fnr)} | ${pct(g.precision)} | ${pct(g.recall)} |`,
    );
  }
  lines.push("");
  lines.push("## Empfehlung (Default-Regler)");
  lines.push("");
  lines.push(
    `Für die Sturm-Warnung: **sensitivity ≈ ${rec.sensitivity.toFixed(2)}** ` +
      `(FN-Rate ${pct(rec.rates.fnr)}, FP-Rate ${pct(rec.rates.fpr)}). Regel: ${rec.reason}.`,
  );
  lines.push("");
  lines.push(
    "> Hinweis: Gewitter-Wahrheit stammt aus ERA5-`weather_code` und unterschätzt Konvektion " +
      "(bekannte Limitierung). Die Sturm-Zahlen (Böen vs. ERA5-Böen) sind belastbar.",
  );
  lines.push("");

  const s05 = rows.find((r) => Math.abs(r.sensitivity - 0.5) < 1e-9)!.perKind.sturm.rates;
  const bestFnr = Math.min(...rows.map((r) => r.perKind.sturm.rates.fnr));
  lines.push("## Erkenntnisse (datengetrieben)");
  lines.push("");
  lines.push(
    `- Bei Default 0.5 (34 kn) werden **${pct(s05.fnr)}** der echten Stürme verpasst (FN) bei nur ` +
      `${pct(s05.fpr)} Fehlalarmen — für ein Sicherheits-Tool zu viele Verpasser.`,
  );
  lines.push(
    `- Selbst bei maximaler Vorsicht (Regler 1.0) bleibt die FN-Rate bei **${pct(bestFnr)}**: die ` +
      `(archivierte) Modell-Böe unterschätzt die real gemessene Böe systematisch.`,
  );
  lines.push(
    "- Konsequenz: (a) Default-Regler eher vorsichtig setzen; (b) mittelfristig Bias-Korrektur der " +
      "Vorhersage-Böe bzw. besseres Sturm-Kriterium (Multi-Modell / Böen-Perzentil) — genau der Fall " +
      "für die jtc.de-Validierungsstudie. Der Backtest macht diese Lücke messbar.",
  );
  lines.push("");

  fs.writeFileSync(OUT, lines.join("\n"));
  console.error(`Geschrieben: ${path.relative(REPO, OUT)}`);
  console.error(
    `Empfehlung Sturm: sensitivity=${rec.sensitivity.toFixed(2)} · FNR=${pct(rec.rates.fnr)} · FPR=${pct(rec.rates.fpr)}`,
  );
}

main();
