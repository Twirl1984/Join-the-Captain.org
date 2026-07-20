// Sprachumschaltung Deutsch/Englisch (REQ-I18N-001) — reine Logik.
//
// Bewusst OHNE Bibliothek: Das Projekt kommt mit wenigen Abhängigkeiten aus, und
// der Bedarf ist überschaubar (zwei Sprachen, flache Schlüssel). Eine eigene,
// I/O-freie Lösung bleibt offline testbar (CLAUDE.md-Konvention wie lib/weather,
// lib/navigation) und kostet kein Bundle-Gewicht auf einer Seite, die auf dem
// Boot über Mobilfunk geladen wird.
//
// WICHTIG — was hier NICHT übersetzt wird: Haftungs-, Impressums- und
// Datenschutztexte bleiben deutsch. Sie sind juristisch formuliert; eine
// maschinelle Übersetzung wäre ein Haftungsrisiko und keine Textaufgabe.
// Siehe docs/REQUIREMENTS.md REQ-I18N-001 und REQ-SAFE-002.

/** Unterstützte Sprachen. */
export type Sprache = "de" | "en";

/** Alle unterstützten Sprachen, Reihenfolge = Anzeigereihenfolge im Umschalter. */
export const SPRACHEN: readonly Sprache[] = ["de", "en"] as const;

/** Rückfallsprache: Deutsch ist die Originalsprache des Projekts. */
export const STANDARD_SPRACHE: Sprache = "de";

/** Cookie-Schlüssel für die gewählte Sprache. */
export const SPRACHE_COOKIE = "jtc.sprache";

/** Ein Wörterbuch: flache Schlüssel ("nav.berechnen") auf fertigen Text. */
export type Woerterbuch = Readonly<Record<string, string>>;

/**
 * Macht aus einem Rohwert (Cookie, Accept-Language-Kopfzeile, URL-Parameter)
 * eine gültige Sprache.
 *
 * Akzeptiert auch Regionalvarianten: "de-DE" und "en-GB" werden auf "de"/"en"
 * abgebildet, damit die Browser-Vorgabe direkt verwendbar ist. Alles Unbekannte
 * fällt auf `rueckfall` zurück statt zu werfen — eine kaputte Spracheinstellung
 * darf die Seite nicht lahmlegen.
 */
export function normalisiereSprache(
  roh: string | null | undefined,
  rueckfall: Sprache = STANDARD_SPRACHE,
): Sprache {
  const v = (roh ?? "").trim().toLowerCase();
  if (!v) return rueckfall;
  // "de-DE", "en_GB", "en-US,en;q=0.9" → erster Sprachcode vor Trenner
  const basis = v.split(/[,;]/)[0].split(/[-_]/)[0];
  return SPRACHEN.includes(basis as Sprache) ? (basis as Sprache) : rueckfall;
}

/**
 * Schlägt einen Text nach.
 *
 * Rückfallkette, damit nie eine leere Stelle in der Oberfläche steht:
 *   gewünschte Sprache → Standardsprache (Deutsch) → der Schlüssel selbst.
 * Ein fehlender englischer Text zeigt also den deutschen; fehlt er ganz, sieht
 * man den Schlüssel — sichtbar genug, um im Test aufzufallen, aber ohne Absturz.
 */
export function uebersetze(
  woerterbuecher: Readonly<Record<Sprache, Woerterbuch>>,
  schluessel: string,
  sprache: Sprache,
): string {
  return (
    woerterbuecher[sprache]?.[schluessel] ??
    woerterbuecher[STANDARD_SPRACHE]?.[schluessel] ??
    schluessel
  );
}

/**
 * Setzt Platzhalter der Form {name} ein.
 *
 * Getrennt vom Nachschlagen gehalten, damit beides einzeln testbar bleibt.
 * Unbekannte Platzhalter bleiben unangetastet stehen — so fällt ein Tippfehler
 * im Wörterbuch auf, statt still zu verschwinden.
 */
export function fuelle(vorlage: string, werte: Readonly<Record<string, string | number>>): string {
  return vorlage.replace(/\{(\w+)\}/g, (treffer, name: string) =>
    name in werte ? String(werte[name]) : treffer,
  );
}

/** Die jeweils andere Sprache — für den Umschalter. */
export function andereSprache(sprache: Sprache): Sprache {
  return sprache === "de" ? "en" : "de";
}

/** Anzeigename einer Sprache im Umschalter (immer in der Sprache selbst). */
export function spracheName(sprache: Sprache): string {
  return sprache === "de" ? "Deutsch" : "English";
}
