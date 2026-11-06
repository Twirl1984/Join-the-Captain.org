// idb.js — IndexedDB-Backend: aktueller Stand + Verlauf (Snapshot je Änderung), transaktional.
// Stores: "stand" {id:"aktuell", roh, rev, zeit} · "verlauf" {rev, zeit, roh} (letzte MAX_VERLAUF).
export const DB_NAME = "jtc-duell";
export const MAX_VERLAUF = 40;

export function oeffnen(factory = globalThis.indexedDB) {
  return new Promise((ok, fehler) => {
    if (!factory) return fehler(new Error("IndexedDB nicht verfügbar"));
    let req;
    try { req = factory.open(DB_NAME, 1); } catch (e) { return fehler(e); }
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("stand", { keyPath: "id" });
      db.createObjectStore("verlauf", { keyPath: "rev" });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fehler(req.error ?? new Error("IndexedDB-Fehler"));
    req.onblocked = () => fehler(new Error("IndexedDB blockiert"));
  });
}

const anfrage = (req) => new Promise((ok, fehler) => { req.onsuccess = () => ok(req.result); req.onerror = () => fehler(req.error); });
const fertig = (tx) => new Promise((ok, fehler) => { tx.oncomplete = () => ok(); tx.onerror = () => fehler(tx.error); tx.onabort = () => fehler(tx.error ?? new Error("Transaktion abgebrochen")); });

/** Schreibt Stand + Snapshot in EINER Transaktion, kürzt den Verlauf und verifiziert per Rücklesen. */
export async function speichern(db, state, jetzt = Date.now) {
  try {
    const roh = JSON.stringify(state);
    const rev = state.meta?.rev ?? 0;
    const tx = db.transaction(["stand", "verlauf"], "readwrite");
    tx.objectStore("stand").put({ id: "aktuell", roh, rev, zeit: jetzt() });
    const verlauf = tx.objectStore("verlauf");
    verlauf.put({ rev, zeit: jetzt(), roh });
    const keys = await anfrage(verlauf.getAllKeys());
    for (const k of keys.sort((a, b) => a - b).slice(0, Math.max(0, keys.length - MAX_VERLAUF))) verlauf.delete(k);
    await fertig(tx);
    const zurueck = await anfrage(db.transaction("stand").objectStore("stand").get("aktuell"));
    if (zurueck?.roh !== roh) return { ok: false, fehler: "IndexedDB-Verifizierung fehlgeschlagen: Daten weichen ab" };
    return { ok: true };
  } catch (e) {
    return { ok: false, fehler: `${e?.name ?? "Fehler"}: ${e?.message ?? e}` };
  }
}

/** → {aktuell: roh|null, verlauf: [roh …] (neueste zuerst)} */
export async function lesen(db, anzahl = 5) {
  const aktuell = await anfrage(db.transaction("stand").objectStore("stand").get("aktuell"));
  const alle = await anfrage(db.transaction("verlauf").objectStore("verlauf").getAll());
  alle.sort((a, b) => b.rev - a.rev);
  return { aktuell: aktuell?.roh ?? null, verlauf: alle.slice(0, anzahl).map((e) => e.roh) };
}

/** Verlaufseinträge für die Wiederherstellung: {rev, zeit, roh}, neueste zuerst. */
export async function verlaufListe(db) {
  const alle = await anfrage(db.transaction("verlauf").objectStore("verlauf").getAll());
  return alle.sort((a, b) => b.rev - a.rev);
}
