// Sprache serverseitig bestimmen (REQ-I18N-001).
//
// Getrennt von sprache.ts, weil hier Next.js-spezifisches I/O passiert
// (`cookies()` aus next/headers). Die reine Logik bleibt drüben und damit
// offline testbar; hier ist nur die dünne Anbindung.

import { cookies } from "next/headers";
import { SPRACHE_COOKIE, STANDARD_SPRACHE, normalisiereSprache, uebersetze, fuelle, type Sprache } from "./sprache";
import { WOERTERBUECHER } from "./woerterbuch";

/**
 * Die Sprache für den aktuellen Aufruf.
 *
 * NUR die ausdrückliche Wahl (Cookie) zählt; sonst Deutsch.
 *
 * Die Browser-Vorgabe (`Accept-Language`) wird BEWUSST NICHT ausgewertet —
 * geändert am 2026-07-20, nachdem 17 E2E-Tests aufgedeckt hatten, was das in
 * der Praxis bedeutet: Playwright startet mit `en-US`, also kam die Seite auf
 * Englisch, ohne dass jemand umgeschaltet hatte. Dasselbe träfe einen deutschen
 * Segler mit englisch eingestelltem Browser.
 *
 * Der Grund, warum das schadet: Die englische Fassung ist ABSICHTLICH
 * unvollständig — Haftungs-, Impressums- und Datenschutztexte bleiben deutsch
 * (REQ-SAFE-002). Wer ungefragt auf Englisch landet, bekommt eine halbdeutsche
 * Seite. Deutsch ist die Originalsprache; Englisch ist ein Angebot, das man
 * aktiv annimmt.
 *
 * Sobald es eine juristisch geprüfte englische Fassung der Rechtstexte gibt,
 * kann `Accept-Language` als Vorauswahl wieder dazukommen.
 */
export async function aktuelleSprache(): Promise<Sprache> {
  const gewaehlt = (await cookies()).get(SPRACHE_COOKIE)?.value;
  return normalisiereSprache(gewaehlt, STANDARD_SPRACHE);
}

/**
 * Übersetzer für Server-Komponenten.
 *
 *   const t = await uebersetzer();
 *   <button>{t("nav.berechnen")}</button>
 *   <span>{t("nav.punkte_gesetzt", { n: 3 })}</span>
 */
export async function uebersetzer(): Promise<
  (schluessel: string, werte?: Record<string, string | number>) => string
> {
  const sprache = await aktuelleSprache();
  return (schluessel, werte) => {
    const text = uebersetze(WOERTERBUECHER, schluessel, sprache);
    return werte ? fuelle(text, werte) : text;
  };
}
