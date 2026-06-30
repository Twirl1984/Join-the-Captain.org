// Gemeinsame Typen für das .org-Datenmodell.
// Spiegelt die SQL-Migrationen in /migrations.

export type JourneyPhase = "vor_buchung" | "planung" | "auf_dem_toern" | "danach";

export const JOURNEY_PHASES: JourneyPhase[] = [
  "vor_buchung",
  "planung",
  "auf_dem_toern",
  "danach",
];

export const JOURNEY_PHASE_LABEL: Record<JourneyPhase, string> = {
  vor_buchung: "Vor Buchung",
  planung: "Planung",
  auf_dem_toern: "Auf dem Törn",
  danach: "Danach",
};

export type FeatureStatus =
  | "neu"
  | "in_pruefung"
  | "voting"
  | "build"
  | "affiliate"
  | "verworfen"
  | "umgesetzt";

export type FeatureSize = "S" | "M" | "L" | "XL";

export type RundeStatus = "offen" | "voting" | "abgeschlossen";

export type PledgeStatus = "offen" | "bezahlt" | "erstattet";

export interface FeatureRequest {
  id: string;
  autor_id: string;
  autor_name: string;
  titel: string;
  journey_phase: JourneyPhase | null;
  problem: string | null;
  nutzen: string | null;
  status: FeatureStatus;
  size: FeatureSize | null;
  dev_tage_min: number | null;
  dev_tage_max: number | null;
  eur_min: number | null;
  eur_max: number | null;
  sizing_begruendung: string | null;
  runde_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  feature_id: string;
  user_id: string;
  created_at: string;
}

export interface Pledge {
  id: string;
  feature_id: string;
  user_id: string;
  betrag_cent: number;
  status: PledgeStatus;
  stripe_payment_intent_id: string | null;
  created_at: string;
}

export interface Runde {
  id: string;
  monat: string;
  status: RundeStatus;
  voting_endet_am: string | null;
}

// 'ueber_partner' = kein eigenes Programm, aber via Mutterkonzern/Netzwerk
// monetarisierbar (z.B. Navionics → Garmin Affiliate Program).
export type AffiliateProgrammStatus =
  | "hat_programm"
  | "kein_programm"
  | "ueber_partner"
  | "unbekannt";

export interface AffiliateTool {
  id: string;
  feature_id: string | null;
  name: string;
  slug: string;
  kategorie: string | null;
  journey_phase: JourneyPhase | null;
  kurzbeschreibung: string | null;
  beschreibung_md: string | null;
  affiliate_url: string;
  rating: number | null;
  icon_key: string | null;
  pro_contra_json: ProContra | null;
  veroeffentlicht: boolean;
  // Vom Research-Scout (Migration 0002) befüllt:
  affiliate_programm_status: AffiliateProgrammStatus | null;
  affiliate_netzwerk: string | null;
  recherche_quellen_json: string[] | null;
  recherche_confidence: number | null;
  recherchiert_am: string | null;
  // Migration 0003: Teilnahmebedingungen des Programms + ob wir sie erfüllen.
  affiliate_bedingungen: string | null;
  affiliate_voraussetzungen_erfuellt: boolean | null;
  // Migration 0005: Versions-Tracking für Aktualitäts-Checks
  getestete_version: string | null; // Version, die in Reviews/Videos getestet wurde
  aktuelle_version: string | null; // Aktuelle Version laut Repo/Webseite
  changelog_hinweis: string | null; // Highlights aus dem Changelog (für Aktualitäts-Bewertung)
  version_geprueft_am: string | null; // Wann wurde die Version zuletzt geprüft?
  created_at: string;
}

// Open-Source-Fund des Research-Scouts + kostenlose Alternativen.
//   typ='alternative'           → fertige OSS, löst das Problem direkt (Empfehlung).
//   typ='forkbar'               → Basis für einen JTC-Eigenbau (weiterentwickeln).
//   typ='kostenlos_alternative' → kostenlose (aber nicht zwingend OSS) Alternative.
export type OssTyp = "alternative" | "forkbar" | "kostenlos_alternative";

// Lizenz-Risiko fürs Forken in eine eigene, VERKAUFBARE Closed-Source-App.
//   niedrig = permissiv (MIT/Apache/BSD) → bedenkenlos forkbar
//   mittel  = schwaches Copyleft (MPL/LGPL) → mit Sorgfalt
//   hoch    = starkes Copyleft (GPL/AGPL) → Offenlegungspflicht, meiden
export type LizenzRisiko = "niedrig" | "mittel" | "hoch" | "unklar";

export interface OssKandidat {
  id: string;
  feature_id: string | null;
  tool_id: string | null;
  typ: OssTyp;
  name: string;
  repo_url: string;
  lizenz: string | null;
  sterne: number | null;
  journey_phase: JourneyPhase | null;
  beschreibung: string | null;
  wettbewerbs_einschaetzung: string | null;
  lizenz_risiko: LizenzRisiko | null;
  fork_kommerziell_ok: boolean | null;
  lizenz_hinweis: string | null;
  quellen_json: string[] | null;
  confidence: number | null;
  kostenlos: boolean | null; // Explizite Kennzeichnung (auch wenn typ='kostenlos_alternative')
  veroeffentlicht: boolean;
  created_at: string;
}

export type FeedbackSignal = "melden" | "hilfreich";
export type FeedbackZielTyp = "affiliate_tool" | "oss_kandidat";

export interface CommunityFeedback {
  id: string;
  ziel_typ: FeedbackZielTyp;
  ziel_id: string;
  user_id: string;
  signal: FeedbackSignal;
  grund: string | null;
  created_at: string;
}

// Interne Dev-Roadmap (Migration 0003). Auto-Einträge entstehen, wenn der
// Scout eine Affiliate-Bedingung findet, die JTC noch nicht erfüllt
// (z.B. Mindest-Traffic → Besucher-Zählung bauen).
export type RoadmapQuelle = "research_scout" | "community" | "manuell";
export type RoadmapPrioritaet = "niedrig" | "mittel" | "hoch";
export type RoadmapStatus = "offen" | "in_arbeit" | "erledigt" | "verworfen";

export interface RoadmapItem {
  id: string;
  titel: string;
  beschreibung: string | null;
  quelle: RoadmapQuelle;
  kategorie: string | null;
  bezug_tool_id: string | null;
  prioritaet: RoadmapPrioritaet;
  status: RoadmapStatus;
  created_at: string;
}

export interface ProContra {
  pro: string[];
  contra: string[];
  wofuer?: string;
  kosten?: string;
  crew?: string;
}

export interface ToolClick {
  id: string;
  tool_id: string;
  referrer: string | null;
  created_at: string;
}

export interface PodcastEpisode {
  id: string;
  titel: string;
  folge_nr: number;
  beschreibung: string | null;
  audio_url: string;
  dauer_sek: number | null;
  veroeffentlicht_am: string | null;
  slug: string;
}

export interface Partner {
  id: string;
  name: string;
  rolle: string | null;
  kurzbeschreibung: string | null;
  url: string | null;
  logo_key: string | null;
  sortierung: number;
}

// Aggregierte Sicht für Board-Karten.
export interface FeatureCard extends FeatureRequest {
  votes: number;
  pledge_summe_cent: number;
  pledge_ziel_cent: number;
  unterstuetzer: number;
  voted_by_user: boolean;
  tool?: AffiliateTool | null;
}

// ── Discovery-Agent & Affiliate-Anmeldungs-Liste (Migration 0004) ──

// Affiliate-Programm: Strukturierte Anmeldungs-Liste statt Auto-Publish.
// Status-Cycle: gefunden → beworben → aktiv → (optional: abgelehnt)
export type AffiliateProgrammAktiv = "gefunden" | "beworben" | "aktiv" | "abgelehnt";

export interface AffiliateProgramm {
  id: string;
  tool_id: string | null;
  programm_name: string;
  netzwerk: string | null;
  signup_url: string;
  bedingungen: string | null;
  status: AffiliateProgrammAktiv;
  affiliate_url: string | null; // Echter Link, erst nach Beitritt gefüllt
  notiz: string | null;
  created_at: string;
  updated_at: string;
}

// Thema für YouTube-Discovery-Agent. Pro Nacht: 1–2 Topics mit höchster priority.
export interface Topic {
  id: string;
  slug: string;
  title: string;
  status: "active" | "paused" | "done";
  priority: number;
  last_run_at: string | null;
  created_at: string;
}

// Creator-Submission: YouTube-Video oder sonstige Creator-Inhalte.
// source_type='discovered' = vom Agent gefunden, 'user_submitted' = Community-Eintrag
export interface CreatorSubmission {
  id: string;
  topic_id: string;
  source_type: "discovered" | "user_submitted" | "research_lead";
  video_title: string | null;
  creator_handle: string | null;
  creator_url: string | null;
  video_url: string | null;
  video_id: string | null;
  embed_html: string | null; // oEmbed iframe-HTML (Embed-only, kein Download)
  ai_summary: string | null; // Haiku-Summary
  suggested_products: Array<{ name: string; mention_context?: string }> | null;
  language: string | null;
  relevance_score: number | null;
  published_at: string | null;
  view_count: number | null;
  status: "pending" | "approved" | "published" | "rejected";
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

// Outreach-Draft zur Freigabe durch Admin. Kein Auto-Send.
export interface OutreachQueue {
  id: string;
  submission_id: string;
  creator_handle: string;
  platform: "email" | "youtube" | "twitter" | string;
  draft_subject: string | null;
  draft_body: string;
  status: "draft" | "approved" | "sent" | "discarded";
  reviewed_by: string | null;
  reviewed_at: string | null;
  sent_at: string | null;
  created_at: string;
}

// Gadget-Affiliate (STUFE 2, Feature-geflaggt): Produkte aus Videos.
export interface SubmissionProduct {
  id: string;
  submission_id: string;
  product_name: string;
  mention_context: string | null;
  affiliate_url: string | null;
  status: "proposed" | "published" | "rejected";
  created_at: string;
}

// Budget-Log: Kosten + Stop-Grund pro Discovery-Lauf.
export interface RunBudgetLog {
  id: string;
  run_at: string;
  ai_cost_eur: number | null;
  search_calls: number | null;
  candidates_found: number | null;
  outreach_drafts: number | null;
  stopped_reason: string | null;
  created_at: string;
}

// Community-Feedback auf Videos (Fragen, Lob, Probleme).
export interface VideoFeedback {
  id: string;
  submission_id: string;
  user_id: string | null;
  body: string;
  type: "question" | "not_understood" | "praise" | "issue";
  helpful_votes: number;
  created_at: string;
}
