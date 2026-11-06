// karten.js — reine Kartenlogik: Filter, Tags, Nachbarn, Badge-Zähler.

export function tagsVon(karten) {
  return [...new Set(karten.map((k) => k.tag))];
}

/** Filtert nach Tag (exakt, "" = alle) und Suchtext (Titel/Tag/Intro, ohne Groß/Klein). */
export function filterKarten(karten, { tag = "", q = "" } = {}) {
  const s = q.trim().toLowerCase();
  return karten.filter((k) => (!tag || k.tag === tag) && (!s || `${k.title} ${k.tag} ${k.intro}`.toLowerCase().includes(s)));
}

/** Wie viele verschiedene Crewmitglieder haben die Karte schon gefahren? */
export function gefahrenAnzahl(kartenId, versuche, crew) {
  const ids = new Set(crew.map((p) => p.id));
  return new Set(versuche.filter((v) => v.karte === kartenId && ids.has(v.rudergaenger)).map((v) => v.rudergaenger)).size;
}

/** Vorherige/nächste Karte (zyklisch nein: an den Enden null). */
export function nachbarn(karten, id) {
  const i = karten.findIndex((k) => k.id === id);
  if (i < 0) return { zurueck: null, weiter: null };
  return { zurueck: karten[i - 1]?.id ?? null, weiter: karten[i + 1]?.id ?? null };
}

/** Alt-Text zu Bild i: stepCaptions[i] (Schritt-Nummer vorangestellt, wenn 1:1). */
export function bildAlt(karte, i) {
  const cap = karte.stepCaptions[i] ?? "";
  return karte.images.length === karte.steps.length ? `Schritt ${i + 1}: ${cap}` : cap;
}
