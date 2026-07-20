// Sprache serverseitig bestimmen (REQ-I18N-001).
//
// Getrennt von sprache.ts, weil hier Next.js-spezifisches I/O passiert
// (`cookies()` aus next/headers). Die reine Logik bleibt drüben und damit
// offline testbar; hier ist nur die dünne Anbindung.

import { cookies, headers } from "next/headers";
import { SPRACHE_COOKIE, STANDARD_SPRACHE, normalisiereSprache, uebersetze, fuelle, type Sprache } from "./sprache";
import { WOERTERBUECHER } from "./woerterbuch";

/**
 * Die Sprache für den aktuellen Aufruf.
 *
 * Reihenfolge: ausdrückliche Wahl (Cookie) schlägt Browser-Vorgabe
 * (`Accept-Language`) schlägt Deutsch. Wer einmal umgeschaltet hat, bekommt
 * seine Wahl also auch dann, wenn der Browser etwas anderes meldet.
 */
export async function aktuelleSprache(): Promise<Sprache> {
  const gewaehlt = (await cookies()).get(SPRACHE_COOKIE)?.value;
  if (gewaehlt) return normalisiereSprache(gewaehlt, STANDARD_SPRACHE);
  const browser = (await headers()).get("accept-language");
  return normalisiereSprache(browser, STANDARD_SPRACHE);
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
