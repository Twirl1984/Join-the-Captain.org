// Interesse am App-Start vormerken (REQ-EXP-012) — reine Logik.
//
// Vor dem Launch ist eine Liste von Interessenten die einzige Währung: Wer
// heute die Planung im Browser ausprobiert, soll erfahren können, wann die App
// erscheint.
//
// ACHTUNG — DATENSCHUTZ (der Grund, warum das hier anders aussieht als der Rest
// des Projekts): Dies ist die erste Stelle, an der personenbezogene Daten
// erhoben werden. Deshalb gilt:
//   1. Das Feature ist standardmäßig AUS (siehe flags.ts). Alle anderen Flags
//      im Projekt sind Default AN — hier ist die Umkehrung Absicht.
//   2. Es darf erst eingeschaltet werden, wenn die Datenschutzerklärung diese
//      Verarbeitung abdeckt (Zweck, Rechtsgrundlage, Speicherdauer, Löschung).
//      Diesen Text schreibt ein Mensch, kein Agent.
//   3. Gespeichert wird das Minimum: E-Mail, Sprache, Zeitpunkt der
//      Einwilligung. Kein Name, keine IP, kein Tracking.
// Siehe docs/REQUIREMENTS.md REQ-EXP-012.

/** Ergebnis der Prüfung einer eingegebenen Adresse. */
export type AdressPruefung =
  | { gueltig: true; adresse: string }
  | { gueltig: false; grund: "leer" | "format" | "zu_lang" };

/** Obergrenze nach RFC 5321 — schützt die Spalte und gegen Unsinn. */
export const MAX_LAENGE = 254;

/**
 * Prüft und normalisiert eine E-Mail-Adresse.
 *
 * Bewusst KEINE ausgefeilte Regex: Die einzige verlässliche Prüfung ist eine
 * Bestätigungsmail. Hier wird nur offensichtlicher Unsinn abgefangen, damit die
 * Liste nicht vermüllt — und die Adresse vereinheitlicht, damit derselbe Mensch
 * nicht dreimal darin steht.
 */
export function pruefeAdresse(roh: string | null | undefined): AdressPruefung {
  const wert = (roh ?? "").trim().toLowerCase();
  if (!wert) return { gueltig: false, grund: "leer" };
  if (wert.length > MAX_LAENGE) return { gueltig: false, grund: "zu_lang" };
  // Genau ein @, davor und dahinter etwas, im Domänenteil ein Punkt mit
  // mindestens zwei Zeichen dahinter, nirgends ein Leerzeichen.
  const passt = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wert);
  return passt ? { gueltig: true, adresse: wert } : { gueltig: false, grund: "format" };
}

/**
 * Zwei Adressen gehören zur selben Person?
 *
 * Nur Normalisierung, bewusst KEIN Entfernen von Punkten oder Plus-Adressen:
 * Ob `a.b@gmail.com` und `ab@gmail.com` dieselbe Person sind, hängt vom Anbieter
 * ab. Zu clever zu sein hieße, jemandem eine gewollte zweite Anmeldung zu
 * verweigern.
 */
export function istGleicheAdresse(a: string, b: string): boolean {
  const n = (s: string) => s.trim().toLowerCase();
  return n(a) === n(b);
}
