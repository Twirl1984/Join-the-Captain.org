// start.js (View) — Bootsname, Crew (bis 11), Zugänge, Backup (Export/Import).
import { h } from "../dom.js";
import { MAX_CREW, addPerson, removePerson, renamePerson } from "../state.js";
import { backupAlterTage, dateiname, exportJson, importJson, markiereBackup } from "../store.js";
import { speichereDatei, leseDatei } from "../files.js";

const FEHLER = {
  leer: "Bitte einen Namen eingeben.",
  doppelt: "Den Namen gibt es schon in der Crew.",
  voll: `Die Crew ist voll (höchstens ${MAX_CREW} Personen).`,
  "zu-lang": "Der Name ist zu lang (höchstens 40 Zeichen).",
};

export function startView({ state, dispatch, melde, jetzt }) {
  const meldung = h("p", { class: "meldung", role: "status", "data-testid": "crew-meldung" });
  const zeige = (f) => { meldung.textContent = f ? (FEHLER[f] ?? f) : ""; };
  const nameFeld = h("input", { class: "feld", id: "neuer-name", name: "name", maxlength: "40", autocomplete: "off", placeholder: "Name der Person", "data-testid": "crew-neu" });
  const hinzu = (e) => {
    e.preventDefault();
    const f = dispatch((s) => addPerson(s, nameFeld.value));
    zeige(f);
    if (!f) document.getElementById("neuer-name")?.focus();
  };
  const crew = h("ul", { class: "crew", "data-testid": "crew-liste" }, state.crew.map((p) =>
    h("li", { class: "crew__zeile" },
      h("input", {
        class: "feld", value: p.name, maxlength: "40", "aria-label": `Name von ${p.name}`, "data-testid": "crew-name",
        onchange: (e) => { const f = dispatch((s) => renamePerson(s, p.id, e.target.value)); zeige(f); },
      }),
      h("button", {
        type: "button", class: "knopf knopf--klein knopf--gefahr", "aria-label": `${p.name} entfernen`, "data-testid": "crew-entfernen",
        onclick: () => {
          if (confirm(`${p.name} entfernen? Die eigenen Versuche von ${p.name} gehen dabei verloren.`)) dispatch((s) => removePerson(s, p.id));
        },
      }, "Entfernen"))));
  const alter = backupAlterTage(state, jetzt);
  const hatDaten = state.crew.length > 0 || state.versuche.length > 0;
  const backupText = alter === null ? "Noch kein Backup exportiert." : alter === 0 ? "Letztes Backup: heute." : `Letztes Backup vor ${alter} Tag${alter === 1 ? "" : "en"}.`;
  const importFeld = h("input", { type: "file", accept: "application/json,.json", hidden: true, "data-testid": "import-datei",
    onchange: async (e) => {
      const datei = e.target.files?.[0];
      if (!datei) return;
      const r = importJson(await leseDatei(datei));
      if (!r.ok) return melde(`Import abgebrochen: ${r.fehler}`);
      if (hatDaten && !confirm("Importieren ersetzt alle Daten auf diesem Gerät. Fortfahren?")) return;
      dispatch(() => r.state);
      melde("Backup importiert.", "ok");
    } });
  return h("section", {},
    h("h1", {}, "Törn-Manöver-Duell"),
    h("label", { for: "boot", class: "etikett" }, "Boot"),
    h("input", { id: "boot", class: "feld", value: state.boot, maxlength: "40", "data-testid": "boot-name",
      onchange: (e) => dispatch((s) => ({ state: { ...s, boot: e.target.value.trim() || "Akilina" } })) }),
    h("h2", {}, `Crew (${state.crew.length}/${MAX_CREW})`),
    crew,
    h("form", { class: "crew__neu", onsubmit: hinzu },
      h("label", { for: "neuer-name", class: "sr-only" }, "Neue Person"), nameFeld,
      h("button", { type: "submit", class: "knopf", "data-testid": "crew-hinzufuegen" }, "Hinzufügen")),
    meldung,
    h("nav", { class: "zugaenge", "aria-label": "Bereiche" },
      h("a", { class: "knopf", href: "#/karten" }, "Karten"),
      h("a", { class: "knopf", href: "#/bewertung" }, "Bewertung"),
      h("a", { class: "knopf", href: "#/landgang" }, "Landgang"),
      h("a", { class: "knopf", href: "#/rangliste" }, "Rangliste")),
    h("h2", {}, "Sicherung"),
    h("p", { class: "hinweis", "data-testid": "backup-alter" }, backupText),
    h("div", { class: "reihe" },
      h("button", { type: "button", class: "knopf knopf--hell", "data-testid": "export-json",
        onclick: async () => {
          await speichereDatei(dateiname("backup"), exportJson(state, jetzt), "application/json");
          dispatch((s) => markiereBackup(s, jetzt));
        } }, "Backup exportieren (JSON)"),
      h("button", { type: "button", class: "knopf knopf--hell", onclick: () => importFeld.click(), "data-testid": "import-knopf" }, "Backup importieren"),
      importFeld));
}
