// karte.js (View) — eine Manöverkarte: Intro, Schritte mit Bildern, Fehlerhinweis, Navigation.
import { h } from "../dom.js";
import { bildAlt, nachbarn } from "../karten.js";
import { hashFuer } from "../router.js";
import { zeigeZoom } from "./zoom.js";

const bild = (karte, i) => {
  const alt = bildAlt(karte, i);
  return h("button", { type: "button", class: "bildknopf", "aria-label": `${alt} – Vollbild`, onclick: () => zeigeZoom(karte.images[i], alt) },
    h("img", { src: karte.images[i], alt, loading: "lazy", class: karte.images.length === karte.steps.length ? "bild" : "bild bild--gross" }));
};

export function karteView({ karten, id }) {
  const karte = karten.find((k) => k.id === id);
  if (!karte) return h("section", {}, h("h1", {}, "Karte nicht gefunden"), h("a", { class: "knopf", href: "#/karten" }, "Zur Kartenliste"));
  const einzel = karte.images.length === karte.steps.length;
  const schritte = karte.steps.map((text, i) =>
    h("li", { class: "schritt" },
      h("span", { class: "schritt__nr", "aria-hidden": "true" }, i + 1),
      h("div", {}, h("p", {}, text), einzel ? bild(karte, i) : null)));
  const n = nachbarn(karten, id);
  const nav = (ziel, text) => (ziel ? h("a", { class: "knopf knopf--hell", href: hashFuer("karte", ziel) }, text) : h("span", { class: "knopf knopf--aus", "aria-disabled": "true" }, text));
  return h("article", { "data-testid": "kartenansicht" },
    h("p", {}, h("a", { href: "#/karten", class: "zurueck" }, "‹ Alle Karten")),
    h("h1", {}, `${karte.id}. ${karte.title}`), h("span", { class: "chip" }, karte.tag),
    h("p", { class: "intro" }, karte.intro),
    h("ol", { class: "schritte" }, schritte),
    einzel ? null : h("div", { class: "bilder" }, karte.images.map((_, i) => bild(karte, i))),
    h("aside", { class: "fehler", "data-testid": "fehlerhinweis" }, h("strong", {}, "Typische Fehler: "), karte.error),
    h("a", { class: "knopf knopf--gold", href: hashFuer("bewertung", null, { karte: String(karte.id) }), "data-testid": "jetzt-bewerten" }, "Jetzt bewerten"),
    h("div", { class: "nachbarn" }, nav(n.zurueck, "‹ Zurück"), nav(n.weiter, "Weiter ›")));
}
