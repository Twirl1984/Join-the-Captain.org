// Nächtlicher Research-Scout.
//
// Ergänzt den synchronen App-Scout (pipeline.ts, nur Modellwissen) um eine
// tiefe, web-gestützte Nacht-Recherche. Pro offenem Thema drei Aufgaben:
//   1. Affiliate-Programm  – existiert ein reales Partnerprogramm/Netzwerk?
//   2. OSS-Alternativen    – fertige Open-Source, die das Problem schon löst.
//   3. Forkbare OSS-Basis  – Repos, die JTC weiterentwickeln kann, um eine
//                            konkurrenzfähige eigene App zu bauen.
//
// Funde werden auto-publiziert (Brief-Entscheid). Guardrails statt Handarbeit:
// Auto-Publish nur, wenn Confidence ≥ Schwelle UND der Link wirklich erreichbar
// ist. Die Community ist die Review-Schicht (community_feedback → reagiereAufFeedback).
//
// Idempotent über research_log: erledigte Themen werden nachts nicht erneut
// recherchiert. Damit ist der Scout „still", wenn nichts Neues anliegt, und
// „wacht auf", sobald neue Wünsche/Tools auftauchen oder die Community meldet.

import { callJsonTool, webRecherche, MODEL_HAIKU, MODEL_SONNET } from "./anthropic";
import { query, queryOne } from "./db";
import { slugify } from "./slug";
import type {
  AffiliateProgrammStatus,
  AffiliateTool,
  FeatureRequest,
  OssTyp,
} from "./types";

// ── Stellschrauben (per .env überschreibbar, Kosten-/Lastkontrolle) ──
// Bewusst konservativ, damit ein Nacht-Lauf das Guthaben nicht leersaugt.
const MAX_ITEMS = Number(process.env.RESEARCH_MAX_ITEMS ?? 6); // pro Queue/Lauf
const WEB_MAX_USES = Number(process.env.RESEARCH_WEB_MAX_USES ?? 3); // Suchen/Thema
const MIN_CONFIDENCE = Number(process.env.RESEARCH_MIN_CONFIDENCE ?? 0.5);
const MELDE_SCHWELLE = Number(process.env.RESEARCH_MELDE_SCHWELLE ?? 3);
// Globale Kosten-/Zeitbremsen für den GESAMTEN Lauf (über beide Queues):
const MAX_SEARCHES = Number(process.env.RESEARCH_MAX_SEARCHES ?? 20); // Suchen/Lauf gesamt
const TIME_BUDGET_MS = Number(process.env.RESEARCH_TIME_BUDGET_MS ?? 240000); // 4 min
const CALL_TIMEOUT_MS = Number(process.env.RESEARCH_CALL_TIMEOUT_MS ?? 90000); // pro Suche

type ZielTyp = "affiliate_tool" | "feature";
type Schritt = "affiliate_programm" | "oss";

// ── Idempotenz & Log ────────────────────────────────────────────────
async function bereitsErledigt(
  zielTyp: ZielTyp,
  zielId: string,
  schritt: Schritt,
): Promise<boolean> {
  const row = await queryOne(
    `SELECT 1 FROM research_log
     WHERE ziel_typ = $1 AND ziel_id = $2 AND schritt = $3 AND status = 'ok' LIMIT 1`,
    [zielTyp, zielId, schritt],
  );
  return !!row;
}

async function logSchritt(
  zielTyp: ZielTyp,
  zielId: string,
  schritt: Schritt,
  status: "ok" | "fehler",
  ausgabe: unknown,
  fehler?: string,
): Promise<void> {
  await query(
    `INSERT INTO research_log (ziel_typ, ziel_id, schritt, status, ausgabe, fehler)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      zielTyp,
      zielId,
      schritt,
      status,
      ausgabe ? JSON.stringify(ausgabe) : null,
      fehler ?? null,
    ],
  );
}

// ── Link-Liveness ───────────────────────────────────────────────────
// Auto-Publish nur für erreichbare Links — verhindert tote Affiliate-/Repo-URLs.
async function urlLebt(url: string): Promise<boolean> {
  if (!/^https?:\/\//.test(url)) return false;
  const versuch = async (method: "HEAD" | "GET"): Promise<boolean> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "user-agent": "JTC-ResearchScout/1.0" },
      });
      return res.status < 400;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  };
  // Manche Seiten blocken HEAD → GET-Fallback.
  return (await versuch("HEAD")) || (await versuch("GET"));
}

// ── Schritt A: Affiliate-Programm ───────────────────────────────────
// Stufenlogik (Brief): Premium-App listen (auch ohne Programm) — aber falls es
// KEIN Programm gibt, eine vergleichbar gute Alternative finden, die EINS hat
// (Monetarisierung), und sie als eigenes Tool aufnehmen.
interface AffiliateAlternative {
  name: string;
  netzwerk: string | null;
  programm_url: string;
  kurzbeschreibung: string;
}
interface AffiliateRecherche {
  hat_programm: boolean;
  // Läuft das Affiliate über einen Mutterkonzern/Netzwerk statt ein eigenes
  // Programm? (z.B. Navionics → "Garmin Affiliate Program"). null = nein.
  via_partner: string | null;
  netzwerk: string | null; // Awin, Impact, CJ, Tapfiliate, direkt, …
  programm_url: string | null; // Anmelde-/Partnerseite
  tool_url: string; // beste öffentliche URL zum Tool
  kurzbeschreibung: string;
  // Teilnahmebedingungen: Mindest-Traffic/Besucher, Genehmigung, Provision,
  // Cookie-Dauer, Auszahlschwelle. Klartext, knapp.
  bedingungen: string | null;
  // Erfüllt JTC die Bedingungen voraussichtlich schon? (Bei Traffic-Schwellen
  // i.d.R. nein, solange wir das nicht messen.)
  voraussetzungen_erfuellt: boolean | null;
  // Falls etwas fehlt: knappe Dev-Aufgabe, um teilnahmefähig zu werden
  // (z.B. „Besucherzahlen tracken und Schwelle X erreichen"). null = nichts nötig.
  roadmap_hinweis: string | null;
  confidence: number; // 0..1
  quellen: string[];
  // Nur gesetzt, wenn das Tool selbst KEIN Programm hat:
  alternative_mit_programm: AffiliateAlternative | null;
}

// Rückgabe: Anzahl ausgeführter Web-Suchen (fürs globale Budget).
export async function recherchiereAffiliateProgramm(
  tool: AffiliateTool,
): Promise<number> {
  if (await bereitsErledigt("affiliate_tool", tool.id, "affiliate_programm")) return 0;

  try {
    // 1) Frei recherchieren (Web).
    const recherche = await webRecherche({
      model: MODEL_HAIKU,
      maxUses: WEB_MAX_USES,
      timeoutMs: CALL_TIMEOUT_MS,
      system:
        "Du bist der Affiliate-Scout von Join the Captain (Segel-Community). " +
        "Finde heraus, ob ein etabliertes Segel-/Reise-Tool ein reales " +
        "Affiliate- oder Partnerprogramm hat. Suche nach 'Tool + affiliate', " +
        "'Tool + partner program', prüfe Netzwerke (Awin, Impact, CJ, " +
        "Tradedoubler, PartnerStack, Tapfiliate, AvantLink) und die offizielle Seite. " +
        "Erfinde NICHTS.\n" +
        "WICHTIG: Hat das Tool kein EIGENES Programm, prüfe den MUTTERKONZERN/" +
        "ein Netzwerk (Beispiel: Navionics hat kein eigenes Programm, ist aber " +
        "über das Garmin Affiliate Program monetarisierbar) → via_partner setzen. " +
        "Gibt es auch das nicht, suche eine vergleichbar gute, beliebte " +
        "ALTERNATIVE mit eigenem Programm (alternative_mit_programm).\n" +
        "Recherchiere zu JEDEM gefundenen Programm die BEDINGUNGEN: " +
        "Mindest-Traffic/Besucherzahl, Genehmigungs-/Aufnahmekriterien, " +
        "Provision, Cookie-Dauer, Auszahlschwelle. Schätze, ob eine kleine " +
        "junge Community diese voraussichtlich schon erfüllt " +
        "(voraussetzungen_erfuellt). Falls etwas fehlt (z.B. Mindest-Traffic), " +
        "formuliere in roadmap_hinweis eine knappe Dev-Aufgabe, um " +
        "teilnahmefähig zu werden (z.B. Besucher tracken + Schwelle erreichen).",
      user:
        `Tool: ${tool.name}\n` +
        `Kontext: ${tool.kurzbeschreibung ?? ""}\n\n` +
        "1) Hat dieses Tool ein eigenes Affiliate-/Partnerprogramm? Netzwerk? " +
        "Anmelde-URL und beste öffentliche Tool-URL?\n" +
        "2) Falls nicht: Läuft Affiliate über den Mutterkonzern/ein Netzwerk " +
        "(via_partner)? Sonst: vergleichbare Alternative mit eigenem Programm?\n" +
        "3) Welche Teilnahme-BEDINGUNGEN hat das Programm (Mindest-Traffic, " +
        "Genehmigung, Provision, Auszahlung)? Erfüllen wir sie schon? Wenn " +
        "nicht: was müssen wir bauen/erreichen?",
    });

    // 2) In sauberes JSON gießen.
    const out = await callJsonTool<AffiliateRecherche>({
      model: MODEL_HAIKU,
      maxTokens: 1024,
      system:
        "Extrahiere die Affiliate-Recherche in striktes JSON. " +
        "Übernimm nur, was im Recherchetext belegt ist. confidence ehrlich " +
        "(0=geraten, 1=eindeutig belegt). quellen = die genannten URLs.",
      user:
        `Recherchetext:\n"""${recherche.text}"""\n\n` +
        `Gefundene URLs: ${recherche.quellen.join(", ") || "(keine)"}`,
      toolName: "affiliate_recherche",
      toolDescription: "Strukturiertes Ergebnis der Affiliate-Recherche.",
      schema: {
        type: "object",
        properties: {
          hat_programm: { type: "boolean" },
          via_partner: {
            type: ["string", "null"],
            description: "Mutterkonzern/Netzwerk, über den Affiliate läuft, z.B. 'Garmin Affiliate Program'. null wenn nicht.",
          },
          netzwerk: { type: ["string", "null"] },
          programm_url: { type: ["string", "null"] },
          tool_url: { type: "string", description: "Beste öffentliche URL zum Tool." },
          kurzbeschreibung: { type: "string", description: "1 Satz, Du-Form." },
          bedingungen: {
            type: ["string", "null"],
            description: "Teilnahmebedingungen: Mindest-Traffic/Besucher, Genehmigung, Provision, Cookie-Dauer, Auszahlschwelle. Knapp.",
          },
          voraussetzungen_erfuellt: {
            type: ["boolean", "null"],
            description: "Erfüllt eine kleine junge Community die Bedingungen voraussichtlich schon?",
          },
          roadmap_hinweis: {
            type: ["string", "null"],
            description: "Knappe Dev-Aufgabe, falls Bedingungen noch nicht erfüllt (z.B. Besucher tracken). null wenn nichts nötig.",
          },
          confidence: { type: "number" },
          quellen: { type: "array", items: { type: "string" } },
          alternative_mit_programm: {
            type: ["object", "null"],
            description: "Nur wenn hat_programm=false: vergleichbare Alternative MIT Affiliate-Programm.",
            properties: {
              name: { type: "string" },
              netzwerk: { type: ["string", "null"] },
              programm_url: { type: "string" },
              kurzbeschreibung: { type: "string", description: "1 Satz, Du-Form." },
            },
            required: ["name", "programm_url", "kurzbeschreibung"],
          },
        },
        required: ["hat_programm", "tool_url", "kurzbeschreibung", "confidence", "quellen"],
      },
    });

    // 3) Auswerten + (auto-)publizieren.
    const programmUrl = out.hat_programm ? out.programm_url || "" : "";
    const zielUrl = programmUrl || out.tool_url || tool.affiliate_url || "";
    const linkOk = zielUrl ? await urlLebt(zielUrl) : false;
    let status: AffiliateProgrammStatus;
    if (out.hat_programm) status = "hat_programm";
    else if (out.via_partner) status = "ueber_partner"; // z.B. Navionics → Garmin
    else status = "kein_programm";
    const confOk = out.confidence >= MIN_CONFIDENCE;
    const publish = confOk && linkOk && !!zielUrl;
    // Bei via_partner den Partner als „Netzwerk" ausweisen.
    const netzwerk = out.netzwerk ?? out.via_partner ?? null;

    await query(
      `UPDATE affiliate_tool
       SET affiliate_url = COALESCE(NULLIF($1,''), affiliate_url),
           affiliate_programm_status = $2,
           affiliate_netzwerk = $3,
           affiliate_bedingungen = $4,
           affiliate_voraussetzungen_erfuellt = $5,
           kurzbeschreibung = COALESCE(NULLIF(kurzbeschreibung,''), $6),
           recherche_quellen_json = $7,
           recherche_confidence = $8,
           recherchiert_am = now(),
           veroeffentlicht = (veroeffentlicht OR $9)
       WHERE id = $10`,
      [
        zielUrl,
        confOk ? status : "unbekannt",
        netzwerk,
        out.bedingungen ?? null,
        out.voraussetzungen_erfuellt ?? null,
        out.kurzbeschreibung.slice(0, 240),
        JSON.stringify([...new Set([...(out.quellen ?? []), ...recherche.quellen])]),
        out.confidence,
        publish,
        tool.id,
      ],
    );

    // Auto-Roadmap: fehlt eine Voraussetzung (z.B. Mindest-Traffic), lege eine
    // Dev-Aufgabe an — genau das „dann brauchen wir ein Feature, um da
    // hinzukommen" aus dem Brief.
    if (out.roadmap_hinweis && out.voraussetzungen_erfuellt !== true) {
      await legeRoadmapAn(
        `Affiliate-Voraussetzung: ${tool.name}`,
        out.roadmap_hinweis,
        "affiliate_voraussetzung",
        tool.id,
      );
    }

    // 4) Stufe „beste Alternative zwingend mit Affiliate": hat das Tool selbst
    //    kein Programm, aber es gibt eine vergleichbare mit Programm → als
    //    eigenes, publiziertes Tool aufnehmen (Monetarisierungspfad).
    let alternativeAngelegt: string | null = null;
    const alt = out.alternative_mit_programm;
    if (!out.hat_programm && alt?.programm_url && (await urlLebt(alt.programm_url))) {
      alternativeAngelegt = await legeAlternativeToolAn(tool, alt, recherche.quellen);
    }

    await logSchritt("affiliate_tool", tool.id, "affiliate_programm", "ok", {
      ...out,
      publiziert: publish,
      link_ok: linkOk,
      alternative_angelegt: alternativeAngelegt,
    });
    return recherche.suchen;
  } catch (err) {
    await logSchritt("affiliate_tool", tool.id, "affiliate_programm", "fehler", null, String(err));
    throw err;
  }
}

// Legt eine Affiliate-tragende Alternative als eigenes, publiziertes Tool an
// (gleiche Phase/Kategorie wie das Original). Idempotent über Slug.
async function legeAlternativeToolAn(
  original: AffiliateTool,
  alt: AffiliateAlternative,
  quellen: string[],
): Promise<string | null> {
  const slug = await eindeutigerToolSlug(slugify(alt.name));
  // Existiert ein Tool mit diesem Namen schon? Dann nicht doppeln.
  const vorhanden = await queryOne<{ id: string }>(
    "SELECT id FROM affiliate_tool WHERE lower(name) = lower($1) LIMIT 1",
    [alt.name],
  );
  if (vorhanden) return null;

  const row = await queryOne<{ id: string }>(
    `INSERT INTO affiliate_tool
       (feature_id, name, slug, kategorie, journey_phase, kurzbeschreibung,
        beschreibung_md, affiliate_url, icon_key, affiliate_programm_status,
        affiliate_netzwerk, recherche_quellen_json, recherche_confidence,
        recherchiert_am, veroeffentlicht)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'hat_programm',$10,$11,$12,now(),true)
     RETURNING id`,
    [
      original.feature_id,
      alt.name,
      slug,
      original.kategorie,
      original.journey_phase,
      alt.kurzbeschreibung.slice(0, 240),
      alt.kurzbeschreibung,
      alt.programm_url,
      original.icon_key,
      alt.netzwerk ?? null,
      JSON.stringify(quellen),
      0.7,
    ],
  );
  return row?.id ?? null;
}

async function eindeutigerToolSlug(basis: string): Promise<string> {
  let slug = basis || "tool";
  let n = 1;
  while (await queryOne("SELECT 1 FROM affiliate_tool WHERE slug = $1", [slug])) {
    n += 1;
    slug = `${basis}-${n}`;
  }
  return slug;
}

// Legt eine interne Dev-Roadmap-Aufgabe an (idempotent über den Titel).
export async function legeRoadmapAn(
  titel: string,
  beschreibung: string,
  kategorie: string,
  toolId: string | null,
): Promise<void> {
  await query(
    `INSERT INTO roadmap_item (titel, beschreibung, quelle, kategorie, bezug_tool_id)
     VALUES ($1, $2, 'research_scout', $3, $4)
     ON CONFLICT (titel) DO UPDATE SET beschreibung = EXCLUDED.beschreibung`,
    [titel.slice(0, 200), beschreibung, kategorie, toolId],
  );
}

// ── Schritt B: Open-Source-Recherche ────────────────────────────────
interface OssFund {
  name: string;
  repo_url: string;
  lizenz: string | null;
  sterne: number | null;
  beschreibung: string;
  wettbewerbs_einschaetzung: string | null; // nur sinnvoll bei forkbar
  // Lizenz-Sorgfalt fürs Forken in eine eigene, VERKAUFBARE Closed-Source-App.
  lizenz_risiko: "niedrig" | "mittel" | "hoch" | "unklar" | null;
  fork_kommerziell_ok: boolean | null;
  lizenz_hinweis: string | null;
  confidence: number;
  quellen: string[];
}
interface OssRecherche {
  alternativen: OssFund[];
  forkbare_basis: OssFund[];
}

async function speichereOss(
  feature: FeatureRequest,
  fund: OssFund,
  typ: OssTyp,
): Promise<boolean> {
  if (!fund.repo_url || !/^https?:\/\//.test(fund.repo_url)) return false;
  const linkOk = await urlLebt(fund.repo_url);
  const publish = fund.confidence >= MIN_CONFIDENCE && linkOk;

  await query(
    `INSERT INTO oss_kandidat
       (feature_id, typ, name, repo_url, lizenz, sterne, journey_phase,
        beschreibung, wettbewerbs_einschaetzung, lizenz_risiko, fork_kommerziell_ok,
        lizenz_hinweis, quellen_json, confidence, veroeffentlicht)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (feature_id, repo_url) DO UPDATE SET
       typ = EXCLUDED.typ,
       name = EXCLUDED.name,
       lizenz = EXCLUDED.lizenz,
       sterne = EXCLUDED.sterne,
       beschreibung = EXCLUDED.beschreibung,
       wettbewerbs_einschaetzung = EXCLUDED.wettbewerbs_einschaetzung,
       lizenz_risiko = EXCLUDED.lizenz_risiko,
       fork_kommerziell_ok = EXCLUDED.fork_kommerziell_ok,
       lizenz_hinweis = EXCLUDED.lizenz_hinweis,
       quellen_json = EXCLUDED.quellen_json,
       confidence = EXCLUDED.confidence,
       veroeffentlicht = (oss_kandidat.veroeffentlicht OR EXCLUDED.veroeffentlicht)`,
    [
      feature.id,
      typ,
      fund.name.slice(0, 200),
      fund.repo_url,
      fund.lizenz ?? null,
      fund.sterne ?? null,
      feature.journey_phase,
      fund.beschreibung?.slice(0, 600) ?? null,
      typ === "forkbar" ? fund.wettbewerbs_einschaetzung ?? null : null,
      fund.lizenz_risiko ?? null,
      fund.fork_kommerziell_ok ?? null,
      fund.lizenz_hinweis ?? null,
      JSON.stringify(fund.quellen ?? []),
      fund.confidence,
      publish,
    ],
  );
  return publish;
}

// Rückgabe: Anzahl ausgeführter Web-Suchen (fürs globale Budget).
export async function recherchiereOss(feature: FeatureRequest): Promise<number> {
  if (await bereitsErledigt("feature", feature.id, "oss")) return 0;

  try {
    const recherche = await webRecherche({
      model: MODEL_SONNET,
      maxUses: WEB_MAX_USES,
      maxTokens: 3072,
      timeoutMs: CALL_TIMEOUT_MS,
      system:
        "Du bist der Open-Source-Scout von Join the Captain. Für einen " +
        "Feature-Wunsch von Seglern suchst du zweierlei auf GitHub/GitLab: " +
        "(1) ALTERNATIVEN – fertige, gut bewertete Open-Source-Apps (viele " +
        "Stars, aktiv), die das Problem direkt lösen; (2) FORKBARE BASIS – " +
        "Repos, die JTC weiterentwickeln kann, um eine eigene, konkurrenzfähige " +
        "App zu bauen. Nenne reale Repos mit URL, Lizenz und ungefährer " +
        "Stern-Zahl. Erfinde nichts.\n" +
        "WICHTIG — Lizenz-Sorgfalt: Ziel sind EIGENE, VERKAUFBARE Apps " +
        "(Closed-Source). Prüfe je Repo das Lizenzmodell:\n" +
        "• permissiv (MIT/Apache/BSD) → lizenz_risiko='niedrig', fork_kommerziell_ok=true.\n" +
        "• schwaches Copyleft (MPL/LGPL) → 'mittel', mit Sorgfalt.\n" +
        "• starkes Copyleft (GPL/AGPL) → 'hoch', fork_kommerziell_ok=false " +
        "  (zwingt zur Offenlegung des Quellcodes — Rechtsrisiko, meiden).\n" +
        "Begründe das in lizenz_hinweis. Bei forkbaren Kandidaten zusätzlich " +
        "kurz: wie machen sie uns ggü. bestehenden Apps konkurrenzfähig?",
      user:
        `Titel: ${feature.titel}\nProblem: ${feature.problem ?? ""}\n` +
        `Nutzen: ${feature.nutzen ?? ""}\nPhase: ${feature.journey_phase ?? ""}\n\n` +
        "Finde Open-Source-Alternativen und forkbare Basis-Repos.",
    });

    const fundSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        repo_url: { type: "string", description: "GitHub/GitLab-URL." },
        lizenz: { type: ["string", "null"], description: "z.B. MIT, Apache-2.0, AGPL-3.0." },
        sterne: { type: ["integer", "null"] },
        beschreibung: { type: "string", description: "1-2 Sätze, Du-Form." },
        wettbewerbs_einschaetzung: {
          type: ["string", "null"],
          description: "Nur bei forkbar: macht uns das konkurrenzfähig? Kurz.",
        },
        lizenz_risiko: {
          type: ["string", "null"],
          enum: ["niedrig", "mittel", "hoch", "unklar", null],
          description: "Fork-Risiko für eine verkaufte Closed-Source-App.",
        },
        fork_kommerziell_ok: {
          type: ["boolean", "null"],
          description: "Darf in einer verkauften Closed-Source-App genutzt werden?",
        },
        lizenz_hinweis: {
          type: ["string", "null"],
          description: "Begründung der Lizenzfolgen (Offenlegungspflicht etc.).",
        },
        confidence: { type: "number" },
        quellen: { type: "array", items: { type: "string" } },
      },
      required: ["name", "repo_url", "beschreibung", "confidence", "quellen"],
    } as const;

    const out = await callJsonTool<OssRecherche>({
      model: MODEL_SONNET,
      maxTokens: 3072,
      system:
        "Extrahiere die OSS-Recherche in striktes JSON. Nur belegte Repos. " +
        "confidence ehrlich. Maximal 3 pro Kategorie. quellen = genannte URLs.",
      user:
        `Recherchetext:\n"""${recherche.text}"""\n\n` +
        `Gefundene URLs: ${recherche.quellen.join(", ") || "(keine)"}`,
      toolName: "oss_recherche",
      toolDescription: "Open-Source-Alternativen und forkbare Basis-Repos.",
      schema: {
        type: "object",
        properties: {
          alternativen: { type: "array", items: fundSchema, maxItems: 3 },
          forkbare_basis: { type: "array", items: fundSchema, maxItems: 3 },
        },
        required: ["alternativen", "forkbare_basis"],
      },
    });

    let publiziert = 0;
    for (const f of out.alternativen ?? []) {
      if (await speichereOss(feature, f, "alternative")) publiziert++;
    }
    for (const f of out.forkbare_basis ?? []) {
      if (await speichereOss(feature, f, "forkbar")) publiziert++;
    }

    await logSchritt("feature", feature.id, "oss", "ok", {
      alternativen: out.alternativen?.length ?? 0,
      forkbare_basis: out.forkbare_basis?.length ?? 0,
      publiziert,
    });
    return recherche.suchen;
  } catch (err) {
    await logSchritt("feature", feature.id, "oss", "fehler", null, String(err));
    throw err;
  }
}

// ── Orchestrierung: nächtlicher Scan ────────────────────────────────
export interface ScanErgebnis {
  uebersprungen: boolean;
  abgebrochen: boolean; // true = Kosten-/Zeitbudget erreicht, Rest bleibt offen
  affiliate_geprueft: number;
  affiliate_fehler: number;
  oss_geprueft: number;
  oss_fehler: number;
  suchen: number; // ausgeführte Web-Suchen im Lauf
}

export async function runResearchScan(): Promise<ScanErgebnis> {
  const ergebnis: ScanErgebnis = {
    uebersprungen: false,
    abgebrochen: false,
    affiliate_geprueft: 0,
    affiliate_fehler: 0,
    oss_geprueft: 0,
    oss_fehler: 0,
    suchen: 0,
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[research] ANTHROPIC_API_KEY fehlt — Scan übersprungen.");
    ergebnis.uebersprungen = true;
    return ergebnis;
  }

  const start = Date.now();
  // Budget erschöpft? (Zeit ODER Suchanzahl) → Lauf höflich beenden, der Rest
  // bleibt offen und kommt in der nächsten Nacht dran (idempotent).
  const budgetErschoepft = (): boolean => {
    if (Date.now() - start >= TIME_BUDGET_MS) {
      console.warn("[research] Zeitbudget erreicht — Abbruch, Rest folgt nachts.");
      ergebnis.abgebrochen = true;
      return true;
    }
    if (ergebnis.suchen >= MAX_SEARCHES) {
      console.warn("[research] Such-Budget erreicht — Abbruch, Rest folgt nachts.");
      ergebnis.abgebrochen = true;
      return true;
    }
    return false;
  };

  // Queue A: Affiliate-Tools, die noch nie recherchiert wurden.
  const tools = await query<AffiliateTool>(
    `SELECT * FROM affiliate_tool
     WHERE recherchiert_am IS NULL
     ORDER BY created_at LIMIT $1`,
    [MAX_ITEMS],
  );
  for (const t of tools) {
    if (budgetErschoepft()) return ergebnis;
    try {
      ergebnis.suchen += await recherchiereAffiliateProgramm(t);
      ergebnis.affiliate_geprueft++;
    } catch (err) {
      console.error(`[research] Affiliate-Fehler ${t.name}:`, err);
      ergebnis.affiliate_fehler++;
    }
  }

  // Queue B: Features, für die noch keine OSS-Recherche vorliegt.
  const features = await query<FeatureRequest>(
    `SELECT f.* FROM feature_request f
     WHERE f.status IN ('build','voting','umgesetzt')
       AND NOT EXISTS (
         SELECT 1 FROM research_log r
         WHERE r.ziel_typ = 'feature' AND r.ziel_id = f.id
           AND r.schritt = 'oss' AND r.status = 'ok')
     ORDER BY f.updated_at LIMIT $1`,
    [MAX_ITEMS],
  );
  for (const f of features) {
    if (budgetErschoepft()) return ergebnis;
    try {
      ergebnis.suchen += await recherchiereOss(f);
      ergebnis.oss_geprueft++;
    } catch (err) {
      console.error(`[research] OSS-Fehler ${f.titel}:`, err);
      ergebnis.oss_fehler++;
    }
  }

  return ergebnis;
}

// ── Community-Reaktion ──────────────────────────────────────────────
// Wird vom Feedback-Endpoint aufgerufen. Ab MELDE_SCHWELLE 'melden'-Signalen
// depubliziert das System den Fund und reiht das Thema zur erneuten
// Nacht-Recherche wieder ein (Brief: „sobald Community prüft und antwortet,
// reagieren").
export async function reagiereAufFeedback(
  zielTyp: "affiliate_tool" | "oss_kandidat",
  zielId: string,
): Promise<{ depubliziert: boolean; meldungen: number }> {
  const row = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::int AS n FROM community_feedback
     WHERE ziel_typ = $1 AND ziel_id = $2 AND signal = 'melden'`,
    [zielTyp, zielId],
  );
  const meldungen = Number(row?.n ?? 0);
  if (meldungen < MELDE_SCHWELLE) return { depubliziert: false, meldungen };

  if (zielTyp === "affiliate_tool") {
    // Depublizieren + zur erneuten Recherche freigeben.
    await query(
      `UPDATE affiliate_tool
       SET veroeffentlicht = false, recherchiert_am = NULL WHERE id = $1`,
      [zielId],
    );
    await query(
      `DELETE FROM research_log
       WHERE ziel_typ = 'affiliate_tool' AND ziel_id = $1 AND schritt = 'affiliate_programm'`,
      [zielId],
    );
  } else {
    // OSS-Kandidat depublizieren + die OSS-Recherche seines Features freigeben.
    const k = await queryOne<{ feature_id: string | null }>(
      "SELECT feature_id FROM oss_kandidat WHERE id = $1",
      [zielId],
    );
    await query("UPDATE oss_kandidat SET veroeffentlicht = false WHERE id = $1", [zielId]);
    if (k?.feature_id) {
      await query(
        `DELETE FROM research_log
         WHERE ziel_typ = 'feature' AND ziel_id = $1 AND schritt = 'oss'`,
        [k.feature_id],
      );
    }
  }
  return { depubliziert: true, meldungen };
}
