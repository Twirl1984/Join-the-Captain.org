// rangliste.js (View) — Rangliste, Matrix Person × Karte, Druck, Export.
import { h } from "../dom.js";
import { besteKartenpunkte, rangliste, MIN_CARDS, COUNT_BEST } from "../scoring.js";
import { bewertungenCsv, ranglisteCsv } from "../csv.js";
import { dateiname, exportJson, markiereBackup } from "../store.js";
import { speichereDatei } from "../files.js";

export function ranglisteView({ karten, state, dispatch, jetzt }) {
  const rl = rangliste(state.crew, state.versuche, state.landgang);
  const titel = new Map(karten.map((k) => [k.id, k.title]));
  const best = new Map(state.crew.map((p) => [p.id, besteKartenpunkte(state.versuche, p.id)]));
  const zuwenig = rl.filter((z) => z.unterMin);

  const kopf = h("thead", {}, h("tr", {},
    h("th", { scope: "col", class: "tabelle__fix" }, "Name"),
    karten.map((k) => h("th", { scope: "col", title: k.title }, k.id)),
    ["Manöver", "Landgang", "Gesamt", "Platz"].map((t) => h("th", { scope: "col" }, t))));
  const zeilen = rl.map((z) => h("tr", { "data-testid": "rang-zeile" },
    h("th", { scope: "row", class: "tabelle__fix" }, z.name, z.unterMin ? h("span", { class: "stern", "aria-label": "unter Mindestanzahl" }, " *") : null),
    karten.map((k) => {
      const p = best.get(z.id)?.get(k.id);
      const zaehlt = z.gewertet.includes(k.id);
      return h("td", { class: zaehlt ? "zaehlt" : "", title: zaehlt ? "zählt" : "" }, p ?? "·");
    }),
    h("td", {}, z.manoever), h("td", {}, z.landgang), h("td", { class: "gesamt" }, z.gesamt), h("td", { class: "platz", "data-testid": "platz" }, z.platz)));

  const sichern = async (art, text, mime) => { await speichereDatei(dateiname(art), text, mime); };
  return h("section", { "data-testid": "rangliste" },
    h("h1", {}, `Rangliste – ${state.boot}`),
    state.crew.length ? null : h("p", {}, "Noch keine Crew angelegt."),
    zuwenig.length
      ? h("p", { class: "hinweis hinweis--warn", "data-testid": "mindest-hinweis" },
        `* Noch unter ${MIN_CARDS} gefahrenen Karten: ${zuwenig.map((z) => `${z.name} (${z.kartenAnzahl})`).join(", ")}. Es zählen die ${COUNT_BEST} besten Karten.`)
      : null,
    h("div", { class: "scroll" }, h("table", { class: "tabelle tabelle--matrix", "data-testid": "rang-tabelle" },
      h("caption", { class: "sr-only" }, "Kartenpunkte je Person und Karte; fett = zählt in der Wertung"), kopf, h("tbody", {}, zeilen))),
    h("p", { class: "hinweis" }, "Zahl = beste Kartenpunkte, · = noch nicht gefahren, fett unterstrichen = zählt in den Top ", String(COUNT_BEST), "."),
    h("div", { class: "reihe keine-druck" },
      h("button", { type: "button", class: "knopf", "data-testid": "drucken", onclick: () => window.print() }, "Drucken"),
      h("button", { type: "button", class: "knopf knopf--hell", "data-testid": "export-rangliste", onclick: () => sichern("rangliste", ranglisteCsv(rl), "text/csv") }, "Rangliste (CSV)"),
      h("button", { type: "button", class: "knopf knopf--hell", "data-testid": "export-bewertungen", onclick: () => sichern("bewertungen", bewertungenCsv(state, titel), "text/csv") }, "Bewertungen (CSV)"),
      h("button", { type: "button", class: "knopf knopf--hell", "data-testid": "export-json-rangliste",
        onclick: async () => { await sichern("backup", exportJson(state, jetzt), "application/json"); dispatch((s) => markiereBackup(s, jetzt)); } }, "Backup (JSON)")));
}
