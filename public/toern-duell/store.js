// store.js — Persistenz (localStorage injizierbar), Migration, Export/Import.
// Priorität: Daten dürfen nie still verloren gehen (REQ-DUEL-003).
import { bewerteVersuch } from "./scoring.js";
import { VERSION, MAX_CREW, KARTEN, leererZustand, leererLandgang } from "./state.js";

export const KEY = "jtc.duell.v1";
export const BACKUP_KEY = `${KEY}.backup`;
const DEFEKT_KEY = `${KEY}.defekt`;
const APP = "toern-duell";
const TAG_MS = 86_400_000;

const istObjekt = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** Strukturprüfung eines Zustands (nach Migration). */
export function istGueltig(s) {
  if (!istObjekt(s) || s.version !== VERSION || typeof s.boot !== "string") return false;
  if (!Array.isArray(s.crew) || s.crew.length > MAX_CREW) return false;
  const ids = new Set();
  for (const p of s.crew) {
    if (!istObjekt(p) || typeof p.id !== "string" || typeof p.name !== "string" || !p.name.trim() || ids.has(p.id)) return false;
    ids.add(p.id);
  }
  if (!Array.isArray(s.versuche)) return false;
  for (const v of s.versuche) {
    if (!istObjekt(v) || typeof v.id !== "string" || !Number.isInteger(v.karte) || v.karte < 1 || v.karte > KARTEN) return false;
    if (!ids.has(v.rudergaenger) || !(v.bewerter === null || ids.has(v.bewerter))) return false;
    try { bewerteVersuch(v); } catch { return false; }
  }
  const l = s.landgang;
  if (!istObjekt(l) || !Array.isArray(l.seilziehen) || !istObjekt(l.muell) || !istObjekt(l.geocache)) return false;
  return istObjekt(s.meta);
}

/** → {art:"ok"|"migriert"|"zu-neu"|"kaputt", state?} */
export function auswerten(roh) {
  let obj;
  try { obj = JSON.parse(roh); } catch { return { art: "kaputt" }; }
  if (!istObjekt(obj)) return { art: "kaputt" };
  if (typeof obj.version === "number" && obj.version > VERSION) return { art: "zu-neu" };
  if (obj.version === VERSION) return istGueltig(obj) ? { art: "ok", state: obj } : { art: "kaputt" };
  if (obj.version === undefined || obj.version === 0) {
    const m = { ...leererZustand(), ...obj, version: VERSION, landgang: { ...leererLandgang(), ...(obj.landgang ?? {}) }, meta: { letztesBackup: null, ...(obj.meta ?? {}) } };
    return istGueltig(m) ? { art: "migriert", state: m } : { art: "kaputt" };
  }
  return { art: "kaputt" };
}

function sichereDefekt(storage, roh) {
  try { storage.setItem(DEFEKT_KEY, roh); } catch { /* Speicher voll: Warnung reicht */ }
}

/** Lädt den Zustand. warnung: null | "backup" | "migriert" | "reset" | "zu-neu" | "kein-speicher". */
export function laden(storage, _now = Date.now) {
  let roh, backup;
  try {
    roh = storage.getItem(KEY);
    backup = storage.getItem(BACKUP_KEY);
  } catch {
    return { state: leererZustand(), warnung: "kein-speicher" };
  }
  if (roh === null && backup === null) return { state: leererZustand(), warnung: null };

  if (roh !== null) {
    const h = auswerten(roh);
    if (h.art === "ok") return { state: h.state, warnung: null };
    if (h.art === "migriert") return { state: h.state, warnung: "migriert" };
    if (h.art === "zu-neu") {
      sichereDefekt(storage, roh);
      return { state: leererZustand(), warnung: "zu-neu" };
    }
  }
  const b = backup === null ? { art: "kaputt" } : auswerten(backup);
  if (b.art === "ok" || b.art === "migriert") return { state: b.state, warnung: "backup" };
  if (roh !== null) sichereDefekt(storage, roh);
  return { state: leererZustand(), warnung: "reset" };
}

/** Speichert mit Rolling-Backup und Verify-nach-Schreiben. → {ok} | {ok:false, fehler} */
export function speichern(storage, state, _now = Date.now) {
  if (!storage) return { ok: false, fehler: "Kein Speicher verfügbar" };
  try {
    const json = JSON.stringify(state);
    const vorher = storage.getItem(KEY);
    if (vorher !== null && auswerten(vorher).art === "ok") storage.setItem(BACKUP_KEY, vorher);
    storage.setItem(KEY, json);
    if (storage.getItem(KEY) !== json) return { ok: false, fehler: "Verifizierung fehlgeschlagen: gespeicherte Daten weichen ab" };
    return { ok: true };
  } catch (e) {
    return { ok: false, fehler: `${e?.name ?? "Fehler"}: ${e?.message ?? e}` };
  }
}

/** Fordert dauerhaften Speicher an (schützt vor Eviction, v. a. iOS Safari). */
export async function persistenzAnfordern(storageManager = globalThis.navigator?.storage) {
  try {
    if (!storageManager?.persist) return false;
    return (await storageManager.persisted?.()) || (await storageManager.persist());
  } catch {
    return false;
  }
}

export function markiereBackup(state, now = Date.now) {
  return { ...state, meta: { ...state.meta, letztesBackup: now() } };
}

export function backupAlterTage(state, now = Date.now) {
  const t = state.meta?.letztesBackup;
  return typeof t === "number" ? Math.floor((now() - t) / TAG_MS) : null;
}

export function exportJson(state, now = Date.now) {
  return JSON.stringify({ app: APP, exportVersion: 1, exportiert: now(), daten: state }, null, 2);
}

/** → {ok:true, state} | {ok:false, fehler} */
export function importJson(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, fehler: "Datei ist kein gültiges JSON" }; }
  if (!istObjekt(obj) || obj.app !== APP) return { ok: false, fehler: "Datei stammt nicht aus dem Törn-Manöver-Duell" };
  const r = auswerten(JSON.stringify(obj.daten ?? null));
  if (r.art === "zu-neu") return { ok: false, fehler: "Backup stammt aus einer neueren App-Version" };
  if (r.art === "kaputt") return { ok: false, fehler: "Backup ist beschädigt oder ungültig (z. B. mehr als 11 Personen)" };
  return { ok: true, state: r.state };
}

export function dateiname(art) {
  return { backup: "toern-duell-backup.json", rangliste: "toern-duell-rangliste.csv", bewertungen: "toern-duell-bewertungen.csv", ueberblick: "toern-duell-ueberblick.html" }[art];
}
