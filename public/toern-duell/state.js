// state.js — Zustandsoperationen (rein, unveränderlich; keine I/O).
import { bewerteVersuch } from "./scoring.js";

export const VERSION = 1;
export const MAX_CREW = 11;
export const KARTEN = 15;
export const MAX_NAME = 40;

export function leererZustand() {
  return {
    version: VERSION,
    boot: "Akilina",
    crew: [],
    versuche: [],
    landgang: leererLandgang(),
    meta: { letztesBackup: null },
  };
}

export function leererLandgang() {
  return { seilziehen: [], muell: { platz1: null, platz2: null, platz3: null, skurril: null }, geocache: {} };
}

const ok = (state) => ({ state });
const fehler = (state, code) => ({ state, fehler: code });

function neuerId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function pruefeName(state, name, ausserId) {
  const n = String(name ?? "").trim();
  if (!n) return { fehler: "leer" };
  if (n.length > MAX_NAME) return { fehler: "zu-lang" };
  const low = n.toLowerCase();
  if (state.crew.some((p) => p.id !== ausserId && p.name.toLowerCase() === low)) return { fehler: "doppelt" };
  return { name: n };
}

export function addPerson(state, name, idFn = neuerId) {
  if (state.crew.length >= MAX_CREW) return fehler(state, "voll");
  const r = pruefeName(state, name);
  if (r.fehler) return fehler(state, r.fehler);
  return ok({ ...state, crew: [...state.crew, { id: idFn(), name: r.name }] });
}

export function renamePerson(state, id, name) {
  if (!state.crew.some((p) => p.id === id)) return fehler(state, "unbekannt");
  const r = pruefeName(state, name, id);
  if (r.fehler) return fehler(state, r.fehler);
  return ok({ ...state, crew: state.crew.map((p) => (p.id === id ? { ...p, name: r.name } : p)) });
}

/** Entfernt eine Person. Eigene Versuche entfallen; Bewertungen anderer bleiben (Bewerter → null). */
export function removePerson(state, id) {
  const l = state.landgang;
  const nullen = (x) => (x === id ? null : x);
  const geocache = { ...l.geocache };
  delete geocache[id];
  return {
    ...state,
    crew: state.crew.filter((p) => p.id !== id),
    versuche: state.versuche.filter((v) => v.rudergaenger !== id).map((v) => (v.bewerter === id ? { ...v, bewerter: null } : v)),
    landgang: {
      seilziehen: l.seilziehen.map((r) => ({ ...r, gewinner: nullen(r.gewinner) })),
      muell: {
        platz1: nullen(l.muell.platz1),
        platz2: nullen(l.muell.platz2),
        platz3: nullen(l.muell.platz3),
        skurril: l.muell.skurril?.person === id ? null : l.muell.skurril,
      },
      geocache,
    },
  };
}

function pruefeVersuch(state, v, bisher) {
  if (!Number.isInteger(v.karte) || v.karte < 1 || v.karte > KARTEN) return "karte";
  const ids = new Set(state.crew.map((p) => p.id));
  if (!ids.has(v.rudergaenger)) return "person";
  const bewerterUnveraendert = bisher && bisher.bewerter === v.bewerter;
  if (!ids.has(v.bewerter) && !(v.bewerter === null && bewerterUnveraendert)) return "person";
  if (v.bewerter === v.rudergaenger) return "selbst-bewertung";
  try {
    bewerteVersuch(v);
  } catch {
    return "bewertung";
  }
  return null;
}

export function addVersuch(state, eingabe, idFn = neuerId) {
  const v = { notiz: "", ...eingabe, id: idFn() };
  const f = pruefeVersuch(state, v, null);
  if (f) return fehler(state, f);
  return ok({ ...state, versuche: [...state.versuche, v] });
}

export function updateVersuch(state, id, patch) {
  const alt = state.versuche.find((v) => v.id === id);
  if (!alt) return fehler(state, "unbekannt");
  const neu = { ...alt, ...patch, id };
  const f = pruefeVersuch(state, neu, alt);
  if (f) return fehler(state, f);
  return ok({ ...state, versuche: state.versuche.map((v) => (v.id === id ? neu : v)) });
}

export function deleteVersuch(state, id) {
  return { ...state, versuche: state.versuche.filter((v) => v.id !== id) };
}

// ── Landgang ────────────────────────────────────────────────────────────────
const mitLandgang = (state, patch) => ({ ...state, landgang: { ...state.landgang, ...patch } });

export function addSeilziehenRunde(state, gewinnerId) {
  return mitLandgang(state, { seilziehen: [...state.landgang.seilziehen, { gewinner: gewinnerId ?? null }] });
}

export function removeSeilziehenRunde(state, index) {
  return mitLandgang(state, { seilziehen: state.landgang.seilziehen.filter((_, i) => i !== index) });
}

/** Müll-Platz 1–3 setzen; eine Person belegt höchstens einen Platz. personId=null leert den Platz. */
export function setMuellPlatz(state, platz, personId) {
  const m = { ...state.landgang.muell };
  if (personId) for (const k of ["platz1", "platz2", "platz3"]) if (m[k] === personId) m[k] = null;
  m[`platz${platz}`] = personId ?? null;
  return mitLandgang(state, { muell: m });
}

export function setSkurril(state, personId, fund) {
  const text = String(fund ?? "").trim();
  const skurril = personId && text ? { person: personId, fund: text } : null;
  return mitLandgang(state, { muell: { ...state.landgang.muell, skurril } });
}

export function changeGeocache(state, personId, delta) {
  const neu = Math.max(0, (state.landgang.geocache[personId] ?? 0) + delta);
  return mitLandgang(state, { geocache: { ...state.landgang.geocache, [personId]: neu } });
}
