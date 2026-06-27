// Lese-Zugriffe für Board, Tools, Podcast, Partner.
// Wird von Server-Komponenten (SSR) und API-Routen genutzt.

import { query, queryOne } from "./db";
import { aktuelleOffeneRunde } from "./pipeline";
import type {
  AffiliateTool,
  FeatureCard,
  FeatureRequest,
  JourneyPhase,
  Partner,
  PodcastEpisode,
  Pledge,
  Runde,
} from "./types";

// Pledge-Ziel: Mittelwert der KI-Kostenschätzung, in Cent.
function pledgeZielCent(f: FeatureRequest): number {
  if (f.eur_min == null || f.eur_max == null) return 0;
  return Math.round(((f.eur_min + f.eur_max) / 2) * 100);
}

// ── Board ───────────────────────────────────────────────────────────
export interface BoardData {
  runde: Runde | null;
  cards: FeatureCard[];
}

export async function getBoard(userId: string | null): Promise<BoardData> {
  const runde = await aktuelleOffeneRunde();

  // Karten der aktuellen Runde plus Affiliate/Verworfen ohne Runde-Bindung,
  // damit das Board alle drei Kartentypen zeigt.
  const features = await query<FeatureRequest & { roh_text?: string }>(
    `SELECT * FROM feature_request
     WHERE status IN ('voting','build','affiliate','verworfen','umgesetzt')
       AND ($1::uuid IS NULL OR runde_id = $1 OR status IN ('affiliate','verworfen'))
     ORDER BY updated_at DESC`,
    [runde?.id ?? null],
  );

  const cards: FeatureCard[] = [];
  for (const f of features) {
    cards.push(await zuKarte(f, userId));
  }

  // Sortierung: Voting/Build nach Votes, dann Affiliate, dann Verworfen.
  const rang = (c: FeatureCard) =>
    c.status === "verworfen" ? 2 : c.status === "affiliate" ? 1 : 0;
  cards.sort((a, b) => rang(a) - rang(b) || b.votes - a.votes);

  return { runde, cards };
}

export async function getFeature(
  id: string,
  userId: string | null,
): Promise<FeatureCard | null> {
  const f = await queryOne<FeatureRequest>(
    "SELECT * FROM feature_request WHERE id = $1",
    [id],
  );
  if (!f) return null;
  return zuKarte(f, userId);
}

async function zuKarte(
  f: FeatureRequest,
  userId: string | null,
): Promise<FeatureCard> {
  const votes = await queryOne<{ n: string }>(
    "SELECT COUNT(*)::int AS n FROM vote WHERE feature_id = $1",
    [f.id],
  );
  const pledges = await queryOne<{ summe: string; anzahl: string }>(
    `SELECT COALESCE(SUM(betrag_cent),0)::int AS summe,
            COUNT(DISTINCT user_id)::int AS anzahl
     FROM pledge WHERE feature_id = $1 AND status = 'bezahlt'`,
    [f.id],
  );
  const voted = userId
    ? await queryOne(
        "SELECT 1 FROM vote WHERE feature_id = $1 AND user_id = $2",
        [f.id, userId],
      )
    : null;

  let tool: AffiliateTool | null = null;
  if (f.status === "affiliate") {
    tool = await queryOne<AffiliateTool>(
      "SELECT * FROM affiliate_tool WHERE feature_id = $1 ORDER BY created_at LIMIT 1",
      [f.id],
    );
  }

  return {
    ...f,
    votes: Number(votes?.n ?? 0),
    pledge_summe_cent: Number(pledges?.summe ?? 0),
    pledge_ziel_cent: pledgeZielCent(f),
    unterstuetzer: Number(pledges?.anzahl ?? 0),
    voted_by_user: !!voted,
    tool,
  };
}

export async function getPledges(featureId: string): Promise<Pledge[]> {
  return query<Pledge>(
    `SELECT * FROM pledge WHERE feature_id = $1 AND status = 'bezahlt'
     ORDER BY created_at DESC`,
    [featureId],
  );
}

// ── Tools ───────────────────────────────────────────────────────────
export async function getTools(phase?: JourneyPhase | null): Promise<AffiliateTool[]> {
  if (phase) {
    return query<AffiliateTool>(
      `SELECT * FROM affiliate_tool
       WHERE veroeffentlicht = true AND journey_phase = $1
       ORDER BY rating DESC NULLS LAST, name`,
      [phase],
    );
  }
  return query<AffiliateTool>(
    `SELECT * FROM affiliate_tool
     WHERE veroeffentlicht = true
     ORDER BY rating DESC NULLS LAST, name`,
  );
}

export async function getToolBySlug(slug: string): Promise<AffiliateTool | null> {
  return queryOne<AffiliateTool>(
    "SELECT * FROM affiliate_tool WHERE slug = $1 AND veroeffentlicht = true",
    [slug],
  );
}

export async function getVerwandteTools(
  tool: AffiliateTool,
  limit = 3,
): Promise<AffiliateTool[]> {
  return query<AffiliateTool>(
    `SELECT * FROM affiliate_tool
     WHERE veroeffentlicht = true AND id <> $1 AND journey_phase = $2
     ORDER BY rating DESC NULLS LAST LIMIT $3`,
    [tool.id, tool.journey_phase, limit],
  );
}

// ── Podcast ─────────────────────────────────────────────────────────
export async function getEpisodes(): Promise<PodcastEpisode[]> {
  return query<PodcastEpisode>(
    `SELECT * FROM podcast_episode
     WHERE veroeffentlicht_am IS NOT NULL
     ORDER BY folge_nr DESC`,
  );
}

export async function getEpisodeBySlug(slug: string): Promise<PodcastEpisode | null> {
  return queryOne<PodcastEpisode>(
    "SELECT * FROM podcast_episode WHERE slug = $1",
    [slug],
  );
}

// ── Partner ─────────────────────────────────────────────────────────
export async function getPartner(): Promise<Partner[]> {
  return query<Partner>("SELECT * FROM partner ORDER BY sortierung, name");
}
