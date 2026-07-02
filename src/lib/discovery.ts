// Nächtlicher YouTube-Discovery-Agent + Outreach (Feature-geflaggt).
//
// KERN-PRINZIP: Agent sammelt & entwirft, Mensch gibt frei. Kein Auto-Send,
// kein Auto-Publish. Nur Embed (oEmbed), kein Download.
//
// BUDGET: Harte Grenzen (MAX_RUN_BUDGET_EUR, MAX_DAILY_BUDGET_EUR).
// Bei Erreichen: sauber stoppen + Teilergebnis speichern + Kosten loggen.
//
// YOUTUBE: Feature-geflaggt (ENV), API-Key optional. Ohne Key: Quelle bleibt leer.
// Nur öffentliche Video-Metadaten, Kommentare via offizielle API.
//
// FLOW: Scheduler → Thema wählen → YouTube-Suche (wenn ENABLED) → oEmbed +
// Kommentare → Haiku strukturiert → creator_submissions pending → Outreach Draft
// → Admin-Freigabe → (später: Send via n8n) → Community-Voting.

import { callJsonTool, webRecherche, MODEL_HAIKU } from "./anthropic";
import { query, queryOne, withTransaction } from "./db";
import type {
  CreatorSubmission,
  OutreachQueue,
  RunBudgetLog,
  SubmissionProduct,
  Topic,
} from "./types";

// ── Konfiguration ──────────────────────────────────────────────────────
const YOUTUBE_DISCOVERY_ENABLED = process.env.YOUTUBE_DISCOVERY_ENABLED === "true";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || ""; // Falls vorhanden
const MAX_RUN_BUDGET_EUR = Number(process.env.DISCOVERY_MAX_RUN_BUDGET_EUR ?? 0.25);
const MAX_DAILY_BUDGET_EUR = Number(process.env.DISCOVERY_MAX_DAILY_BUDGET_EUR ?? 0.25);
const MAX_CANDIDATES_PER_TOPIC = Number(process.env.DISCOVERY_MAX_CANDIDATES ?? 3);
const MIN_RELEVANCE_SCORE = Number(process.env.DISCOVERY_MIN_RELEVANCE ?? 0.6);
// Aktualität (Teil D): nur Videos der letzten N Jahre, Mindest-Views als Qualität.
const YOUTUBE_MIN_VIEWS = Number(process.env.DISCOVERY_MIN_VIEWS ?? 1000);
const YOUTUBE_RECENCY_JAHRE = Number(process.env.DISCOVERY_RECENCY_JAHRE ?? 3);
// Suchbegriff-Suffix, damit generische Themen im Segel-Kontext bleiben.
const YOUTUBE_QUERY_SUFFIX = process.env.DISCOVERY_QUERY_SUFFIX ?? " Segeln";

// Token-Kosten pro 1M (ungefähr):
// Haiku: input ~$0.80, output ~$4.00 pro 1M
const HAIKU_INPUT_COST_PER_MTok = 0.80 / 1000;
const HAIKU_OUTPUT_COST_PER_MTok = 4.0 / 1000;

// ── Typen ──────────────────────────────────────────────────────────────
interface DiscoveryCandidate {
  video_id: string;
  title: string;
  creator_handle: string;
  creator_url: string;
  video_url: string;
  embed_html: string; // oEmbed iframe
  description: string;
  published_at: string; // ISO
  view_count: number;
  comment_highlights: string[];
}

interface DiscoveryResult {
  topic_id: string;
  candidates: DiscoveryCandidate[];
  stopped_reason: "completed" | "budget_reached" | "error";
  spent_eur: number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────

// Berechne Haiku-Token-Kosten (grob).
function estimateTokenCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_MTok;
  const outputCost = (outputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_MTok;
  return inputCost + outputCost;
}

// Wähle 1–2 Topics mit höchster priority + ältestem last_run_at.
export async function selectNextTopics(limit: number = 2): Promise<Topic[]> {
  const topics = await query<Topic>(
    `SELECT * FROM topics
     WHERE status = 'active'
     ORDER BY priority DESC, last_run_at ASC NULLS FIRST
     LIMIT $1`,
    [limit],
  );
  return topics;
}

// Google oEmbed via Standard-URL (YouTube unterstützt oembed.com).
async function getYouTubeOEmbed(videoUrl: string): Promise<{
  html: string;
  title: string;
  author_name: string;
  author_url: string;
} | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
      { signal: ctrl.signal, headers: { "user-agent": "JTC-Discovery/1.0" } },
    );
    clearTimeout(t);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      html?: string;
      title?: string;
      author_name?: string;
      author_url?: string;
    };
    return {
      html: json.html ?? "",
      title: json.title ?? "",
      author_name: json.author_name ?? "",
      author_url: json.author_url ?? "",
    };
  } catch {
    return null;
  }
}

// YouTube Data API v3 Antwort-Formen (nur was wir brauchen).
interface YtSearchResp {
  items?: Array<{ id?: { videoId?: string } }>;
}
interface YtVideosResp {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      channelId?: string;
      publishedAt?: string;
    };
    statistics?: { viewCount?: string };
  }>;
}
interface YtCommentsResp {
  items?: Array<{
    snippet?: { topLevelComment?: { snippet?: { textDisplay?: string } } };
  }>;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      console.warn(`[discovery] YouTube API HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn("[discovery] YouTube API Fehler:", err);
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Top-Kommentare als „modernes" Qualitätssignal (kann bei deaktivierten
// Kommentaren leer sein — dann still weiter).
async function topKommentare(videoId: string, n: number): Promise<string[]> {
  const url =
    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet` +
    `&videoId=${videoId}&order=relevance&maxResults=${n}&textFormat=plainText` +
    `&key=${YOUTUBE_API_KEY}`;
  const res = await fetchJson<YtCommentsResp>(url);
  return (res?.items ?? [])
    .map((it) => it?.snippet?.topLevelComment?.snippet?.textDisplay ?? "")
    .filter((s) => s.length > 0)
    .slice(0, n);
}

// Echte YouTube-Suche: relevante, möglichst NEUE (Teil D), einbettbare Videos
// mit Mindest-Views. Neueste zuerst; Top-Kommentare als Qualitätssignal.
async function searchYouTube(
  query: string,
  maxResults: number,
): Promise<DiscoveryCandidate[]> {
  if (!YOUTUBE_DISCOVERY_ENABLED || !YOUTUBE_API_KEY) {
    console.warn("[discovery] YouTube-Suche deaktiviert (Key/ENV fehlt)");
    return [];
  }

  // Aktualität: nur Videos der letzten N Jahre berücksichtigen.
  const publishedAfter = new Date(
    Date.now() - YOUTUBE_RECENCY_JAHRE * 365 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const suchbegriff = `${query}${YOUTUBE_QUERY_SUFFIX}`;

  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
    `&videoEmbeddable=true&relevanceLanguage=de&order=relevance` +
    `&maxResults=${Math.min(10, Math.max(1, maxResults * 3))}` +
    `&publishedAfter=${encodeURIComponent(publishedAfter)}` +
    `&q=${encodeURIComponent(suchbegriff)}&key=${YOUTUBE_API_KEY}`;
  const searchRes = await fetchJson<YtSearchResp>(searchUrl);
  const ids = (searchRes?.items ?? [])
    .map((it) => it?.id?.videoId)
    .filter((v): v is string => !!v);
  if (ids.length === 0) return [];

  // Statistiken + Details (viewCount, publishedAt) in einem Call.
  const videosUrl =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics` +
    `&id=${ids.join(",")}&key=${YOUTUBE_API_KEY}`;
  const videosRes = await fetchJson<YtVideosResp>(videosUrl);
  const items = videosRes?.items ?? [];

  const candidates: DiscoveryCandidate[] = [];
  for (const v of items) {
    const views = Number(v?.statistics?.viewCount ?? 0);
    if (views < YOUTUBE_MIN_VIEWS) continue; // Qualitäts-/Relevanzfilter
    const sn = v.snippet ?? {};
    const vid = v.id;
    candidates.push({
      video_id: vid,
      title: sn.title ?? "",
      creator_handle: sn.channelTitle ?? "",
      creator_url: sn.channelId
        ? `https://www.youtube.com/channel/${sn.channelId}`
        : "",
      video_url: `https://www.youtube.com/watch?v=${vid}`,
      embed_html: "", // wird später via oEmbed geholt
      description: sn.description ?? "",
      published_at: sn.publishedAt ?? new Date().toISOString(),
      view_count: views,
      comment_highlights: await topKommentare(vid, 3),
    });
  }

  // Aktualität bevorzugen: neueste zuerst, dann auf maxResults kürzen.
  candidates.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
  return candidates.slice(0, maxResults);
}

// ── Haiku-Strukturierung ───────────────────────────────────────────────

interface StructuredVideo {
  relevance_score: number; // 0..1
  language: string;
  summary: string;
  suggested_products: Array<{ name: string; mention_context: string }>;
}

async function structureVideoWithHaiku(
  video: DiscoveryCandidate,
  topicTitle: string,
): Promise<{ structured: StructuredVideo; costEur: number }> {
  const prompt = `Du analysierst ein YouTube-Video für die Segel-Community "Join the Captain".

Thema: ${topicTitle}
Video: ${video.title}
Creator: ${video.creator_handle}
Link: ${video.video_url}

Aufgaben:
1. Wie relevant ist dieses Video für unser Thema? (0..1, 0=irrelevant, 1=hochrelevant)
2. Sprache des Videos (de/en/andere)?
3. Kurzzusammenfassung (1-2 Sätze, Du-Form, Seglersprache)
4. Erwähnte Produkte (z.B. "Navionics erwähnt im 5:30-Segment") — nur wenn deutlich erwähnt.

Beschreibung: "${video.description.slice(0, 500)}"
Top-Kommentare: ${video.comment_highlights.slice(0, 3).join("\n")}`;

  const result = await callJsonTool<StructuredVideo>({
    model: MODEL_HAIKU,
    system:
      "Du bist ein Analyst für die Segel-Community. Bewerte YouTube-Videos " +
      "nach Relevanz, Sprache und erwähnten Produkten. Sei präzise, erfinde nichts.",
    user: prompt,
    toolName: "video_struktur",
    toolDescription: "Strukturierte Analyse eines YouTube-Videos.",
    schema: {
      type: "object",
      properties: {
        relevance_score: {
          type: "number",
          description: "0..1, wie relevant für das Thema",
        },
        language: {
          type: "string",
          description: "de, en, oder andere (ISO 639-1)",
        },
        summary: {
          type: "string",
          description: "1-2 Sätze, Du-Form.",
        },
        suggested_products: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              mention_context: { type: "string" },
            },
            required: ["name"],
          },
          description: "Nur wenn deutlich erwähnt (z.B. in Beschreibung/Kommentaren).",
        },
      },
      required: ["relevance_score", "language", "summary", "suggested_products"],
    },
    maxTokens: 512,
  });

  // Kosten-Schätzung (grob): 500 Input + 300 Output Tokens pro Video
  const cost = estimateTokenCost(500, 300);
  return { structured: result, costEur: cost };
}

// ── Outreach-Draft generieren ──────────────────────────────────────────

async function generateOutreachDraft(
  video: DiscoveryCandidate,
  summary: string,
  topicTitle: string,
): Promise<{ subject: string; body: string }> {
  // Einfacher Template statt AI-generiert (spart Kosten). AI wäre nice-to-have.
  const subject = `Join the Captain — Video zu "${topicTitle}"`;
  const body = `Hallo ${video.creator_handle || "Creator"}!

Wir sind begeistert von deinem Video "${video.title}" (${new URL(video.video_url).hostname}).

Darin zeigst du praktisch und verständlich, wie man ${topicTitle.toLowerCase()} anpackt.
Das ist genau das, wonach unsere Segel-Community fragt!

Wir würden dein Video gerne als Referenz in unserer Segel-Wissenssammlung teilen —
mit vollständiger Verlinkung und Nennung. Stört das dich?

Falls ja: Meld dich, wir finden eine gute Form.

Seglergruß,
Join the Captain (Segel-Wissensplattform)`;

  return { subject, body };
}

// ── Haupt-Logik ────────────────────────────────────────────────────────

export interface DiscoveryRunResult {
  topics_processed: number;
  submissions_created: number;
  outreach_drafts: number;
  total_spent_eur: number;
  stopped_reason: "completed" | "budget_reached" | "error";
  error?: string;
}

export async function runDiscoveryAgent(): Promise<DiscoveryRunResult> {
  const result: DiscoveryRunResult = {
    topics_processed: 0,
    submissions_created: 0,
    outreach_drafts: 0,
    total_spent_eur: 0,
    stopped_reason: "completed",
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[discovery] ANTHROPIC_API_KEY fehlt — Agent übersprungen.");
    result.stopped_reason = "error";
    result.error = "ANTHROPIC_API_KEY fehlt";
    return result;
  }

  try {
    // 1. Wähle Themen
    const topics = await selectNextTopics(2);
    if (topics.length === 0) {
      console.warn("[discovery] Keine aktiven Themen — fertig.");
      return result;
    }

    for (const topic of topics) {
      if (result.total_spent_eur >= MAX_RUN_BUDGET_EUR) {
        console.warn(`[discovery] Budget ${MAX_RUN_BUDGET_EUR} EUR erreicht.`);
        result.stopped_reason = "budget_reached";
        break;
      }

      // 2. Suche YouTube-Videos (oder Stub, falls deaktiviert)
      console.log(`[discovery] Verarbeite Thema "${topic.title}"…`);
      const candidates = await searchYouTube(topic.title, MAX_CANDIDATES_PER_TOPIC);

      // 3. Pro Kandidat: oEmbed + Strukturierung + Outreach
      for (const candidate of candidates) {
        if (result.total_spent_eur >= MAX_RUN_BUDGET_EUR) {
          result.stopped_reason = "budget_reached";
          break;
        }

        try {
          // oEmbed holen (gratis, nur Metadaten)
          const oembed = await getYouTubeOEmbed(candidate.video_url);
          if (!oembed) {
            console.warn(`[discovery] oEmbed fehlgeschlagen: ${candidate.video_url}`);
            continue;
          }

          // Strukturierung mit Haiku
          const { structured, costEur } = await structureVideoWithHaiku(candidate, topic.title);
          result.total_spent_eur += costEur;

          // Relevanz-Filter
          if (structured.relevance_score < MIN_RELEVANCE_SCORE) {
            console.log(`[discovery] Video zu irrelevant (${structured.relevance_score}), überspringen.`);
            continue;
          }

          // Outreach-Draft
          const outreach = await generateOutreachDraft(
            candidate,
            structured.summary,
            topic.title,
          );

          // 4. In DB speichern (Transaktion: submission + outreach + products)
          await withTransaction(async () => {
            const submission = await queryOne<CreatorSubmission>(
              `INSERT INTO creator_submissions
                 (topic_id, source_type, video_title, creator_handle, creator_url,
                  video_url, video_id, embed_html, ai_summary, suggested_products,
                  language, relevance_score, published_at, view_count, status)
               VALUES ($1,'discovered',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
               RETURNING *`,
              [
                topic.id,
                candidate.title,
                candidate.creator_handle,
                candidate.creator_url,
                candidate.video_url,
                candidate.video_id,
                oembed.html,
                structured.summary,
                JSON.stringify(structured.suggested_products || []),
                structured.language,
                structured.relevance_score,
                candidate.published_at,
                candidate.view_count,
              ],
            );

            if (!submission) {
              console.error("[discovery] Submission-Insert fehlgeschlagen");
              return;
            }

            // Outreach-Draft
            const outreachRow = await queryOne<OutreachQueue>(
              `INSERT INTO outreach_queue
                 (submission_id, creator_handle, platform, draft_subject, draft_body, status)
               VALUES ($1,$2,'email',$3,$4,'draft')
               RETURNING *`,
              [submission.id, candidate.creator_handle, outreach.subject, outreach.body],
            );

            if (outreachRow) {
              result.outreach_drafts++;
            }

            // Produkte (STUFE 2, proposed)
            if (structured.suggested_products && structured.suggested_products.length > 0) {
              for (const prod of structured.suggested_products) {
                await query(
                  `INSERT INTO submission_products
                     (submission_id, product_name, mention_context, status)
                   VALUES ($1,$2,$3,'proposed')`,
                  [submission.id, prod.name, prod.mention_context || null],
                );
              }
            }

            result.submissions_created++;
          });
        } catch (err) {
          console.error("[discovery] Fehler bei Kandidat:", err);
          // Weitermachen, nicht abbrechen
        }
      }

      // 5. Thema aktualisieren
      await query("UPDATE topics SET last_run_at = now() WHERE id = $1", [topic.id]);
      result.topics_processed++;
    }
  } catch (err) {
    console.error("[discovery] Agent-Fehler:", err);
    result.stopped_reason = "error";
    result.error = String(err);
  }

  // 6. Budget-Log
  await query(
    `INSERT INTO run_budget_log (run_at, ai_cost_eur, search_calls, candidates_found, outreach_drafts, stopped_reason)
     VALUES (now(),$1,$2,$3,$4,$5)`,
    [
      result.total_spent_eur,
      0, // YouTube-API-Calls würden hier erfasst
      result.submissions_created,
      result.outreach_drafts,
      result.stopped_reason,
    ],
  );

  console.log(
    `[discovery] Fertig: ${result.topics_processed} Themen, ` +
      `${result.submissions_created} Submissions, ${result.outreach_drafts} Drafts, ` +
      `${result.total_spent_eur.toFixed(4)} EUR spent.`,
  );

  return result;
}

// ── Admin-Freigabe ─────────────────────────────────────────────────────

export async function approvePendingSubmission(
  submissionId: string,
  adminId: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `UPDATE creator_submissions
     SET status = 'approved', approved_by = $1, approved_at = now()
     WHERE id = $2 AND status = 'pending'
     RETURNING id`,
    [adminId, submissionId],
  );
  return !!row;
}

export async function rejectSubmission(
  submissionId: string,
  reason: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `UPDATE creator_submissions
     SET status = 'rejected', rejection_reason = $1
     WHERE id = $2 AND status = 'pending'
     RETURNING id`,
    [reason, submissionId],
  );
  return !!row;
}

export async function approveOutreach(
  outreachId: string,
  adminId: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `UPDATE outreach_queue
     SET status = 'approved', reviewed_by = $1, reviewed_at = now()
     WHERE id = $2 AND status = 'draft'
     RETURNING id`,
    [adminId, outreachId],
  );
  return !!row;
}

export async function discardOutreach(outreachId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `UPDATE outreach_queue
     SET status = 'discarded'
     WHERE id = $1 AND status IN ('draft','approved')
     RETURNING id`,
    [outreachId],
  );
  return !!row;
}
