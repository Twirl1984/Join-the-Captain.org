// Wahl der Windsymbol-Darstellung (REQ-WET-017) — Pfeil oder Beaufort-Windfahne.
//
// Bis hierher war die Darstellung eine BUILD-Zeit-Entscheidung (Env-Flag
// NEXT_PUBLIC_FEATURE_WX_SYMBOLS_V2, siehe lib/flags.ts): Umstellen hiess neu
// bauen und deployen. Skipper haben aber unterschiedliche Lesegewohnheiten —
// die Beaufort-Fahne kodiert Richtung UND Stärke in einem Glyph (fachlich
// dichter), der Pfeil ist auf einen Blick eindeutiger. Deshalb entscheidet das
// jetzt die Nutzerin zur Laufzeit; das Env-Flag liefert nur noch den Startwert.
//
// Reine Logik, I/O-frei (CLAUDE.md-Konvention wie lib/navigation): Das Lesen
// und Schreiben des Speichers passiert in der Komponente, hier wird nur
// normalisiert — damit bleibt es ohne Browser testbar.

/** Darstellungsart der Windsymbole auf der Karte. */
export type WxSymbolWahl = "pfeil" | "fahne";

/** Speicher-Schlüssel (localStorage) für die getroffene Wahl. */
export const WX_SYMBOL_KEY = "jtc.wx-symbole";

/**
 * Macht aus einem gespeicherten Rohwert eine gültige Wahl.
 *
 * Alles Unbekannte (null, leer, Tippfehler, fremder Wert aus einer älteren
 * Version) fällt bewusst auf `fallback` zurück statt zu werfen — ein kaputter
 * localStorage-Eintrag darf die Karte nicht lahmlegen.
 *
 * @param raw      Rohwert aus dem Speicher (oder null, wenn nie gesetzt).
 * @param fallback Startwert, wenn nichts Gültiges gespeichert ist.
 */
export function normalisiereSymbolWahl(
  raw: string | null | undefined,
  fallback: WxSymbolWahl,
): WxSymbolWahl {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "pfeil" || v === "fahne") return v;
  return fallback;
}

/** Die jeweils andere Darstellung — für den Umschalter. */
export function andereWahl(wahl: WxSymbolWahl): WxSymbolWahl {
  return wahl === "fahne" ? "pfeil" : "fahne";
}

/** Beschriftung des Umschalters: was passiert BEIM KLICK (nicht der Ist-Zustand). */
export function umschaltBeschriftung(wahl: WxSymbolWahl): string {
  return wahl === "fahne" ? "Auf Pfeile umschalten" : "Auf Windfahnen umschalten";
}
