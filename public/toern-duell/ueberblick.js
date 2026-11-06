// ueberblick.js — Überblick für alle: Daten (rein) + eigenständige HTML-Datei zum Weitergeben.
import { fortschritt, rangliste, teilrangliste, MIN_CARDS, COUNT_BEST } from "./scoring.js";
import { gefahrenAnzahl } from "./karten.js";

/** Alles, was die Überblicksseite zeigt – auch bei fehlendem Manöver- oder Landgang-Teil. */
export function ueberblickDaten(state, karten) {
  const { crew, versuche, landgang } = state;
  const f = fortschritt(crew, versuche, landgang);
  return {
    boot: state.boot,
    fortschritt: f,
    gesamt: rangliste(crew, versuche, landgang),
    manoever: teilrangliste(crew, versuche, landgang, "manoever"),
    landgang: teilrangliste(crew, versuche, landgang, "landgang"),
    karten: karten.map((k) => ({ id: k.id, title: k.title, gefahren: gefahrenAnzahl(k.id, versuche, crew), von: crew.length })),
    vorlaeufig: !f.vollstaendig,
  };
}

/** Sätze, die erklären, was noch fehlt (leer, wenn alles erfasst). */
export function fehlendes(f) {
  const out = [];
  if (!f.manoever.erfasst) out.push("Manöver: noch keine Bewertung erfasst.");
  else if (f.manoever.personenUnterMin.length) out.push(`Manöver: unter ${MIN_CARDS} Karten bei ${f.manoever.personenUnterMin.join(", ")}.`);
  const lg = [["seilziehen", "Seilziehen"], ["muell", "Müllsammeln"], ["geocache", "Geocaching"]].filter(([k]) => !f.landgang[k]).map(([, n]) => n);
  if (lg.length === 3) out.push("Landgang: noch nichts erfasst.");
  else if (lg.length) out.push(`Landgang: ${lg.join(", ")} noch nicht erfasst.`);
  return out;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Eigenständige, skriptfreie HTML-Seite (alle Namen escaped) – per Messenger/AirDrop teilbar. */
export function ueberblickHtml(daten) {
  const tabelle = (kopf, zeilen) =>
    `<table><thead><tr>${kopf.map((k) => `<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${zeilen.map((z) => `<tr>${z.map((c, i) => (i === 1 ? `<td class="l">${esc(c)}</td>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table>`;
  const hinweise = fehlendes(daten.fortschritt);
  const teil = (titel, liste) =>
    liste.length ? `<h2>${esc(titel)}</h2>${tabelle(["Platz", "Name", "Punkte"], liste.map((z) => [z.platz, z.name, z.punkte]))}` : `<h2>${esc(titel)}</h2><p>Noch nicht erfasst.</p>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(daten.boot)} – Überblick</title><style>body{font:16px/1.45 system-ui,sans-serif;margin:0 auto;max-width:720px;padding:16px;color:#10213a;background:#F4EEE2}h1{color:#0B2545}table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #cfc7b4;padding:8px;text-align:center}th{background:#0B2545;color:#fff}td.l{text-align:left}.warn{border-left:6px solid #C9A24B;background:#fff;padding:8px 12px}</style></head><body><h1>${esc(daten.boot)} – Törn-Manöver-Duell</h1>${daten.vorlaeufig ? `<p class="warn"><strong>Zwischenstand.</strong> ${hinweise.map(esc).join(" ")}</p>` : ""}<h2>Gesamt</h2>${tabelle(["Platz", "Name", "Manöver", "Landgang", "Gesamt"], daten.gesamt.map((z) => [z.platz, z.name, z.manoever, z.landgang, z.gesamt]))}${teil("Nur Manöver (beste " + COUNT_BEST + " Karten)", daten.manoever)}${teil("Nur Landgang", daten.landgang)}<h2>Karten</h2>${tabelle(["Nr.", "Karte", "gefahren"], daten.karten.map((k) => [k.id, k.title, `${k.gefahren}/${k.von}`]))}</body></html>`;
}
