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

export type AffiliateProgrammStatus = "hat_programm" | "kein_programm" | "unbekannt";

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
  created_at: string;
}

// Open-Source-Fund des Research-Scouts.
//   typ='alternative' → fertige OSS, löst das Problem direkt (Empfehlung).
//   typ='forkbar'     → Basis für einen JTC-Eigenbau (weiterentwickeln).
export type OssTyp = "alternative" | "forkbar";

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
