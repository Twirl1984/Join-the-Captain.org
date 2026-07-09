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
