// csv.js — CSV-Export (Semikolon + BOM für Excel/Numbers im deutschen Raum).
import { bewerteVersuch, MIN_CARDS } from "./scoring.js";

/** Eine Zelle; entschärft Formel-Injektion (=,+,-,@) bei Text und quotet Sonderzeichen. */
export function csvZelle(wert) {
  if (wert === null || wert === undefined) return "";
  if (typeof wert === "number") return String(wert);
  let s = String(wert);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const zeilen = (rows) => "﻿" + rows.map((r) => r.map(csvZelle).join(";")).join("\r\n") + "\r\n";

export function ranglisteCsv(rangliste) {
  return zeilen([
    ["Platz", "Name", "Karten", "Manöverpunkte", "Landgang", "Gesamt", "Hinweis"],
    ...rangliste.map((z) => [
      z.platz, z.name, z.kartenAnzahl, z.manoever, z.landgang, z.gesamt,
      z.unterMin ? `unter Mindestanzahl (${MIN_CARDS} Karten)` : "",
    ]),
  ]);
}

export function bewertungenCsv(state, titelProKarte) {
  const name = (id) => state.crew.find((p) => p.id === id)?.name ?? "(entfernt)";
  return zeilen([
    ["Karte", "Titel", "Rudergänger", "Bewerter", "Selbst", "Fremd", "Bonus", "Kartenpunkte", "Notiz"],
    ...state.versuche.map((v) => {
      const b = bewerteVersuch(v);
      return [v.karte, titelProKarte.get(v.karte) ?? "", name(v.rudergaenger), name(v.bewerter), b.selbstSumme, b.fremdSumme, b.bonus, b.punkte, v.notiz ?? ""];
    }),
  ]);
}
