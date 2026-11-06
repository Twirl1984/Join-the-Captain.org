// ueberblick.js (View) — Überblick für alle: Stand, Teilwertungen, Karten-Fortschritt, Weitergeben.
import { h } from "../dom.js";
import { fehlendes, ueberblickDaten, ueberblickHtml } from "../ueberblick.js";
import { dateiname } from "../store.js";
import { speichereDatei } from "../files.js";

const teilTabelle = (titel, liste, testid) =>
  h("section", { "data-testid": testid },
    h("h2", {}, titel),
    liste.length
      ? h("table", { class: "tabelle" }, h("tbody", {}, liste.map((z) => h("tr", {}, h("td", {}, z.platz), h("th", { scope: "row", class: "l" }, z.name), h("td", {}, z.punkte)))))
      : h("p", { class: "hinweis", "data-testid": `${testid}-leer` }, "Noch nicht erfasst."));

export function ueberblickView({ karten, state }) {
  const d = ueberblickDaten(state, karten);
  const fehlt = fehlendes(d.fortschritt);
  return h("section", { "data-testid": "ueberblick" },
    h("h1", {}, `Überblick – ${d.boot}`),
    d.vorlaeufig
      ? h("p", { class: "hinweis hinweis--warn", "data-testid": "zwischenstand" }, h("strong", {}, "Zwischenstand. "), fehlt.join(" ") || "Es fehlen noch Angaben.")
      : h("p", { class: "banner banner--ok", "data-testid": "endstand" }, "Alles erfasst – Endstand."),
    h("h2", {}, "Gesamt"),
    d.gesamt.length
      ? h("div", { class: "scroll" }, h("table", { class: "tabelle", "data-testid": "ueberblick-gesamt" },
        h("thead", {}, h("tr", {}, ["Platz", "Name", "Manöver", "Landgang", "Gesamt"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", {}, d.gesamt.map((z) => h("tr", {}, h("td", {}, z.platz), h("th", { scope: "row", class: "l" }, z.name), h("td", {}, z.manoever), h("td", {}, z.landgang), h("td", { class: "gesamt" }, z.gesamt))))))
      : h("p", {}, "Noch keine Crew angelegt."),
    teilTabelle("Nur Manöver", d.manoever, "teil-manoever"),
    teilTabelle("Nur Landgang", d.landgang, "teil-landgang"),
    h("h2", {}, "Karten gefahren"),
    h("ul", { class: "fortschritt", "data-testid": "karten-fortschritt" }, d.karten.map((k) =>
      h("li", {}, h("span", {}, `${k.id}. ${k.title}`), h("progress", { max: String(Math.max(1, k.von)), value: String(k.gefahren), "aria-label": `${k.gefahren} von ${k.von}` }), h("span", {}, `${k.gefahren}/${k.von}`)))),
    h("div", { class: "reihe keine-druck" },
      h("button", { type: "button", class: "knopf", onclick: () => window.print(), "data-testid": "ueberblick-drucken" }, "Drucken"),
      h("button", { type: "button", class: "knopf knopf--hell", "data-testid": "ueberblick-teilen",
        onclick: () => speichereDatei(dateiname("ueberblick"), ueberblickHtml(d), "text/html") }, "Für die Crew teilen (HTML)")));
}
