// entwurf.js — Formularlogik der Bewertung (rein): Entwurf, Vorschau, Prüfung.
import { KATEGORIEN, bewerteVersuch } from "./scoring.js";
import { KARTEN } from "./state.js";

/** Neuer Entwurf; Karte aus der URL (?karte=N), sonst leer. */
export function neuerEntwurf(karteId) {
  const k = Number(karteId);
  return { karte: Number.isInteger(k) && k >= 1 && k <= KARTEN ? k : null, rudergaenger: "", bewerter: "", selbst: {}, fremd: {}, notiz: "" };
}

export function entwurfAusVersuch(v) {
  return { karte: v.karte, rudergaenger: v.rudergaenger, bewerter: v.bewerter ?? "", selbst: { ...v.selbst }, fremd: { ...v.fremd }, notiz: v.notiz ?? "" };
}

export function entwurfAlsVersuch(e) {
  return { karte: e.karte, rudergaenger: e.rudergaenger, bewerter: e.bewerter, selbst: { ...e.selbst }, fremd: { ...e.fremd }, notiz: e.notiz.trim() };
}

const alleGesetzt = (w) => KATEGORIEN.every((k) => Number.isInteger(w[k]));

/** Live-Anzeige: null, solange nicht alle sechs Werte gesetzt sind. */
export function vorschau(e) {
  return alleGesetzt(e.selbst) && alleGesetzt(e.fremd) ? bewerteVersuch(e) : null;
}

/** Fehlercode oder null, wenn speicherbar. */
export function entwurfFehler(e) {
  if (!e.karte) return "karte";
  if (!e.rudergaenger) return "rudergaenger";
  if (!e.bewerter) return "bewerter";
  if (e.bewerter === e.rudergaenger) return "selbst-bewertung";
  if (!vorschau(e)) return "unvollstaendig";
  return null;
}

/** Bewerter-Auswahl: alle außer dem Rudergänger. */
export const bewerterOptionen = (crew, rudergaengerId) => crew.filter((p) => p.id !== rudergaengerId);
