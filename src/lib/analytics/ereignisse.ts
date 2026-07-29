// Konversions-Ereignisse und UTM-Attribution (REQ-BIZ-001).
//
// Das ist das „Controlling", das die BayStartUP-Jury als existenzentscheidend
// bezeichnet hat (Phase-III-Feedback: „Führen Sie ein Controlling ein, um den
// Aufwand/Nutzen zu messen"). Ohne diese Ereignisse sehen wir Besucherzahlen,
// aber nie, ob aus Reichweite Nutzung wird — jeder Instagram-Post wäre ein
// Blindflug.
//
// Reine Logik, I/O-frei: Die Namen und die UTM-Bildung sind hier zentralisiert
// und testbar. Das Feuern selbst passiert über plausibleEvent() im Client.

/**
 * Die gemessenen Konversions-Ereignisse — EINE Quelle der Wahrheit.
 *
 * Reihenfolge = der Funnel: von „schaut sich um" bis „geht zur Buchung (.de)".
 * Jeder Name muss im Plausible-Dashboard als Ziel angelegt werden (siehe
 * docs/conversion-messung.md), sonst taucht er in den Zahlen nicht auf.
 */
export const EREIGNIS = {
  /** Nutzer hat eine Route über den Wasserweg berechnet — der erste echte Nutzen. */
  ROUTE_BERECHNET: "Route berechnet",
  /** Törn als Link geteilt — organische Reichweite, der billigste Kanal. */
  TOERN_GETEILT: "Törn geteilt",
  /** GPX exportiert — Zeichen ernsthafter Nutzung. */
  GPX_EXPORTIERT: "GPX exportiert",
  /** Preisseite gesehen (CTA geklickt). */
  PREISE_CTA: "Preise CTA",
  /** Klick auf „Zur Buchung" → join-the-captain.de. Die eigentliche Conversion. */
  BUCHUNG_GEKLICKT: "Buchung geklickt",
} as const;

export type Ereignis = (typeof EREIGNIS)[keyof typeof EREIGNIS];

/** Herkunft eines Buchungs-Klicks — damit wir sehen, WO im Funnel er passiert. */
export type BuchungHerkunft = "kopf" | "fuss" | "preise";

/**
 * UTM-Parameter, wie Plausible sie automatisch aus der URL liest.
 * `content`/`term` sind optional (Kampagnen-Feinheiten).
 */
export interface Utm {
  source: string; // z. B. "instagram", "youtube", "toern-share"
  medium: string; // z. B. "social", "reel", "story", "referral"
  campaign?: string; // z. B. "sommer-ostsee"
  content?: string;
  term?: string;
}

/**
 * Hängt UTM-Parameter an eine URL — für teilbare Links und Kampagnen.
 *
 * Bestehende Query-Parameter bleiben erhalten; vorhandene utm_* werden NICHT
 * überschrieben (ein von außen gesetztes utm gewinnt, damit ein geteilter Link,
 * der selbst schon aus einer Kampagne stammt, seine Herkunft behält).
 *
 * Fällt bei ungültiger URL auf die Eingabe zurück statt zu werfen — ein
 * kaputter Link darf das Teilen nicht verhindern.
 */
export function mitUtm(url: string, utm: Utm, basis = "https://join-the-captain.org"): string {
  let u: URL;
  try {
    u = new URL(url, basis);
  } catch {
    return url;
  }
  const setze = (schluessel: string, wert: string | undefined) => {
    if (wert && !u.searchParams.has(schluessel)) u.searchParams.set(schluessel, wert);
  };
  setze("utm_source", utm.source);
  setze("utm_medium", utm.medium);
  setze("utm_campaign", utm.campaign);
  setze("utm_content", utm.content);
  setze("utm_term", utm.term);
  return u.toString();
}
