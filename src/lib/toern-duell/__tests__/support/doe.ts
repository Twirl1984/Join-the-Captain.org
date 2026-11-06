// DOE (Six Sigma): statt aller 6^6 = 46.656 Bewertungskombinationen ein kleiner,
// begründeter Versuchsplan. Alles deterministisch, ganzzahlig, ohne Zufall.
//
//  1. FAKTOREN BÜNDELN: Kartenpunkte hängen nur von S (Selbstsumme) und F (Fremdsumme) ab
//     → 16 × 16 = 256 Äquivalenzklassen statt 46.656 Rohkombinationen.
//  2. ORTHOGONALE ARRAYS prüfen die Zuordnung Kategorie → Summe und Wechselwirkungen:
//       L25  (5 Stufen {0,1,3,4,5}, 6 Faktoren, Stärke 2)  – 25 Läufe
//       2^(6-2) (Stufen {2,3} um den Mittelwert 2,5, Auflösung IV) – 16 Läufe
//  3. GRENZWERTE: die Bonus-Kanten d = 2|3 und 4|5 beidseitig, bei F = 0, Mitte, 15.
import type { Bew } from "./orakel";
import { kartenPunkte } from "./orakel";

export const FAKTOREN = ["kommunikation", "crew", "steuerung"] as const;
const bew = (v: number[]): Bew => ({ kommunikation: v[0], crew: v[1], steuerung: v[2] });
/** Sechs Faktorwerte (selbst k,c,s, fremd k,c,s) → Paar. */
const paar = (v: number[]): { selbst: Bew; fremd: Bew } => ({ selbst: bew(v.slice(0, 3)), fremd: bew(v.slice(3, 6)) });

export const L25_STUFEN = [0, 1, 3, 4, 5];
/** L25 über GF(5): Spalten a, b, a+b, a+2b, a+3b, a+4b (alle paarweise orthogonal). */
export function l25(): number[][] {
  const zeilen: number[][] = [];
  for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) zeilen.push([a, b, (a + b) % 5, (a + 2 * b) % 5, (a + 3 * b) % 5, (a + 4 * b) % 5]);
  return zeilen;
}

/** 2^(6-2): Faktoren 1–4 voll, 5 = 1·2·3, 6 = 2·3·4 (Stufen -1/+1 → Rating 2/3). */
export function teilfaktoriell16(): number[][] {
  const z: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const f = [0, 1, 2, 3].map((k) => ((i >> k) & 1 ? 1 : -1));
    z.push([f[0], f[1], f[2], f[3], f[0] * f[1] * f[2], f[1] * f[2] * f[3]]);
  }
  return z;
}

export interface Lauf { selbst: Bew; fremd: Bew; quelle: string }

export function laeufeL25(): Lauf[] {
  const a = l25();
  // Fremd-Zeile = andere Zeile (Permutation 7i+3 mod 25), damit Selbst und Fremd nicht gleich laufen
  return a.map((_, i) => ({ ...paar([...a[i].map((x) => L25_STUFEN[x]).slice(0, 3), ...a[(7 * i + 3) % 25].map((x) => L25_STUFEN[x]).slice(0, 3)]), quelle: "L25" }));
}
/** Voll genutzter 6-Faktor-Plan: Faktor 1–3 = selbst, 4–6 = fremd derselben Zeile (volle Strenge für Faktorpaare). */
export function laeufeL25Faktoren(): Lauf[] {
  return l25().map((z) => ({ ...paar(z.map((x) => L25_STUFEN[x])), quelle: "L25-6F" }));
}
export function laeufeMittelwert16(): Lauf[] {
  return teilfaktoriell16().map((z) => ({ ...paar(z.map((x) => (x > 0 ? 3 : 2))), quelle: "2^(6-2)" }));
}

/** Kanonische Aufteilung einer Summe 0..15 auf drei Kategorien (je ≤ 5), z. B. 7 → 5,2,0. */
export function aufteilung(summe: number): Bew {
  const k = Math.min(5, summe), c = Math.min(5, summe - k), s = summe - k - c;
  return { kommunikation: k, crew: c, steuerung: s };
}
/** Gleichmäßige Aufteilung (Mittelwert-Nähe), z. B. 7 → 3,2,2. */
export function aufteilungGleich(summe: number): Bew {
  const b = Math.floor(summe / 3), r = summe - 3 * b;
  return { kommunikation: b + (r > 0 ? 1 : 0), crew: b + (r > 1 ? 1 : 0), steuerung: b };
}

/** Alle 256 Äquivalenzklassen (S, F). */
export function aequivalenzklassen(): Lauf[] {
  const out: Lauf[] = [];
  for (let s = 0; s <= 15; s++) for (let f = 0; f <= 15; f++) out.push({ selbst: aufteilung(s), fremd: aufteilungGleich(f), quelle: "Klasse" });
  return out;
}

/** Grenzwertläufe: d ∈ {0,1,2,3,4,5,6} in beide Richtungen bei F ∈ {0, 7, 8, 15} (soweit S im Bereich liegt). */
export function grenzlaeufe(): Lauf[] {
  const out: Lauf[] = [];
  for (const f of [0, 7, 8, 15]) for (const d of [0, 1, 2, 3, 4, 5, 6]) for (const sign of [1, -1]) {
    const s = f + sign * d;
    if (s < 0 || s > 15 || (d === 0 && sign === -1)) continue;
    out.push({ selbst: aufteilung(s), fremd: aufteilungGleich(f), quelle: `Grenze d=${d} F=${f}` });
  }
  return out;
}

export function kernPlan(): Lauf[] {
  // laeufeL25() (permutierte Paarung) ist zu laeufeL25Faktoren() redundant → nicht im Kernplan.
  return [...laeufeL25Faktoren(), ...laeufeMittelwert16(), ...grenzlaeufe()];
}

/** Vollfaktoriell (nur als Referenz): alle 46.656. */
export function* vollFaktoriell(): Generator<Lauf> {
  const b = (i: number): Bew => ({ kommunikation: i % 6, crew: Math.floor(i / 6) % 6, steuerung: Math.floor(i / 36) % 6 });
  for (let s = 0; s < 216; s++) for (let f = 0; f < 216; f++) yield { selbst: b(s), fremd: b(f), quelle: "voll" };
}

// ── Mutanten: bewusst eingebaute Fehler; ein guter Plan muss sie finden ─────────
export const MUTANTEN = [
  "d<2", "d<=3", "d<4", "d<=5", "bonus3→2", "bonus1→2", "punkte=selbst+bonus", "kein-abs", "ohne-steuerung-selbst",
  "ohne-crew-fremd", "kein-bonus", "cap17", "max-statt-summe", "steuerung-doppelt", "asym-d4", "bonus-nur-wenn-F>0",
] as const;
export type Mutant = (typeof MUTANTEN)[number];

export function mutantPunkte(m: Mutant, selbst: Bew, fremd: Bew): number {
  let s = selbst.kommunikation + selbst.crew + selbst.steuerung;
  let f = fremd.kommunikation + fremd.crew + fremd.steuerung;
  if (m === "ohne-steuerung-selbst") s = selbst.kommunikation + selbst.crew;
  if (m === "ohne-crew-fremd") f = fremd.kommunikation + fremd.steuerung;
  if (m === "max-statt-summe") f = Math.max(fremd.kommunikation, fremd.crew, fremd.steuerung) * 3;
  if (m === "steuerung-doppelt") f = fremd.kommunikation + fremd.crew + 2 * fremd.steuerung;
  const dS = m === "kein-abs" ? s - f : Math.abs(s - f);
  let hoch = 2, mittel = 4, bHoch = 3, bMittel = 1;
  if (m === "d<2") hoch = 1;
  if (m === "d<=3") hoch = 3;
  if (m === "d<4") mittel = 3;
  if (m === "d<=5") mittel = 5;
  if (m === "bonus3→2") bHoch = 2;
  if (m === "bonus1→2") bMittel = 2;
  let bonus = dS <= hoch ? bHoch : dS <= mittel ? bMittel : 0;
  if (m === "asym-d4" && s > f && dS === 4) bonus = 0;
  if (m === "bonus-nur-wenn-F>0" && f === 0) bonus = 0;
  if (m === "kein-bonus") bonus = 0;
  let p = (m === "punkte=selbst+bonus" ? s : f) + bonus;
  if (m === "cap17") p = Math.min(17, p);
  return p;
}

/** Läufe, die den Mutanten vom Orakel unterscheiden (≥1 → Mutant „getötet“). */
export function getoetet(m: Mutant, plan: Iterable<Lauf>): boolean {
  for (const l of plan) if (mutantPunkte(m, l.selbst, l.fremd) !== kartenPunkte(l.selbst, l.fremd).punkte) return true;
  return false;
}
