// flags.ts — Feature-Flags (Reversibilitäts-Regel aus dem Agentic-Playbook).
//
// Nutzerseitige Features stehen hinter einem Env-Kill-Switch: Default AN,
// explizites "off"/"false"/"0" schaltet ab — das Flag ist der Rollback-Hebel
// (Deploy-Env umstellen, kein Code-Revert nötig).
//
// NEXT_PUBLIC_*-Variablen werden zur BUILD-Zeit eingebacken; auf dem VPS heißt
// Rollback also: Env setzen + `docker compose up -d --build` (Minuten, nicht
// Stunden). Für Server-Komponenten (page.tsx, SiteHeader) reicht das Flag auch
// zur Laufzeit des Node-Prozesses.

/** true, wenn der Flag-Wert das Feature aktiv lässt (Default an). */
export function flagEnabled(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v !== "off" && v !== "false" && v !== "0";
}

/** Kill-Switch der Navigations-App (/navigation + Header-Link + APIs). */
export function navigationEnabled(): boolean {
  return flagEnabled(process.env.NEXT_PUBLIC_FEATURE_NAVIGATION);
}

/**
 * Wetterzeichen v2 auf der Navigationskarte (REQ-WET-015/016): Beaufort-Windfahnen
 * statt Pfeil, größere/kontrastreichere Symbole, Temperatur- und Niederschlags-Glyphen.
 * Default an; `off/false/0` fällt auf die bisherige Pfeil-Darstellung zurück
 * (Rollback-Hebel, kein Code-Revert nötig).
 */
export function weatherSymbolsV2Enabled(): boolean {
  return flagEnabled(process.env.NEXT_PUBLIC_FEATURE_WX_SYMBOLS_V2);
}

/**
 * Community-Votum zur POI-Qualitätssicherung (REQ-EXP-003): Nutzer bewerten
 * ‚stimmt noch / stimmt nicht mehr'. Ab 2 Negativ-Meldungen OHNE Gegenstimme
 * wird der Eintrag zurückgestuft. Default an; `off/false/0` fällt auf
 * Votum-freie Empfehlungen zurück (Rollback-Hebel, kein Code-Revert nötig).
 */
export function communityVotumEnabled(): boolean {
  return flagEnabled(process.env.NEXT_PUBLIC_FEATURE_COMMUNITY_VOTUM);
}
