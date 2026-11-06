// app.js — Start, Zustand, Routing, Speichern, Meldungen.
import { h } from "./dom.js";
import { parseHash } from "./router.js";
import { laden, speichern, persistenzAnfordern } from "./store.js";
import { startView } from "./views/start.js";
import { kartenView } from "./views/karten.js";
import { karteView } from "./views/karte.js";
import { bewertungView } from "./views/bewertung.js";
import { landgangView } from "./views/landgang.js";
import { ranglisteView } from "./views/rangliste.js";

const WARNUNGEN = {
  backup: "Der Hauptstand war beschädigt – das letzte Backup wurde geladen.",
  migriert: "Daten einer älteren Version wurden übernommen.",
  reset: "Gespeicherte Daten waren unlesbar und wurden zurückgesetzt. Die Rohdaten bleiben im Browser erhalten.",
  "zu-neu": "Die gespeicherten Daten stammen aus einer neueren App-Version und wurden nicht verändert.",
  "kein-speicher": "Der Browser-Speicher ist nicht verfügbar. Änderungen gehen beim Schließen verloren – bitte regelmäßig exportieren.",
};

const jetzt = () => Date.now();
const speicher = (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })();
const geladen = laden(speicher, jetzt);
let state = geladen.state;
let karten = [];
const ansicht = { tag: "", q: "" };
const meldungsFeld = document.getElementById("meldungen");
const haupt = document.getElementById("app");

function melde(text, art = "warn") {
  meldungsFeld.replaceChildren(text ? h("p", { class: `banner banner--${art}`, role: art === "warn" ? "alert" : "status", "data-testid": "banner" }, text) : "");
}

/** Wendet eine reine Zustandsoperation an, speichert sofort, rendert neu. Gibt den Fehlercode zurück. */
function dispatch(op) {
  const r = op(state);
  const neu = r && "state" in r ? r.state : r;
  const fehler = r && "fehler" in r ? r.fehler : undefined;
  if (fehler) return fehler;
  state = neu;
  const s = speichern(speicher, state, jetzt);
  melde(s.ok ? "" : `Speichern fehlgeschlagen: ${s.fehler}. Bitte jetzt ein Backup exportieren!`);
  render();
  return undefined;
}

function render() {
  const route = parseHash(location.hash);
  const ctx = { state, dispatch, melde, jetzt, karten, ansicht, id: route.id, query: route.query };
  const views = { start: startView, karten: kartenView, karte: karteView, bewertung: bewertungView, landgang: landgangView, rangliste: ranglisteView };
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
  if (geladen.warnung) melde(WARNUNGEN[geladen.warnung]);
  if (geladen.warnung === "migriert" || geladen.warnung === "backup") speichern(speicher, state, jetzt);
  render();
  persistenzAnfordern();
}
start();
