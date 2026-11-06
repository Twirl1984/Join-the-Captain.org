// karten.js (View) — Kachelliste mit Suche, Tag-Filter und Badge.
import { h } from "../dom.js";
import { filterKarten, gefahrenAnzahl, tagsVon } from "../karten.js";
import { hashFuer } from "../router.js";

export function kartenView({ karten, state, ansicht }) {
  const liste = h("ul", { class: "kacheln", "data-testid": "kartenliste" });
  const leer = h("p", { class: "hinweis", hidden: true }, "Keine Karte gefunden.");
  const zeichne = () => {
    const treffer = filterKarten(karten, ansicht);
    liste.replaceChildren(
      ...treffer.map((k) => {
        const n = gefahrenAnzahl(k.id, state.versuche, state.crew);
        return h("li", {},
          h("a", { class: "kachel", href: hashFuer("karte", k.id), "data-testid": `karte-${k.id}` },
            h("span", { class: "kachel__nr" }, k.id),
            h("span", { class: "kachel__titel" }, k.title),
            h("span", { class: "chip" }, k.tag),
            h("span", { class: "badge", "aria-label": `${n} von ${state.crew.length} gefahren`, "data-testid": `badge-${k.id}` }, `${n}/${state.crew.length}`)));
      }),
    );
    leer.hidden = treffer.length > 0;
  };
  const suche = h("input", {
    type: "search", id: "suche", class: "feld", placeholder: "Karte suchen …", value: ansicht.q, autocomplete: "off",
    "data-testid": "karten-suche",
    oninput: (e) => { ansicht.q = e.target.value; zeichne(); },
  });
  const chips = ["", ...tagsVon(karten)].map((t) =>
    h("button", {
      type: "button", class: "chip chip--btn", "aria-pressed": String(ansicht.tag === t), "data-tag": t,
      onclick: (e) => {
        ansicht.tag = t;
        chips.forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget)));
        zeichne();
      },
    }, t || "Alle"));
  zeichne();
  return h("section", {}, h("h1", {}, "Manöverkarten"),
    h("label", { class: "sr-only", for: "suche" }, "Suche"), suche,
    h("div", { class: "chips", role: "group", "aria-label": "Nach Bereich filtern" }, chips),
    liste, leer);
}
