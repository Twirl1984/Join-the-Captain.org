// landgang.js (View) — Seilziehen, Müllsammeln, Geocaching.
import { h } from "../dom.js";
import { PUNKTE, landgangPunkte } from "../scoring.js";
import { addSeilziehenRunde, changeGeocache, removeSeilziehenRunde, setMuellPlatz, setSkurril } from "../state.js";

const name = (crew, id) => crew.find((p) => p.id === id)?.name ?? "–";

function personSelect(crew, wert, onchange, label, testid, leer = "– niemand –") {
  return h("select", { class: "feld", "aria-label": label, "data-testid": testid, onchange: (e) => onchange(e.target.value || null) },
    h("option", { value: "" }, leer),
    crew.map((p) => h("option", { value: p.id, selected: p.id === wert }, p.name)));
}

export function landgangView({ state, dispatch }) {
  const { crew, landgang: l } = state;
  if (!crew.length) return h("section", {}, h("h1", {}, "Landgang"), h("p", {}, "Lege zuerst die Crew an."), h("a", { class: "knopf", href: "#/start" }, "Zur Crew"));

  let gewinner = null;
  const gewinnerWahl = personSelect(crew, null, (w) => { gewinner = w; }, "Gewinner der Runde", "seil-gewinner", "– Gewinner wählen –");

  const seil = h("section", {}, h("h2", {}, `Seilziehen (${PUNKTE.seilziehenRunde} Punkte je Runde)`),
    h("div", { class: "crew__neu" }, gewinnerWahl,
      h("button", { type: "button", class: "knopf", "data-testid": "seil-runde",
        onclick: () => { if (gewinner) dispatch((s) => addSeilziehenRunde(s, gewinner)); } }, "Runde")),
    h("ol", { class: "verlauf", "data-testid": "seil-liste" }, l.seilziehen.map((r, i) =>
      h("li", { class: "versuch" }, h("span", {}, `Runde ${i + 1}: ${name(crew, r.gewinner)}`),
        h("button", { type: "button", class: "knopf knopf--klein knopf--gefahr", "aria-label": `Runde ${i + 1} entfernen`,
          onclick: () => dispatch((s) => removeSeilziehenRunde(s, i)) }, "Entfernen")))));

  const muell = h("section", {}, h("h2", {}, "Müllsammeln"),
    [1, 2, 3].map((platz) => h("div", { class: "block" },
      h("label", { class: "etikett" }, `Platz ${platz} (${PUNKTE.muell[platz - 1]} Punkte)`),
      personSelect(crew, l.muell[`platz${platz}`], (w) => dispatch((s) => setMuellPlatz(s, platz, w)), `Platz ${platz}`, `muell-platz${platz}`))),
    h("div", { class: "block" }, h("label", { class: "etikett" }, `Skurrilster Fund (+${PUNKTE.muellSkurril})`),
      h("input", { class: "feld", maxlength: "80", placeholder: "Was wurde gefunden?", value: l.muell.skurril?.fund ?? "", "aria-label": "Fund", "data-testid": "muell-fund",
        onchange: (e) => dispatch((s) => setSkurril(s, s.landgang.muell.skurril?.person ?? null, e.target.value)) }),
      personSelect(crew, l.muell.skurril?.person, (w) => dispatch((s) => setSkurril(s, w, s.landgang.muell.skurril?.fund ?? "")), "Finder des skurrilsten Funds", "muell-skurril-person")));

  const geo = h("section", {}, h("h2", {}, `Geocaching (${PUNKTE.geocache} Punkte je Cache)`),
    h("ul", { class: "crew" }, crew.map((p) => h("li", { class: "zaehler" },
      h("span", { class: "zaehler__name" }, p.name),
      h("button", { type: "button", class: "knopf knopf--hell zaehler__knopf", "aria-label": `${p.name}: einen Cache weniger`, onclick: () => dispatch((s) => changeGeocache(s, p.id, -1)) }, "−"),
      h("output", { class: "zaehler__wert", "data-testid": `geo-${p.name}` }, String(l.geocache[p.id] ?? 0)),
      h("button", { type: "button", class: "knopf zaehler__knopf", "aria-label": `${p.name}: einen Cache mehr`, "data-testid": `geo-plus-${p.name}`, onclick: () => dispatch((s) => changeGeocache(s, p.id, +1)) }, "+")))));

  const tabelle = h("table", { class: "tabelle", "data-testid": "landgang-punkte" },
    h("thead", {}, h("tr", {}, ["Name", "Seil", "Müll", "Geo", "Summe"].map((t) => h("th", { scope: "col" }, t)))),
    h("tbody", {}, crew.map((p) => { const x = landgangPunkte(l, p.id);
      return h("tr", {}, h("th", { scope: "row" }, p.name), h("td", {}, x.seilziehen), h("td", {}, x.muell), h("td", {}, x.geocache), h("td", {}, h("strong", {}, x.gesamt))); })));

  return h("section", { "data-testid": "landgang" }, h("h1", {}, "Landgang"), seil, muell, geo, h("h2", {}, "Landgang-Punkte"), h("div", { class: "scroll" }, tabelle));
}
