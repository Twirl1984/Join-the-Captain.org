// KI-Pipeline für Feature-Requests: drei Bots sequenziell.
//   1. Strukturierer (Haiku)  – Freitext strukturieren
//   2. App-Scout (Haiku)       – existiert eine etablierte App?
//   3. Sizer (Sonnet)          – Aufwand für den JTC-Stack schätzen
//
// Jeder Schritt ist idempotent (pipeline_log, unique pro Feature+Schritt),
// geloggt und einzeln retrybar. Ein API-Fehler bricht den Lauf ab, ohne
// Daten zu verlieren – beim nächsten Trigger wird ab dem offenen Schritt
// fortgesetzt.

import { callJsonTool, MODEL_HAIKU, MODEL_SONNET } from "./anthropic";
import { query, queryOne } from "./db";
import { slugify } from "./slug";
import type {
  FeatureRequest,
  FeatureSize,
  JourneyPhase,
  Runde,
} from "./types";

type Schritt = "strukturierer" | "app_scout" | "sizer";

async function bereitsErledigt(featureId: string, schritt: Schritt): Promise<boolean> {
  const row = await queryOne(
    `SELECT 1 FROM pipeline_log
     WHERE feature_id = $1 AND schritt = $2 AND status = 'ok' LIMIT 1`,
    [featureId, schritt],
  );
  return !!row;
}

async function logSchritt(
  featureId: string,
  schritt: Schritt,
  status: "ok" | "fehler",
  ausgabe: unknown,
  fehler?: string,
): Promise<void> {
  await query(
    `INSERT INTO pipeline_log (feature_id, schritt, status, ausgabe, fehler)
     VALUES ($1, $2, $3, $4, $5)`,
    [featureId, schritt, status, ausgabe ? JSON.stringify(ausgabe) : null, fehler ?? null],
  );
}

// ── Schritt 1: Strukturierer ────────────────────────────────────────
interface StrukturAusgabe {
  titel: string;
  journey_phase: JourneyPhase;
  problem: string;
  nutzen: string;
}

async function strukturieren(feature: FeatureRequest): Promise<void> {
  if (await bereitsErledigt(feature.id, "strukturierer")) return;

  const roh = (feature as FeatureRequest & { roh_text?: string }).roh_text || feature.titel;
  try {
    const out = await callJsonTool<StrukturAusgabe>({
      model: MODEL_HAIKU,
      system:
        "Du strukturierst Feature-Wünsche von Seglern für Join the Captain. " +
        "Ton: ruhig, Du-Form, kurze Sätze, maritim-natürlich. Kein 'Ahoi'. " +
        "Wähle die passende Journey-Phase: vor_buchung, planung, auf_dem_toern, danach.",
      user: `Strukturiere diesen Wunsch:\n\n"""${roh}"""`,
      toolName: "struktur",
      toolDescription: "Strukturierte Form des Wunsches.",
      schema: {
        type: "object",
        properties: {
          titel: { type: "string", description: "Kurzer, klarer Titel." },
          journey_phase: {
            type: "string",
            enum: ["vor_buchung", "planung", "auf_dem_toern", "danach"],
          },
          problem: { type: "string", description: "Welches Problem? Du-Form." },
          nutzen: { type: "string", description: "Welcher Nutzen? Du-Form." },
        },
        required: ["titel", "journey_phase", "problem", "nutzen"],
      },
    });

    await query(
      `UPDATE feature_request
       SET titel = $1, journey_phase = $2, problem = $3, nutzen = $4,
           status = 'in_pruefung', updated_at = now()
       WHERE id = $5`,
      [out.titel, out.journey_phase, out.problem, out.nutzen, feature.id],
    );
    await logSchritt(feature.id, "strukturierer", "ok", out);
  } catch (err) {
    await logSchritt(feature.id, "strukturierer", "fehler", null, String(err));
    throw err;
  }
}

// ── Schritt 2: App-Scout ────────────────────────────────────────────
interface ScoutAusgabe {
  existiert: boolean;
  app_name?: string;
  begruendung: string;
}

async function appScout(feature: FeatureRequest): Promise<boolean> {
  // Rückgabe true = an Affiliate übergeben, Pipeline endet hier.
  if (await bereitsErledigt(feature.id, "app_scout")) {
    const f = await queryOne<FeatureRequest>(
      "SELECT status FROM feature_request WHERE id = $1",
      [feature.id],
    );
    return f?.status === "affiliate";
  }

  const f = await queryOne<FeatureRequest>(
    "SELECT * FROM feature_request WHERE id = $1",
    [feature.id],
  );
  if (!f) throw new Error("Feature verschwunden.");

  try {
    const out = await callJsonTool<ScoutAusgabe>({
      model: MODEL_HAIKU,
      system:
        "Du bist der App-Scout von Join the Captain. Prüfe, ob es für einen " +
        "Segler-Feature-Wunsch bereits eine etablierte, real existierende App gibt. " +
        "Erfinde KEINE Apps. Bei Unsicherheit setze existiert=false. " +
        "Nenne nur Apps, die du wirklich kennst (z.B. Navionics, Windy, NoForeignLand).",
      user:
        `Titel: ${f.titel}\nProblem: ${f.problem}\nNutzen: ${f.nutzen}\n` +
        `Phase: ${f.journey_phase}\n\nGibt es dafür schon eine etablierte App?`,
      toolName: "scout",
      toolDescription: "Ergebnis der App-Recherche.",
      schema: {
        type: "object",
        properties: {
          existiert: { type: "boolean" },
          app_name: { type: "string", description: "Name der App, falls existiert." },
          begruendung: { type: "string", description: "Kurze Begründung, Du-Form." },
        },
        required: ["existiert", "begruendung"],
      },
    });

    if (out.existiert && out.app_name) {
      const name = out.app_name;
      const slug = await eindeutigerSlug(slugify(name));
      await query(
        `INSERT INTO affiliate_tool
           (feature_id, name, slug, journey_phase, kurzbeschreibung,
            beschreibung_md, affiliate_url, icon_key, veroeffentlicht)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)`,
        [
          feature.id,
          name,
          slug,
          f.journey_phase,
          out.begruendung.slice(0, 240),
          out.begruendung,
          "", // affiliate_url wird redaktionell ergänzt
          iconFuerPhase(f.journey_phase),
        ],
      );
      await query(
        `UPDATE feature_request SET status = 'affiliate', updated_at = now() WHERE id = $1`,
        [feature.id],
      );
      await logSchritt(feature.id, "app_scout", "ok", out);
      return true;
    }

    await logSchritt(feature.id, "app_scout", "ok", out);
    return false;
  } catch (err) {
    await logSchritt(feature.id, "app_scout", "fehler", null, String(err));
    throw err;
  }
}

// ── Schritt 3: Sizer ────────────────────────────────────────────────
interface SizerAusgabe {
  size: FeatureSize;
  dev_tage_min: number;
  dev_tage_max: number;
  eur_min: number;
  eur_max: number;
  begruendung: string;
}

async function sizen(feature: FeatureRequest): Promise<void> {
  if (await bereitsErledigt(feature.id, "sizer")) return;

  const f = await queryOne<FeatureRequest>(
    "SELECT * FROM feature_request WHERE id = $1",
    [feature.id],
  );
  if (!f) throw new Error("Feature verschwunden.");

  try {
    const out = await callJsonTool<SizerAusgabe>({
      model: MODEL_SONNET,
      system:
        "Du schätzt den Entwicklungsaufwand für Features der Plattform Join the Captain. " +
        "Stack: Next.js (App Router) + TypeScript, PostgreSQL/Supabase, Stripe. " +
        "Größen: S (1-2 Dev-Tage), M (3-8), L (8-15), XL (>15). " +
        "Rechne mit ~600 € pro Dev-Tag. Bei Unsicherheit runde auf. " +
        "Begründung in Du-Form, ruhig, kurz.",
      user:
        `Titel: ${f.titel}\nProblem: ${f.problem}\nNutzen: ${f.nutzen}\n` +
        `Phase: ${f.journey_phase}\n\nSchätze den Aufwand.`,
      toolName: "sizing",
      toolDescription: "Aufwandsschätzung.",
      schema: {
        type: "object",
        properties: {
          size: { type: "string", enum: ["S", "M", "L", "XL"] },
          dev_tage_min: { type: "integer" },
          dev_tage_max: { type: "integer" },
          eur_min: { type: "integer", description: "Untere Kostenschätzung in Euro." },
          eur_max: { type: "integer", description: "Obere Kostenschätzung in Euro." },
          begruendung: { type: "string" },
        },
        required: ["size", "dev_tage_min", "dev_tage_max", "eur_min", "eur_max", "begruendung"],
      },
    });

    const runde = await aktuelleOffeneRunde();
    await query(
      `UPDATE feature_request
       SET size = $1, dev_tage_min = $2, dev_tage_max = $3,
           eur_min = $4, eur_max = $5, sizing_begruendung = $6,
           status = 'voting', runde_id = $7, updated_at = now()
       WHERE id = $8`,
      [
        out.size,
        out.dev_tage_min,
        out.dev_tage_max,
        out.eur_min,
        out.eur_max,
        out.begruendung,
        runde?.id ?? null,
        feature.id,
      ],
    );
    await logSchritt(feature.id, "sizer", "ok", out);
  } catch (err) {
    await logSchritt(feature.id, "sizer", "fehler", null, String(err));
    throw err;
  }
}

// ── Orchestrierung ──────────────────────────────────────────────────
export async function runPipeline(featureId: string): Promise<FeatureRequest> {
  const feature = await queryOne<FeatureRequest>(
    "SELECT * FROM feature_request WHERE id = $1",
    [featureId],
  );
  if (!feature) throw new Error(`Feature ${featureId} nicht gefunden.`);

  await strukturieren(feature);
  const istAffiliate = await appScout(feature);
  if (!istAffiliate) {
    await sizen(feature);
  }

  const aktuell = await queryOne<FeatureRequest>(
    "SELECT * FROM feature_request WHERE id = $1",
    [featureId],
  );
  return aktuell!;
}

// ── Helfer ──────────────────────────────────────────────────────────
export async function aktuelleOffeneRunde(): Promise<Runde | null> {
  return queryOne<Runde>(
    `SELECT * FROM runde WHERE status IN ('offen','voting')
     ORDER BY CASE status WHEN 'voting' THEN 0 ELSE 1 END, monat DESC LIMIT 1`,
  );
}

async function eindeutigerSlug(basis: string): Promise<string> {
  let slug = basis;
  let n = 1;
  while (await queryOne("SELECT 1 FROM affiliate_tool WHERE slug = $1", [slug])) {
    n += 1;
    slug = `${basis}-${n}`;
  }
  return slug;
}

function iconFuerPhase(phase: JourneyPhase | null): string {
  switch (phase) {
    case "vor_buchung":
      return "checklist";
    case "planung":
      return "cloud";
    case "auf_dem_toern":
      return "map-2";
    case "danach":
      return "photo";
    default:
      return "apps";
  }
}
