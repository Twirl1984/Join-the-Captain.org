// app.js — Start, Zustand, Routing, Speichern (IndexedDB + localStorage), Meldungen.
import { h } from "./dom.js";
import { parseHash } from "./router.js";
import { KEY, BACKUP_KEY, speichern as lsSpeichern, persistenzAnfordern } from "./store.js";
import { leererZustand } from "./state.js";
import * as Idb from "./idb.js";
import { ladenAlle, speichernAlle } from "./persistenz.js";
import { startView } from "./views/start.js";
import { kartenView } from "./views/karten.js";
import { karteView } from "./views/karte.js";
import { bewertungView } from "./views/bewertung.js";
import { landgangView } from "./views/landgang.js";
import { ranglisteView } from "./views/rangliste.js";
import { ueberblickView } from "./views/ueberblick.js";

const WARNUNGEN = {
  backup: "Der Hauptstand war beschädigt – ein früherer Stand wurde geladen.",
  migriert: "Daten einer älteren Version wurden übernommen.",
  reset: "Gespeicherte Daten waren unlesbar und wurden zurückgesetzt. Die Rohdaten bleiben im Browser erhalten.",
  "zu-neu": "Die gespeicherten Daten stammen aus einer neueren App-Version. Die Rohdaten bleiben erhalten.",
  "kein-speicher": "Der Browser-Speicher ist nicht verfügbar. Änderungen gehen beim Schließen verloren – bitte regelmäßig exportieren.",
};

const jetzt = () => Date.now();
const speicher = (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })();
let idb = null;
let state = leererZustand();
let karten = [];
let schreibKette = Promise.resolve(); // Schreibvorgänge strikt nacheinander
const ansicht = { tag: "", q: "" };
const speicherStatus = { idb: null, ls: null, fehler: "" };
const meldungsFeld = document.getElementById("meldungen");
const haupt = document.getElementById("app");

function melde(text, art = "warn") {
  meldungsFeld.replaceChildren(text ? h("p", { class: `banner banner--${art}`, role: art === "warn" ? "alert" : "status", "data-testid": "banner" }, text) : "");
}

/** Schreibt den Stand in beide Orte (nacheinander in der Kette); meldet nur, wenn gar nichts gespeichert wurde. */
function sichern(snapshot) {
  const schreiber = {
    idb: idb ? (s) => Idb.speichern(idb, s, jetzt) : null,
    ls: speicher ? (s) => lsSpeichern(speicher, s, jetzt) : null,
  };
  schreibKette = schreibKette.then(async () => {
    const r = await speichernAlle(schreiber, snapshot);
    Object.assign(speicherStatus, { idb: r.orte.idb, ls: r.orte.ls, fehler: r.fehler });
    if (!r.ok) melde(`Speichern fehlgeschlagen (${r.fehler}). Bitte jetzt ein Backup exportieren!`);
    else if (r.fehler) melde("");
    document.documentElement.dataset.gespeichert = String(snapshot.meta?.rev ?? 0);
  });
  return schreibKette;
}

/** Wendet eine reine Zustandsoperation an, speichert sofort, rendert neu. Gibt den Fehlercode zurück. */
function dispatch(op) {
  const r = op(state);
  const neu = r && "state" in r ? r.state : r;
  const fehler = r && "fehler" in r ? r.fehler : undefined;
  if (fehler) return fehler;
  const rev = Math.max(state.meta?.rev ?? 0, neu.meta?.rev ?? 0) + 1;
  state = { ...neu, meta: { ...neu.meta, rev } };
  sichern(state);
  melde("");
  render();
  return undefined;
}

function render() {
  const route = parseHash(location.hash);
  const ctx = {
    state, dispatch, melde, jetzt, karten, ansicht, id: route.id, query: route.query, speicherStatus,
    verlaufLaden: () => (idb ? Idb.verlaufListe(idb).catch(() => []) : Promise.resolve([])),
  };
  const views = { start: startView, karten: kartenView, karte: karteView, bewertung: bewertungView, landgang: landgangView, rangliste: ranglisteView, ueberblick: ueberblickView };
  const fokusId = document.activeElement?.id;
  haupt.replaceChildren(views[route.name](ctx));
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const aktiv = a.dataset.nav === (route.name === "karte" ? "karten" : route.name);
    a.toggleAttribute("aria-current", aktiv);
    if (aktiv) a.setAttribute("aria-current", "page");
  });
  document.title = `${state.boot} – Törn-Manöver-Duell`;
  if (fokusId) document.getElementById(fokusId)?.focus();
}

let letzteRoute = "";
addEventListener("hashchange", () => {
  const name = parseHash(location.hash).name;
  render();
  if (name !== letzteRoute) scrollTo(0, 0);
  letzteRoute = name;
});

async function start() {
  try {
    const antwort = await fetch("cards.json");
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    karten = await antwort.json();
  } catch (e) {
    haupt.replaceChildren(h("p", { class: "banner banner--warn", role: "alert" }, `Karten konnten nicht geladen werden (${e.message}). Bitte die App einmal mit Internet öffnen.`));
    return;
  }
  idb = await Idb.oeffnen().catch(() => null);
  const geladen = await ladenAlle({
    idb: idb ? () => Idb.lesen(idb) : null,
    ls: speicher ? () => ({ haupt: speicher.getItem(KEY), backup: speicher.getItem(BACKUP_KEY) }) : null,
  });
  state = geladen.state;
  if (geladen.defekt?.length && speicher) { try { speicher.setItem(`${KEY}.defekt`, JSON.stringify([...new Set(geladen.defekt)].slice(0, 4))); } catch { /* voll */ } }
  if (geladen.warnung) melde(WARNUNGEN[geladen.warnung]);
  if (["migriert", "backup", "zu-neu", "reset"].includes(geladen.warnung)) sichern(state);
  else if (geladen.quelle) { speicherStatus.idb = geladen.orte.idb; speicherStatus.ls = geladen.orte.ls; document.documentElement.dataset.gespeichert = String(state.meta?.rev ?? 0); }
  render();
  persistenzAnfordern();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});
}
start();
