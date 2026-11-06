// Golden-Standard-Orakel für das Manöver-Duell.
//
// BEWUSST UNABHÄNGIG von public/toern-duell/scoring.js implementiert (andere
// Algorithmen, kein Import von dort), damit ein gemeinsamer Denkfehler auffällt:
//   - Bonus per Lookup-Tabelle statt Schwellen-Kette,
//   - Platz per "1 + Anzahl strikt Besserer" statt sequenzieller Vergabe,
//   - Top-5 per Kopie + Absteigend-Sortierung + slice,
//   - Landgang per Zählen statt Filtern.
// Alles ganzzahlig und ohne Zufall/Uhr: gleiche Eingabe → gleiche Ausgabe.
//
// Regeln (Prompt Törn-WebApp): Karte = Fremdsumme + Bonus; d = |Selbst−Fremd|;
// d ≤ 2 → +3, d ≤ 4 → +1, sonst 0; je Person/Karte zählt der beste Versuch;
// Manöver = Summe der 5 besten Karten; Landgang: Seilziehen 3/Runde, Müll 5/3/1
// (+2 skurril), Geocache 2/Cache; Gesamt = Manöver + Landgang.

export interface Bew { kommunikation: number; crew: number; steuerung: number }
export interface V { id?: string; karte: number; rudergaenger: string; bewerter: string | null; selbst: Bew; fremd: Bew; notiz?: string }
export interface Person { id: string; name: string }
export interface Landgang {
  seilziehen: { gewinner: string | null }[];
  muell: { platz1: string | null; platz2: string | null; platz3: string | null; skurril: { person: string | null; fund: string } | null };
  geocache: Record<string, number>;
}
export interface Soll { manoever: number; landgang: number; gesamt: number; platz: number; kartenAnzahl: number; unterMin: boolean; zaehlendePunkte: number[]; kartenPunkte: Record<number, number> }

/** Bonus je Abweichung d = 0..15 laut Spezifikation (Index = d). */
export const BONUS_NACH_D = [3, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as const;

export const summe = (b: Bew) => b.kommunikation + b.crew + b.steuerung;

export function kartenPunkte(selbst: Bew, fremd: Bew): { s: number; f: number; bonus: number; punkte: number } {
  const s = summe(selbst);
  const f = summe(fremd);
  const d = s > f ? s - f : f - s;
  const bonus = BONUS_NACH_D[d];
  return { s, f, bonus, punkte: f + bonus };
}

export function orakel(crew: Person[], versuche: V[], lg: Partial<Landgang> | undefined): Map<string, Soll> {
  const ergebnis = new Map<string, Soll>();
  const roh = new Map<string, { m: number; l: number; g: number; kp: Record<number, number>; zp: number[]; n: number }>();
  for (const p of crew) {
    const kp: Record<number, number> = {};
    for (let karte = 1; karte <= 15; karte++) {
      let best = -1;
      for (const v of versuche) {
        if (v.rudergaenger === p.id && v.karte === karte) best = Math.max(best, kartenPunkte(v.selbst, v.fremd).punkte);
      }
      if (best >= 0) kp[karte] = best;
    }
    const alle = Object.values(kp).sort((a, b) => b - a);
    const zp = alle.slice(0, 5);
    const m = zp.reduce((a, b) => a + b, 0);

    let seil = 0;
    for (const r of lg?.seilziehen ?? []) if (r.gewinner === p.id) seil += 1;
    let muell = 0;
    if (lg?.muell?.platz1 === p.id) muell += 5;
    if (lg?.muell?.platz2 === p.id) muell += 3;
    if (lg?.muell?.platz3 === p.id) muell += 1;
    if (lg?.muell?.skurril?.person === p.id && (lg.muell.skurril.fund ?? "").trim() !== "") muell += 2;
    const caches = lg?.geocache?.[p.id] ?? 0;
    const l = seil * 3 + muell + caches * 2;
    roh.set(p.id, { m, l, g: m + l, kp, zp, n: alle.length });
  }
  for (const p of crew) {
    const r = roh.get(p.id)!;
    let besser = 0;
    for (const q of crew) if (roh.get(q.id)!.g > r.g) besser += 1;
    ergebnis.set(p.id, { manoever: r.m, landgang: r.l, gesamt: r.g, platz: 1 + besser, kartenAnzahl: r.n, unterMin: r.n < 5, zaehlendePunkte: r.zp, kartenPunkte: r.kp });
  }
  return ergebnis;
}

// ── Deterministischer Zufall (mulberry32): gleicher Seed → gleiche Szenarien ──
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMEN = ["Anna", "Ben", "Cem", "Dörte", "Emil", "Fiete", "Gesa", "Hannes", "Ilse", "Jörn", "Käthe"];

export interface Szenario { crew: Person[]; versuche: V[]; landgang: Landgang }

/** Zufalls-Szenario aus Seed. maxVersuche/maxCrew begrenzen den Umfang (UI-Läufe klein halten). */
export function zufallsSzenario(seed: number, maxCrew = 11, maxVersuche = 80): Szenario {
  const z = prng(seed);
  const int = (a: number, b: number) => a + Math.floor(z() * (b - a + 1)); // a..b inklusive
  const nCrew = int(0, maxCrew);
  const crew = NAMEN.slice(0, nCrew).map((name, i) => ({ id: `p${i + 1}`, name }));
  const bew = (): Bew => ({ kommunikation: int(0, 5), crew: int(0, 5), steuerung: int(0, 5) });
  const versuche: V[] = [];
  if (nCrew >= 2) {
    const n = int(0, maxVersuche);
    for (let i = 0; i < n; i++) {
      const fahrer = int(0, nCrew - 1);
      let bewerter = int(0, nCrew - 2);
      if (bewerter >= fahrer) bewerter += 1; // garantiert ≠ Fahrer
      // Nähe von Selbst/Fremd erzeugen, damit alle Bonusstufen vorkommen
      const selbst = bew();
      const fremd = z() < 0.5 ? bew() : { kommunikation: Math.min(5, Math.max(0, selbst.kommunikation + int(-1, 1))), crew: Math.min(5, Math.max(0, selbst.crew + int(-1, 1))), steuerung: Math.min(5, Math.max(0, selbst.steuerung + int(-1, 1))) };
      versuche.push({ id: `v${i + 1}`, karte: int(1, 15), rudergaenger: crew[fahrer].id, bewerter: crew[bewerter].id, selbst, fremd, notiz: "" });
    }
  }
  const wahl = (): string | null => (nCrew > 0 && z() < 0.8 ? crew[int(0, nCrew - 1)].id : null);
  const seilziehen = Array.from({ length: nCrew ? int(0, 8) : 0 }, () => ({ gewinner: wahl() }));
  const frei = [...crew.map((p) => p.id)];
  const platz = (): string | null => {
    if (!frei.length || z() < 0.2) return null;
    return frei.splice(int(0, frei.length - 1), 1)[0];
  };
  const muell = { platz1: platz(), platz2: platz(), platz3: platz(), skurril: null as { person: string; fund: string } | null };
  const sk = wahl();
  if (sk) muell.skurril = { person: sk, fund: "Fund" };
  const geocache: Record<string, number> = {};
  for (const p of crew) if (z() < 0.6) geocache[p.id] = int(0, 6);
  return { crew, versuche, landgang: { seilziehen, muell, geocache } };
}

/** Von Hand ausgerechnetes Referenz-Szenario (Rechenweg im Golden-Test dokumentiert). */
export function referenzSzenario(): Szenario & { erwartet: Record<string, { manoever: number; landgang: number; gesamt: number; platz: number; kartenAnzahl: number; unterMin: boolean }> } {
  const b = (k: number, c: number, s: number): Bew => ({ kommunikation: k, crew: c, steuerung: s });
  const crew = [{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }, { id: "D", name: "D" }, { id: "E", name: "E" }];
  const nachbar: Record<string, string> = { A: "B", B: "C", C: "D", D: "E", E: "A" };
  const v = (karte: number, f: string, s: Bew, fr: Bew): V => ({ karte, rudergaenger: f, bewerter: nachbar[f], selbst: s, fremd: fr });
  const versuche: V[] = [
    // A: Karten 1..7 (+2 Zusatzversuche auf Karte 2) → [15,17,14,18,12,5,7]
    v(1, "A", b(4, 4, 4), b(4, 4, 4)), v(2, "A", b(5, 5, 5), b(3, 3, 3)), v(3, "A", b(3, 3, 3), b(4, 4, 5)),
    v(4, "A", b(5, 5, 5), b(5, 5, 5)), v(5, "A", b(2, 2, 2), b(4, 4, 4)), v(6, "A", b(1, 1, 1), b(0, 1, 1)),
    v(7, "A", b(4, 3, 3), b(2, 2, 2)), v(2, "A", b(4, 4, 4), b(5, 5, 4)), v(2, "A", b(0, 0, 0), b(0, 0, 0)),
    // B: 3 Karten → 12, 3, 12
    v(10, "B", b(3, 3, 3), b(3, 3, 3)), v(11, "B", b(5, 0, 5), b(1, 1, 1)), v(14, "B", b(2, 2, 3), b(3, 3, 3)),
    // C: 5 × Maximum 18
    ...[1, 2, 3, 4, 5].map((k) => v(k, "C", b(5, 5, 5), b(5, 5, 5))),
    // E: 18,18,18,18,9 + eine 5
    ...[1, 2, 3, 4].map((k) => v(k, "E", b(5, 5, 5), b(5, 5, 5))), v(5, "E", b(5, 5, 5), b(3, 3, 3)), v(6, "E", b(0, 0, 0), b(1, 1, 2)),
  ];
  const landgang: Landgang = {
    seilziehen: [{ gewinner: "A" }, { gewinner: "A" }, { gewinner: "B" }, { gewinner: "C" }, { gewinner: null }],
    muell: { platz1: "B", platz2: "A", platz3: "D", skurril: { person: "B", fund: "Flip-Flop" } },
    geocache: { A: 1, C: 2, E: 3 },
  };
  return {
    crew, versuche, landgang,
    erwartet: {
      A: { manoever: 76, landgang: 11, gesamt: 87, platz: 2, kartenAnzahl: 7, unterMin: false },
      B: { manoever: 27, landgang: 10, gesamt: 37, platz: 4, kartenAnzahl: 3, unterMin: true },
      C: { manoever: 90, landgang: 7, gesamt: 97, platz: 1, kartenAnzahl: 5, unterMin: false },
      D: { manoever: 0, landgang: 1, gesamt: 1, platz: 5, kartenAnzahl: 0, unterMin: true },
      E: { manoever: 81, landgang: 6, gesamt: 87, platz: 2, kartenAnzahl: 6, unterMin: false },
    },
  };
}
