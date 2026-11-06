// scoring.js — Wertungslogik des Manöver-Duells (rein funktional, ohne I/O).
// Konstanten hier ändern, sonst nirgends.
export const MIN_CARDS = 5; // Mindestanzahl Karten je Person
export const COUNT_BEST = 5; // so viele beste Karten zählen
export const MAX_RATING = 5;

export const KATEGORIEN = ["kommunikation", "crew", "steuerung"];

export const PUNKTE = {
  seilziehenRunde: 3,
  muell: [5, 3, 1],
  muellSkurril: 2,
  geocache: 2,
};

function summe(bewertung, name) {
  let s = 0;
  for (const k of KATEGORIEN) {
    const v = bewertung?.[k];
    if (!Number.isInteger(v) || v < 0 || v > MAX_RATING) {
      throw new RangeError(`${name}.${k}: ganze Zahl 0–${MAX_RATING} erwartet, bekam ${v}`);
    }
    s += v;
  }
  return s;
}

/** Bonus auf d = |Selbst − Fremd|: d ≤ 2 → +3, d ≤ 4 → +1, sonst 0. */
export function ehrlichkeitsBonus(selbstSumme, fremdSumme) {
  const d = Math.abs(selbstSumme - fremdSumme);
  if (d <= 2) return 3;
  if (d <= 4) return 1;
  return 0;
}

/** Wertet einen Versuch: Summen, Bonus, Kartenpunkte (= Fremd + Bonus, max 18). */
export function bewerteVersuch(v) {
  const selbstSumme = summe(v?.selbst, "selbst");
  const fremdSumme = summe(v?.fremd, "fremd");
  const bonus = ehrlichkeitsBonus(selbstSumme, fremdSumme);
  return { selbstSumme, fremdSumme, bonus, punkte: fremdSumme + bonus };
}

/** Map Karte → bester Kartenpunktwert einer Person. */
export function besteKartenpunkte(versuche, personId) {
  const best = new Map();
  for (const v of versuche) {
    if (v.rudergaenger !== personId) continue;
    const p = bewerteVersuch(v).punkte;
    if (!best.has(v.karte) || p > best.get(v.karte)) best.set(v.karte, p);
  }
  return best;
}

/** Manöverpunkte = Summe der COUNT_BEST besten Karten; unterMin bei < MIN_CARDS. */
export function manoeverPunkte(versuche, personId) {
  const best = besteKartenpunkte(versuche, personId);
  const sortiert = [...best.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const gewertet = sortiert.slice(0, COUNT_BEST);
  return {
    punkte: gewertet.reduce((s, [, p]) => s + p, 0),
    gewertet: gewertet.map(([karte]) => karte),
    kartenAnzahl: best.size,
    unterMin: best.size < MIN_CARDS,
  };
}

/** Landgang-Punkte einer Person; fehlende Daten zählen 0. */
export function landgangPunkte(landgang, personId) {
  const l = landgang ?? {};
  const seilziehen = (l.seilziehen ?? []).filter((r) => r?.gewinner === personId).length * PUNKTE.seilziehenRunde;
  const m = l.muell ?? {};
  let muell = 0;
  ["platz1", "platz2", "platz3"].forEach((key, i) => {
    if (m[key] === personId) muell += PUNKTE.muell[i];
  });
  if (m.skurril?.person === personId) muell += PUNKTE.muellSkurril;
  const caches = Number(l.geocache?.[personId] ?? 0);
  const geocache = (Number.isFinite(caches) && caches > 0 ? Math.floor(caches) : 0) * PUNKTE.geocache;
  return { seilziehen, muell, geocache, gesamt: seilziehen + muell + geocache };
}

/** Rangliste: absteigend nach Gesamt, Gleichstand = gleicher Platz (1,1,3,…). */
export function rangliste(crew, versuche, landgang) {
  const zeilen = crew.map((p) => {
    const m = manoeverPunkte(versuche, p.id);
    const l = landgangPunkte(landgang, p.id);
    return {
      id: p.id,
      name: p.name,
      manoever: m.punkte,
      gewertet: m.gewertet,
      kartenAnzahl: m.kartenAnzahl,
      unterMin: m.unterMin,
      landgang: l.gesamt,
      gesamt: m.punkte + l.gesamt,
    };
  });
  zeilen.sort((a, b) => b.gesamt - a.gesamt || String(a.name).localeCompare(String(b.name), "de"));
  zeilen.forEach((z, i) => {
    z.platz = i > 0 && z.gesamt === zeilen[i - 1].gesamt ? zeilen[i - 1].platz : i + 1;
  });
  return zeilen;
}
