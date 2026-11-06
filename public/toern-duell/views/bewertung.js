// bewertung.js (View) — Versuch erfassen/bearbeiten; große Segmente 0–5, einhändig bedienbar.
import { h } from "../dom.js";
import { KATEGORIEN, MAX_RATING, bewerteVersuch } from "../scoring.js";
import { addVersuch, updateVersuch, deleteVersuch } from "../state.js";
import { bewerterOptionen, entwurfAlsVersuch, entwurfAusVersuch, entwurfFehler, neuerEntwurf, vorschau } from "../entwurf.js";
import { hashFuer } from "../router.js";

const LABEL = { kommunikation: "Kommunikation", crew: "Crew-Management", steuerung: "Steuerung" };
const FEHLER = {
  karte: "Bitte eine Karte wählen.",
  rudergaenger: "Bitte den Rudergänger wählen.",
  bewerter: "Bitte den Bewerter wählen.",
  "selbst-bewertung": "Bewerter und Rudergänger müssen verschiedene Personen sein.",
  unvollstaendig: "Bitte alle sechs Werte vergeben (Selbst und Fremd je Kategorie).",
};

let entwurf = null; // bleibt beim Tab-Wechsel erhalten
let schluessel = "";

const select = (id, label, optionen, wert, onchange, testid) =>
  h("div", { class: "block" },
    h("label", { class: "etikett", for: id }, label),
    h("select", { id, class: "feld", "data-testid": testid, onchange: (e) => onchange(e.target.value) },
      h("option", { value: "" }, "– wählen –"),
      optionen.map((o) => h("option", { value: String(o.wert), selected: String(o.wert) === String(wert ?? "") }, o.text))));

function segment(art, kat, werte, onwahl) {
  const name = `${art}-${kat}`;
  return h("fieldset", { class: "seg" },
    h("legend", {}, art === "selbst" ? "Selbst" : "Fremd"),
    h("div", { class: "seg__reihe" }, Array.from({ length: MAX_RATING + 1 }, (_, i) =>
      h("label", { class: "seg__feld" },
        h("input", { type: "radio", name, value: i, checked: werte[kat] === i, "data-testid": `wert-${name}-${i}`, onchange: () => onwahl(i) }),
        h("span", {}, i)))));
}

export function bewertungView({ karten, state, dispatch, query }) {
  const bearbeiten = query.bearbeiten ? state.versuche.find((v) => v.id === query.bearbeiten) : null;
  const key = `${query.karte ?? ""}|${query.bearbeiten ?? ""}`;
  if (!entwurf || key !== schluessel) {
    schluessel = key;
    entwurf = bearbeiten ? entwurfAusVersuch(bearbeiten) : neuerEntwurf(query.karte);
  }
  const e = entwurf;
  const meldung = h("p", { class: "meldung", role: "alert", "data-testid": "bewertung-meldung" });
  const anzeige = h("output", { class: "vorschau", "data-testid": "vorschau", "aria-live": "polite" });
  const speicherKnopf = h("button", { type: "button", class: "knopf knopf--gold", "data-testid": "bewertung-speichern" }, bearbeiten ? "Änderung speichern" : "Speichern");

  const aktualisiere = () => {
    const v = vorschau(e);
    anzeige.replaceChildren(...(v
      ? [h("span", {}, `Selbst ${v.selbstSumme} · Fremd ${v.fremdSumme}`), h("span", {}, `Bonus +${v.bonus}`), h("strong", {}, `Kartenpunkte: ${v.punkte} / 18`)]
      : [h("span", {}, "Vergib alle sechs Werte, dann siehst du Bonus und Kartenpunkte.")]));
    meldung.textContent = "";
  };

  const bewerterBlock = h("div", {});
  const zeichneBewerter = () => {
    const opts = bewerterOptionen(state.crew, e.rudergaenger).map((p) => ({ wert: p.id, text: p.name }));
    if (!opts.some((o) => o.wert === e.bewerter)) e.bewerter = "";
    bewerterBlock.replaceChildren(select("bewerter", "Bewerter", opts, e.bewerter, (w) => { e.bewerter = w; aktualisiere(); }, "bewertung-bewerter"));
  };

  speicherKnopf.addEventListener("click", () => {
    const f = entwurfFehler(e);
    if (f) { meldung.textContent = FEHLER[f]; return; }
    const v = entwurfAlsVersuch(e);
    const r = dispatch((s) => (bearbeiten ? updateVersuch(s, bearbeiten.id, v) : addVersuch(s, v)));
    if (r) { meldung.textContent = FEHLER[r] ?? `Fehler: ${r}`; return; }
    const ziel = e.karte;
    entwurf = null;
    location.hash = hashFuer("karte", ziel);
  });

  const kategorien = KATEGORIEN.map((kat) =>
    h("section", { class: "kategorie" }, h("h2", {}, LABEL[kat]),
      segment("selbst", kat, e.selbst, (i) => { e.selbst[kat] = i; aktualisiere(); }),
      segment("fremd", kat, e.fremd, (i) => { e.fremd[kat] = i; aktualisiere(); })));

  const kartenOpts = karten.map((k) => ({ wert: k.id, text: `${k.id}. ${k.title}` }));
  const crewOpts = state.crew.map((p) => ({ wert: p.id, text: p.name }));
  const verlauf = [...state.versuche].reverse().map((v) => {
    const b = bewerteVersuch(v);
    const name = (id) => state.crew.find((p) => p.id === id)?.name ?? "(entfernt)";
    const karte = karten.find((k) => k.id === v.karte);
    return h("li", { class: "versuch", "data-testid": "versuch" },
      h("span", {}, h("strong", {}, `${v.karte}. ${karte?.title ?? ""}`), ` – ${name(v.rudergaenger)}, bewertet von ${name(v.bewerter)}: `, h("strong", {}, `${b.punkte} Punkte`)),
      h("span", { class: "reihe" },
        h("a", { class: "knopf knopf--klein knopf--hell", href: hashFuer("bewertung", null, { bearbeiten: v.id }) }, "Bearbeiten"),
        h("button", { type: "button", class: "knopf knopf--klein knopf--gefahr", "data-testid": "versuch-loeschen",
          onclick: () => { if (confirm("Diesen Versuch löschen?")) dispatch((s) => deleteVersuch(s, v.id)); } }, "Löschen")));
  });

  if (state.crew.length < 2) {
    return h("section", {}, h("h1", {}, "Bewertung"),
      h("p", {}, "Für eine Bewertung brauchst du mindestens zwei Personen in der Crew."), h("a", { class: "knopf", href: "#/start" }, "Zur Crew"));
  }
  zeichneBewerter();
  aktualisiere();
  return h("section", { "data-testid": "bewertung" },
    h("h1", {}, bearbeiten ? "Bewertung bearbeiten" : "Bewertung erfassen"),
    select("karte", "Karte", kartenOpts, e.karte, (w) => { e.karte = w ? Number(w) : null; }, "bewertung-karte"),
    select("fahrer", "Rudergänger", crewOpts, e.rudergaenger, (w) => { e.rudergaenger = w; zeichneBewerter(); aktualisiere(); }, "bewertung-fahrer"),
    bewerterBlock, kategorien,
    h("label", { class: "etikett", for: "notiz" }, "Notiz (optional)"),
    h("textarea", { id: "notiz", class: "feld", rows: "2", maxlength: "300", oninput: (ev) => { e.notiz = ev.target.value; } }, e.notiz),
    h("div", { class: "vorschau-box" }, anzeige), meldung, speicherKnopf,
    verlauf.length ? h("h2", {}, "Bisherige Bewertungen") : null,
    h("ul", { class: "verlauf" }, verlauf));
}
