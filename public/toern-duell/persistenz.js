// persistenz.js — Orchestrierung der Speicherorte (rein/injizierbar): welcher Stand gewinnt, wohin wird geschrieben.
// Orte: IndexedDB (Stand + Verlauf) UND localStorage (Stand + Backup) – zwei unabhängige Kopien.
import { auswerten } from "./store.js";
import { leererZustand } from "./state.js";

const PRIO = { idb: 0, ls: 1, "ls-backup": 2, "idb-verlauf": 3 };
const BACKUP_QUELLEN = new Set(["ls-backup", "idb-verlauf"]);

/**
 * Wählt den besten Stand aus allen Kandidaten {quelle, roh}.
 * Regel: höchste Revision (meta.rev) unter den GÜLTIGEN gewinnt; bei Gleichstand IndexedDB vor localStorage vor Backups.
 * warnung: null | "backup" (nur ein Backup war brauchbar) | "migriert" | "reset" | "zu-neu".
 * Eine neuere Datenversion wird nie überschrieben genutzt: Rohdaten kommen in `defekt` (Aufrufer sichert sie).
 */
export function waehleBesten(kandidaten) {
  if (!kandidaten.length) return { state: leererZustand(), warnung: null, quelle: null, defekt: [] };
  const gueltig = [], defekt = [];
  let zuNeu = false;
  for (const k of kandidaten) {
    const r = auswerten(k.roh);
    if (r.art === "ok" || r.art === "migriert") gueltig.push({ ...k, state: r.state, migriert: r.art === "migriert", rev: r.state.meta?.rev ?? 0 });
    else { if (r.art === "zu-neu") zuNeu = true; defekt.push(k.roh); }
  }
  if (zuNeu) return { state: leererZustand(), warnung: "zu-neu", quelle: null, defekt };
  if (!gueltig.length) return { state: leererZustand(), warnung: "reset", quelle: null, defekt };
  gueltig.sort((a, b) => b.rev - a.rev || PRIO[a.quelle] - PRIO[b.quelle]);
  const best = gueltig[0];
  const warnung = BACKUP_QUELLEN.has(best.quelle) ? "backup" : best.migriert ? "migriert" : null;
  return { state: best.state, warnung, quelle: best.quelle, defekt };
}

/**
 * Liest alle Orte. leser = { idb: async () => ({aktuell, verlauf[]}) | null, ls: () => ({haupt, backup}) | null }.
 * Ein ausgefallener Ort (wirft/null) ist kein Fehler, solange ein anderer liefert.
 */
export async function ladenAlle(leser) {
  const kandidaten = [];
  const orte = { idb: false, ls: false };
  try {
    const x = await leser.idb?.();
    if (x) {
      orte.idb = true;
      if (x.aktuell) kandidaten.push({ quelle: "idb", roh: x.aktuell });
      for (const roh of x.verlauf ?? []) kandidaten.push({ quelle: "idb-verlauf", roh });
    }
  } catch { /* IndexedDB ausgefallen */ }
  try {
    const x = leser.ls?.();
    if (x) {
      orte.ls = true;
      if (x.haupt) kandidaten.push({ quelle: "ls", roh: x.haupt });
      if (x.backup) kandidaten.push({ quelle: "ls-backup", roh: x.backup });
    }
  } catch { /* localStorage ausgefallen */ }
  const r = waehleBesten(kandidaten);
  if (!orte.idb && !orte.ls) return { ...r, warnung: "kein-speicher", orte };
  return { ...r, orte };
}

/**
 * Schreibt in beide Orte. schreiber = { idb: async (state)=>({ok,fehler}) | null, ls: (state)=>({ok,fehler}) | null }.
 * ok = mindestens ein Ort hat verifiziert gespeichert; orte zeigt, welche.
 */
export async function speichernAlle(schreiber, state) {
  const lauf = async (f) => {
    if (!f) return { ok: false, fehler: "nicht verfügbar" };
    try { return (await f(state)) ?? { ok: false, fehler: "keine Antwort" }; } catch (e) { return { ok: false, fehler: String(e?.message ?? e) }; }
  };
  const [idb, ls] = await Promise.all([lauf(schreiber.idb), lauf(schreiber.ls)]);
  const fehler = [!idb.ok && `IndexedDB: ${idb.fehler}`, !ls.ok && `Browser-Speicher: ${ls.fehler}`].filter(Boolean).join(" · ");
  return { ok: idb.ok || ls.ok, orte: { idb: idb.ok, ls: ls.ok }, fehler };
}
