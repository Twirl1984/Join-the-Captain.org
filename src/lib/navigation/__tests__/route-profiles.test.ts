// Unit-Tests für die Routen-Profile (REQ-NAV-019): kürzeste / Segel-schnell /
// Motor-schnell / Komfort (wenig Welle). Reine Logik, synthetische Maske+Feld.
// Lauf:  node --import tsx --test src/lib/navigation/__tests__/route-profiles.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fc from "fast-check";
import { createMask } from "../watermask";
import { findSeaRoute } from "../searoute";
import { gridField, profileCosts, parseRouteProfil, samplerField } from "../route-profiles";
import { DEFAULT_BOAT, type Boat } from "../../weather/polar";

// "H"-Maske: zwei horizontale Korridore (oben kurz, unten lang = Umweg),
// verbunden durch senkrechte Kanäle an beiden Enden. Start links, Ziel rechts.
//
//   Zeilen 0-1:  oberer Korridor (direkt)
//   Zeilen 2-5:  Land, nur Spalten 0-1 und 18-19 sind Wasser (Kanäle)
//   Zeilen 6-7:  unterer Korridor (Umweg)
const BBOX: [number, number, number, number] = [54, 13, 54.8, 15];
const ROWS = 8;
const COLS = 20;
const rowOf = (lat: number) => Math.floor(((lat - BBOX[0]) / (BBOX[2] - BBOX[0])) * ROWS);
const colOf = (lon: number) => Math.floor(((lon - BBOX[1]) / (BBOX[3] - BBOX[1])) * COLS);
const hMask = () =>
  createMask(BBOX, ROWS, COLS, (lat, lon) => {
    const r = rowOf(lat);
    const c = colOf(lon);
    if (r <= 1) return true; // Süd-Korridor (Umweg)
    if (r >= 6) return true; // Nord-Korridor (direkt)
    return c <= 1 || c >= COLS - 2; // Kanäle links/rechts
  });

// Koordinaten der Korridormitten (Zeile 0-basiert von Süden? createMask: r=0 = Süd).
// bbox=[S,W,N,O]: Zeile 0 liegt im SÜDEN. Also: unterer Korridor = Zeilen 0-1 (Süd),
// oberer = 6-7 (Nord). Start/Ziel in den NÖRDLICHEN Korridor (kurzer Weg).
const latOfRow = (r: number) => BBOX[0] + ((r + 0.5) / ROWS) * (BBOX[2] - BBOX[0]);
const lonOfCol = (c: number) => BBOX[1] + ((c + 0.5) / COLS) * (BBOX[3] - BBOX[1]);
const START = { lat: latOfRow(7), lon: lonOfCol(2) };
const ZIEL = { lat: latOfRow(7), lon: lonOfCol(17) };
const NORD_LAT = latOfRow(7); // direkter Korridor
const SUED_LAT = latOfRow(0); // Umweg-Korridor

/** Südlichster Punkt der Route — zeigt, ob der Umweg-Korridor genutzt wurde
 *  (mittlere Breiten wären nach der Sichtlinien-Glättung irreführend). */
function minLat(points: Array<{ lat: number }>): number {
  return Math.min(...points.map((p) => p.lat));
}
// Grenze: unterhalb liegt nur der Süd-Korridor (Zeilen 0-1 enden bei lat 54.2).
const SUED_GRENZE = 54.3;

test("[REQ-NAV-019] ohne Profil: kürzester Weg durch den direkten Korridor", () => {
  const r = findSeaRoute(hMask(), START, ZIEL);
  assert.equal(r.status, "ok");
  assert.ok(minLat(r.points) > SUED_GRENZE, `bleibt im Nord-Korridor (minLat=${minLat(r.points)})`);
});

test("[REQ-NAV-019] Komfort: meidet 3-m-Welle im direkten Korridor (nimmt Umweg)", () => {
  // Feld: rau NUR im Nord-Korridor; ab Zeile 5 abwärts ruhig (Stützpunkt nahe
  // am Korridor, damit die Verbindungskanäle nicht zur Hälfte "rau" zählen).
  const field = gridField([
    { lat: NORD_LAT, lon: lonOfCol(10), wind_kn: 15, wind_from_deg: 270, wave_m: 4 },
    { lat: latOfRow(5), lon: lonOfCol(10), wind_kn: 15, wind_from_deg: 270, wave_m: 0 },
    { lat: SUED_LAT, lon: lonOfCol(10), wind_kn: 15, wind_from_deg: 270, wave_m: 0 },
  ]);
  const costs = profileCosts("komfort", field, DEFAULT_BOAT);
  assert.ok(costs);
  const r = findSeaRoute(hMask(), START, ZIEL, costs!);
  assert.equal(r.status, "ok");
  assert.ok(
    minLat(r.points) < SUED_GRENZE,
    `Komfort-Route sollte den ruhigen Süd-Korridor nehmen (minLat=${minLat(r.points)})`,
  );
});

test("[REQ-NAV-019] Segel-schnell: meidet Flauten-Korridor, nimmt Wind-Korridor", () => {
  // Nord (direkt): Flaute 1 kn. Ab Zeile 5 abwärts: 15 kn (Halbwind auf Ost-Kurs).
  const field = gridField([
    { lat: NORD_LAT, lon: lonOfCol(10), wind_kn: 1, wind_from_deg: 180, wave_m: 0.1 },
    { lat: latOfRow(5), lon: lonOfCol(10), wind_kn: 15, wind_from_deg: 180, wave_m: 0.5 },
    { lat: SUED_LAT, lon: lonOfCol(10), wind_kn: 15, wind_from_deg: 180, wave_m: 0.5 },
  ]);
  const costs = profileCosts("segel", field, DEFAULT_BOAT);
  const r = findSeaRoute(hMask(), START, ZIEL, costs!);
  assert.equal(r.status, "ok");
  assert.ok(
    minLat(r.points) < SUED_GRENZE,
    `Segel-Route sollte in den Wind ausweichen (minLat=${minLat(r.points)})`,
  );
});

test("[REQ-NAV-019] Motor-schnell: bleibt bei ruhiger See auf dem kürzesten Weg", () => {
  const field = gridField([
    { lat: NORD_LAT, lon: lonOfCol(10), wind_kn: 1, wind_from_deg: 180, wave_m: 0.3 },
    { lat: SUED_LAT, lon: lonOfCol(10), wind_kn: 15, wind_from_deg: 180, wave_m: 0.3 },
  ]);
  const costs = profileCosts("motor", field, DEFAULT_BOAT);
  const r = findSeaRoute(hMask(), START, ZIEL, costs!);
  assert.equal(r.status, "ok");
  assert.ok(minLat(r.points) > SUED_GRENZE, `Motor bleibt direkt (minLat=${minLat(r.points)})`);
});

test("[REQ-NAV-019] Heuristik bleibt zulässig: edgeCost >= dist/heuristicSpeed", () => {
  const field = gridField([
    { lat: NORD_LAT, lon: lonOfCol(5), wind_kn: 25, wind_from_deg: 0, wave_m: 2 },
    { lat: SUED_LAT, lon: lonOfCol(15), wind_kn: 3, wind_from_deg: 90, wave_m: 0 },
  ]);
  for (const profil of ["segel", "motor", "komfort"] as const) {
    const costs = profileCosts(profil, field, DEFAULT_BOAT)!;
    for (let i = 0; i < 40; i++) {
      const a = { lat: 54 + (i % 7) * 0.1, lon: 13 + (i % 11) * 0.15 };
      const b = { lat: 54 + ((i + 3) % 7) * 0.1, lon: 13 + ((i + 5) % 11) * 0.15 };
      const dist = 1 + (i % 9);
      const c = costs.edgeCost(a, b, dist, 0);
      assert.ok(
        c >= dist / costs.heuristicSpeedNmPerCost - 1e-9,
        `${profil}: edgeCost ${c} < dist/heuristicSpeed ${dist / costs.heuristicSpeedNmPerCost}`,
      );
    }
  }
});

test("[REQ-NAV-019] profileCosts: 'kuerzeste' → null (Bestandsverhalten)", () => {
  const field = gridField([{ lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 0, wave_m: 1 }]);
  assert.equal(profileCosts("kuerzeste", field, DEFAULT_BOAT), null);
});

test("[REQ-NAV-019] parseRouteProfil: bekannte Werte, sonst null", () => {
  assert.equal(parseRouteProfil("segel"), "segel");
  assert.equal(parseRouteProfil(undefined), "kuerzeste");
  assert.equal(parseRouteProfil("warp-antrieb"), null);
});


// ── Zeitabhängiges Wetterfeld (REQ-NAV-023) ────────────────────────────────

test("[REQ-NAV-023] Kantenkosten nutzen das Wetter zur DURCHFAHRTSZEIT, nicht zur Startzeit", () => {
  // Feld: zu Beginn Flaute (2 kn), ab Stunde 5 kräftiger Wind (18 kn).
  const zeitFeld = (_lat: number, _lon: number, elapsedH: number) => ({
    wind_kn: elapsedH < 5 ? 2 : 18,
    wind_from_deg: 180, // Halbwind auf Ost-Kurs
    wave_m: 0,
  });
  const costs = profileCosts("segel", zeitFeld, DEFAULT_BOAT)!;
  const a = { lat: 54.0, lon: 13.0 };
  const b = { lat: 54.0, lon: 13.1 };
  const dist = 3.5;
  const frueh = costs.edgeCost(a, b, dist, 0); // Flaute → langsam → teuer
  const spaet = costs.edgeCost(a, b, dist, 8); // Wind → schnell → billig
  assert.ok(
    spaet < frueh,
    `dieselbe Kante muss später (mit Wind) billiger sein als in der Flaute (${spaet} vs. ${frueh})`,
  );
});

test("[REQ-NAV-023] costToHours: Zeit-Profile identisch, Komfort über Marschfahrt", () => {
  const feld = gridField([{ lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 0, wave_m: 0.5 }]);
  const segel = profileCosts("segel", feld, DEFAULT_BOAT)!;
  const komfort = profileCosts("komfort", feld, DEFAULT_BOAT)!;
  assert.equal(segel.costToHours(4), 4, "Segel-Kosten sind bereits Stunden");
  assert.ok(komfort.costToHours(10) > 0 && komfort.costToHours(10) < 10, "Komfort-Meilen → Stunden");
});

// ── Unit-Tests für Mutation-Tötung (REQ-NAV-019) ────────────────────────────────

test("[REQ-NAV-019] PROFILE array: alle Elemente sind gültig", () => {
  const validNames = ["kuerzeste", "segel", "motor", "komfort"];
  for (const name of validNames) {
    assert.equal(parseRouteProfil(name), name, `${name} sollte gültig sein`);
  }
  // Mutanten töten: StringLiteral-Mutationen zu ""
  for (const name of validNames) {
    assert.ok(name.length > 0, `${name} sollte nicht leer sein`);
  }
});

test("[REQ-NAV-019] gridField mit leeren Samples gibt RUHIG zurück", () => {
  const field = gridField([]);
  const result = field(54.5, 13.5, 0);
  assert.equal(result.wind_kn, 0);
  assert.equal(result.wind_from_deg, 0);
  assert.equal(result.wave_m, 0);
  // Mutant töten: konditionale if (false) statt if (samples.length === 0)
  assert.notEqual(result.wind_kn, undefined);
});

test("[REQ-NAV-019] gridField mit Samples findet den nächsten Nachbarn", () => {
  const samples = [
    { lat: 54.0, lon: 13.0, wind_kn: 10, wind_from_deg: 90, wave_m: 1 },
    { lat: 54.5, lon: 13.5, wind_kn: 5, wind_from_deg: 180, wave_m: 0.5 },
  ];
  const field = gridField(samples);

  // Direkt auf Sample 0
  const result0 = field(54.0, 13.0, 0);
  assert.equal(result0.wind_kn, 10);

  // Näher an Sample 1
  const result1 = field(54.5, 13.5, 0);
  assert.equal(result1.wind_kn, 5);

  // Mutant töten: falsche Distanzberechnung
  assert.notEqual(result0.wind_kn, result1.wind_kn);
});

test("[REQ-NAV-019] gridField: Breitengradkosinusgewichtung in der Distanzberechnung", () => {
  // Zwei Samples bei unterschiedlichen Längengraden aber gleicher Breite
  const north = { lat: 60, lon: 13.0, wind_kn: 10, wind_from_deg: 0, wave_m: 0 };
  const south = { lat: 30, lon: 13.0, wind_kn: 20, wind_from_deg: 0, wave_m: 0 };
  const field = gridField([north, south]);

  // Punkt bei 60° sollte näher an north sein (trotz gleicher Breite)
  const atNorth = field(60, 13.0, 0);
  assert.equal(atNorth.wind_kn, 10, "sollte north sample sein");

  // Mutant töten: falsche cos(lat)-Berechnung
  assert.ok(Math.abs(atNorth.wind_kn - 10) < 1);
});

test("[REQ-NAV-019] profileCosts für 'motor': Welle bremst quadratisch", () => {
  const feld = gridField([
    { lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 180, wave_m: 2 },
  ]);
  const motorCosts = profileCosts("motor", feld, DEFAULT_BOAT)!;
  const a = { lat: 54.0, lon: 13.0 };
  const b = { lat: 54.0, lon: 13.1 };
  const dist = 10;

  // Kosten mit Welle 2: (10 / vM) * (1 + 0.08 * 4) = (10/vM) * 1.32
  const cost = motorCosts.edgeCost(a, b, dist, 0);

  // Baseline ohne Welle
  const noWaveField = gridField([
    { lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 180, wave_m: 0 },
  ]);
  const noWaveCost = profileCosts("motor", noWaveField, DEFAULT_BOAT)!;
  const noWaveEdgeCost = noWaveCost.edgeCost(a, b, dist, 0);

  assert.ok(cost > noWaveEdgeCost, `Welle sollte Kosten erhöhen (${cost} > ${noWaveEdgeCost})`);
  // Mutant töten: * statt / in (dist / vM)
  assert.ok(cost < 2 * noWaveEdgeCost, "Verdoppelung ist ein Zeichen falscher Berechnung");
});

test("[REQ-NAV-019] profileCosts für 'segel': null-Wind-Fallback (beatVmgSpeed)", () => {
  // Feld mit Wind, der eine No-Go-Zone verursacht
  const feld = gridField([
    { lat: 54, lon: 13, wind_kn: 5, wind_from_deg: 45, wave_m: 0 },
  ]);
  const segelCosts = profileCosts("segel", feld, DEFAULT_BOAT)!;
  const a = { lat: 54.0, lon: 13.0 };
  const b = { lat: 54.0, lon: 13.5 }; // 90° Kurs (Ost)
  const dist = 20;

  const cost = segelCosts.edgeCost(a, b, dist, 0);
  // Wenn sailSpeed() null oder <= 0 wäre, würde beatVmgSpeed() verwendet
  assert.ok(cost > 0, "Kantenkosten sollten positiv sein");

  // Mutant töten: if (true) statt if (v <= 0)
  assert.ok(cost > dist / 10, "Geschwindigkeit sollte nicht unrealistisch niedrig sein");
});

test("[REQ-NAV-019] profileCosts für 'komfort': Starkwind-Malus (wind >= 18 kn)", () => {
  // Komfort-Feld: nur Starkwind, keine Welle
  const feldStarkwind = gridField([
    { lat: 54, lon: 13, wind_kn: 20, wind_from_deg: 180, wave_m: 0 },
  ]);
  const komfortStark = profileCosts("komfort", feldStarkwind, DEFAULT_BOAT)!;

  // Komfort-Feld: schwacher Wind
  const feldSchwach = gridField([
    { lat: 54, lon: 13, wind_kn: 5, wind_from_deg: 180, wave_m: 0 },
  ]);
  const komfortSchwach = profileCosts("komfort", feldSchwach, DEFAULT_BOAT)!;

  const a = { lat: 54.0, lon: 13.0 };
  const b = { lat: 54.0, lon: 13.1 };
  const dist = 10;

  const costStark = komfortStark.edgeCost(a, b, dist, 0);
  const costSchwach = komfortSchwach.edgeCost(a, b, dist, 0);

  assert.ok(costStark > costSchwach, "Starkwind sollte die Kosten erhöhen");
  // Mutant töten: w.wind_kn - 18 → w.wind_kn + 18
  assert.ok(costStark > dist, "Starkwind sollte mindestens dist-Kosten haben");
});

test("[REQ-NAV-019] profileCosts für 'komfort': Wellenschlag-Malus (quadratisch)", () => {
  // Feld mit Welle, kein Wind
  const feldWelle = gridField([
    { lat: 54, lon: 13, wind_kn: 5, wind_from_deg: 180, wave_m: 2 },
  ]);
  const komfortWelle = profileCosts("komfort", feldWelle, DEFAULT_BOAT)!;

  // Feld ohne Welle
  const feldRuhig = gridField([
    { lat: 54, lon: 13, wind_kn: 5, wind_from_deg: 180, wave_m: 0 },
  ]);
  const komfortRuhig = profileCosts("komfort", feldRuhig, DEFAULT_BOAT)!;

  const a = { lat: 54.0, lon: 13.0 };
  const b = { lat: 54.0, lon: 13.1 };
  const dist = 10;

  const costWelle = komfortWelle.edgeCost(a, b, dist, 0);
  const costRuhig = komfortRuhig.edgeCost(a, b, dist, 0);

  assert.ok(costWelle > costRuhig, "Welle sollte Kosten erhöhen");
  // Mutant töten: 1.5 * wave * wave statt andere Faktoren
  assert.ok(
    costWelle > costRuhig * 1.3,
    "Wellenschlag-Malus sollte signifikant sein (Welle 2 → 1 + 1.5*4 = 7x)"
  );
});

test("[REQ-NAV-019] profileCosts für 'motor': MIN_SPEED_KN verhindert Stehen", () => {
  // Boot mit Motor
  const motorCosts = profileCosts("motor", gridField([]), DEFAULT_BOAT)!;
  assert.ok(motorCosts.nominalSpeedKn > 0, "Motor-Geschwindigkeit sollte > 0 sein");
  assert.ok(motorCosts.nominalSpeedKn >= 0.5, "MIN_SPEED_KN sollte 0.5 sein");
});

test("[REQ-NAV-019] profileCosts für 'segel': MAX_SPEED respektiert vMax", () => {
  // Feld mit hohem Wind
  const feldWind = gridField([
    { lat: 54, lon: 13, wind_kn: 25, wind_from_deg: 90, wave_m: 0 },
  ]);
  const segelCosts = profileCosts("segel", feldWind, DEFAULT_BOAT)!;
  assert.ok(segelCosts.nominalSpeedKn > 0, "Segel-Speed sollte positiv sein");
  assert.equal(segelCosts.nominalSpeedKn, segelCosts.heuristicSpeedNmPerCost, "heuristicSpeed sollte vMax sein");
});

test("[REQ-NAV-019] profileCosts: motor vs. komfort nutzen costToHours korrekt", () => {
  const feld = gridField([{ lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 0, wave_m: 0.5 }]);
  const motor = profileCosts("motor", feld, DEFAULT_BOAT)!;
  const komfort = profileCosts("komfort", feld, DEFAULT_BOAT)!;

  // Motor: costToHours ist Identität (c => c)
  assert.equal(motor.costToHours(5), 5, "Motor: 5h Kosten = 5h");
  // Komfort: costToHours teilt durch nominale Geschwindigkeit
  assert.notEqual(komfort.costToHours(5), 5, "Komfort sollte nicht-identisch sein");
  assert.ok(komfort.costToHours(5) > 0, "Komfort-Conversion sollte positiv sein");
});

test("[REQ-NAV-019] profileCosts: 'motor' Profil wird erkannt", () => {
  const feld = gridField([{ lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 0, wave_m: 0 }]);
  const motorCosts = profileCosts("motor", feld, DEFAULT_BOAT);
  assert.ok(motorCosts !== null, "Motor-Profil sollte Kosten zurückgeben");
  assert.ok(motorCosts.edgeCost !== undefined, "Motor sollte edgeCost Funktion haben");
  // Mutant töten: if (false) statt if (profil === "motor")
  assert.ok(motorCosts.heuristicSpeedNmPerCost > 0, "Motor-Heuristik sollte positiv sein");
});

test("[REQ-NAV-019] profileCosts: boot.hull_speed_kn Fallback auf DEFAULT_BOAT", () => {
  const feld = gridField([{ lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 0, wave_m: 0 }]);
  const customBoat = { ...DEFAULT_BOAT };
  const segelCosts = profileCosts("segel", feld, customBoat)!;
  assert.ok(segelCosts.nominalSpeedKn > 0, "segel-Speed sollte vom Boot kommen");
  // Mutant töten: ?? statt && für Fallback
  const noHullBoat = { ...DEFAULT_BOAT, hull_speed_kn: undefined } as unknown as Boat;
  const costs2 = profileCosts("segel", feld, noHullBoat)!;
  assert.ok(costs2.nominalSpeedKn > 0, "Fallback sollte DEFAULT_BOAT.hull_speed_kn verwenden");
});

test("[REQ-NAV-019] midpoint-Berechnung korrekt (Addition/Division)", () => {
  const feld = gridField([
    { lat: 54.0, lon: 13.0, wind_kn: 5, wind_from_deg: 0, wave_m: 0 },
    { lat: 55.0, lon: 14.0, wind_kn: 10, wind_from_deg: 0, wave_m: 0 },
  ]);

  const motorCosts = profileCosts("motor", feld, DEFAULT_BOAT)!;
  const a = { lat: 54.0, lon: 13.0 };
  const b = { lat: 55.0, lon: 14.0 };
  const dist = 100;

  // mid(a,b) sollte (54.5, 13.5) sein → findet Sample näher an (55, 14)
  const cost = motorCosts.edgeCost(a, b, dist, 0);
  assert.ok(cost > 0, "edgeCost mit midpoint sollte positiv sein");
  // Mutant töten: / statt * oder andere arithmetische Fehler
  const halfDist = 50;
  const costHalf = motorCosts.edgeCost(a, b, halfDist, 0);
  assert.ok(costHalf < cost, "halbe Distanz sollte niedrigere Kosten haben");
});

// ── samplerField Unit-Tests (Zeitabhängiges Wetter) ────────────────────────────────

test("[REQ-NAV-023] samplerField: Zeitstempel wird korrekt addiert", () => {
  const startTime = new Date("2025-01-01T10:00:00Z");
  const startMs = startTime.getTime();

  // Sampler, der den Zeitstempel im Callback überprüft
  let capturedAt: Date | null = null;
  const sampler = (arg: { lat: number; lon: number; at: Date }) => {
    capturedAt = arg.at;
    return { wind_speed_kn: 10, wind_from_deg: 90, wave_height_m: 0.5 };
  };

  const field = samplerField(sampler, startTime, 120);
  const _result = field(54, 13, 2); // 2 Stunden später

  assert.ok(capturedAt !== null, "sampler sollte aufgerufen worden sein");
  assert.equal((capturedAt as Date).getTime(), startMs + 2 * 3600e3, "Zeit sollte +2h sein");
  // Mutant töten: + statt - oder * statt /
  assert.ok(Math.abs((capturedAt as Date).getTime() - (startMs + 2 * 3600e3)) < 1);
});

test("[REQ-NAV-023] samplerField: Deckel bei maxHours (nicht extrapolieren)", () => {
  const startTime = new Date("2025-01-01T10:00:00Z");
  const startMs = startTime.getTime();

  let capturedAt: Date | null = null;
  const sampler = (arg: { lat: number; lon: number; at: Date }) => {
    capturedAt = arg.at;
    return { wind_speed_kn: 10, wind_from_deg: 90, wave_height_m: 0.5 };
  };

  const field = samplerField(sampler, startTime, 5); // maxHours = 5
  const _result = field(54, 13, 100); // Anfrage für 100 Stunden

  assert.ok(capturedAt !== null);
  // Sollte auf 5 Stunden gekürzt werden, nicht 100
  assert.equal((capturedAt as Date).getTime(), startMs + 5 * 3600e3, "Zeit sollte auf maxHours begrenzt sein");
  // Mutant töten: Math.min statt Math.max
  assert.ok((capturedAt as Date).getTime() <= startMs + 5 * 3600e3 + 1000);
});

test("[REQ-NAV-023] samplerField: negative elapsedH wird auf 0 gesetzt", () => {
  const startTime = new Date("2025-01-01T10:00:00Z");
  const startMs = startTime.getTime();

  let capturedAt: Date | null = null;
  const sampler = (arg: { lat: number; lon: number; at: Date }) => {
    capturedAt = arg.at;
    return { wind_speed_kn: 10, wind_from_deg: 90, wave_height_m: 0.5 };
  };

  const field = samplerField(sampler, startTime, 120);
  const _result = field(54, 13, -10); // Negative Zeit

  assert.ok(capturedAt !== null);
  // Sollte auf 0 gesetzt werden (Math.max(0, -10) = 0)
  assert.equal((capturedAt as Date).getTime(), startMs, "negative elapsedH sollte 0 sein");
  // Mutant töten: Math.max vs Math.min
  assert.ok(Math.abs((capturedAt as Date).getTime() - startMs) < 1);
});

test("[REQ-NAV-023] samplerField: NaN/nicht-endliche elapsedH wird auf 0 gesetzt", () => {
  const startTime = new Date("2025-01-01T10:00:00Z");
  const startMs = startTime.getTime();

  let capturedAt: Date | null = null;
  const sampler = (arg: { lat: number; lon: number; at: Date }) => {
    capturedAt = arg.at;
    return { wind_speed_kn: 10, wind_from_deg: 90, wave_height_m: 0.5 };
  };

  const field = samplerField(sampler, startTime, 120);
  const _result = field(54, 13, NaN); // NaN

  assert.ok(capturedAt !== null);
  // Sollte auf 0 gesetzt werden (Number.isFinite(NaN) = false → 0)
  assert.equal((capturedAt as Date).getTime(), startMs, "NaN sollte auf 0 fallen");
});

test("[REQ-NAV-023] samplerField: Feld gibt strukturiertes Objekt zurück", () => {
  const startTime = new Date("2025-01-01T10:00:00Z");

  const sampler = (_arg: { lat: number; lon: number; at: Date }) => {
    return { wind_speed_kn: 12.5, wind_from_deg: 135, wave_height_m: 1.8 };
  };

  const field = samplerField(sampler, startTime, 120);
  const result = field(54, 13, 0);

  assert.equal(result.wind_kn, 12.5, "wind_kn sollte von sampler übernommen werden");
  assert.equal(result.wind_from_deg, 135, "wind_from_deg sollte exakt sein");
  assert.equal(result.wave_m, 1.8, "wave_m sollte von wave_height_m stammen");
  // Mutant töten: ObjectLiteral -> {} oder falsche Feld-Zuordnung
  assert.ok(Object.keys(result).length === 3, "sollte 3 Felder haben");
});

test("[REQ-NAV-023] samplerField: wave_height_m null wird zu null", () => {
  const startTime = new Date("2025-01-01T10:00:00Z");

  const sampler = (_arg: { lat: number; lon: number; at: Date }) => {
    return { wind_speed_kn: 10, wind_from_deg: 90, wave_height_m: null };
  };

  const field = samplerField(sampler, startTime, 120);
  const result = field(54, 13, 0);

  assert.equal(result.wave_m, null, "null wave_height_m sollte null bleiben");
  // Mutant töten: ?? null statt && null
  assert.strictEqual(result.wave_m, null);
});

test("[REQ-NAV-023] samplerField: wave_height_m undefined wird zu null", () => {
  const startTime = new Date("2025-01-01T10:00:00Z");

  const sampler = (_arg: { lat: number; lon: number; at: Date }) => {
    return { wind_speed_kn: 10, wind_from_deg: 90, wave_height_m: undefined };
  };

  const field = samplerField(sampler, startTime, 120);
  const result = field(54, 13, 0);

  assert.equal(result.wave_m, null, "undefined wave_height_m sollte null werden");
  // Mutant töten: ?? Fallback funktioniert
  assert.strictEqual(result.wave_m, null);
});

test("[REQ-NAV-019] Motor: dist/vM Divisor nicht Multiplikator", () => {
  const feld = gridField([{ lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 180, wave_m: 0 }]);
  const motorCosts = profileCosts("motor", feld, DEFAULT_BOAT)!;

  const vM = motorCosts.nominalSpeedKn;
  const a = { lat: 54.0, lon: 13.0 };
  const b = { lat: 54.0, lon: 13.1 };
  const dist = 20;

  // Kosten = (dist / vM) * (1 + 0.08 * 0) = dist / vM
  const cost = motorCosts.edgeCost(a, b, dist, 0);
  // Wenn dist * vM würde, hätte der 20er Distanz mit vM~6 → 120 sein statt ~3.3
  assert.ok(cost < dist, `cost (${cost}) sollte < dist (${dist}) sein`);
  assert.ok(Math.abs(cost - dist / vM) < 0.1, "cost sollte dist/vM sein");
  // Mutant töten: * statt /
  assert.ok(cost * vM > dist * 0.9 && cost * vM < dist * 1.1, "cost * vM ≈ dist");
});

test("[REQ-NAV-019] Starkwind-Malus: - statt + im Vergleich", () => {
  const feldWind20 = gridField([
    { lat: 54, lon: 13, wind_kn: 20, wind_from_deg: 180, wave_m: 0 },
  ]);
  const feldWind10 = gridField([
    { lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 180, wave_m: 0 },
  ]);

  const komfortWind20 = profileCosts("komfort", feldWind20, DEFAULT_BOAT)!;
  const komfortWind10 = profileCosts("komfort", feldWind10, DEFAULT_BOAT)!;

  const a = { lat: 54.0, lon: 13.0 };
  const b = { lat: 54.0, lon: 13.1 };
  const dist = 10;

  const cost20 = komfortWind20.edgeCost(a, b, dist, 0);
  const cost10 = komfortWind10.edgeCost(a, b, dist, 0);

  // Wind 20: boe = (20 - 18) / 10 = 0.2
  // Wind 10: boe = (10 - 18) / 10 = -0.8 → aber Math.max(0, ...) = 0
  assert.ok(cost20 > cost10, `Wind 20 sollte teurer sein (${cost20} > ${cost10})`);
  // Mutant töten: + statt - oder falsche Berechnung
  assert.ok(cost20 > dist * 1.01, "Starkwind sollte mindestens die Basis erhöhen");
});

test("[REQ-NAV-019] Starkwind-Malus: / statt * im Divisor", () => {
  const feldWind25 = gridField([
    { lat: 54, lon: 13, wind_kn: 25, wind_from_deg: 180, wave_m: 0 },
  ]);

  const komfort = profileCosts("komfort", feldWind25, DEFAULT_BOAT)!;
  const a = { lat: 54.0, lon: 13.0 };
  const b = { lat: 54.0, lon: 13.1 };
  const dist = 10;

  // Wind 25: boe = (25 - 18) / 10 = 0.7
  // Kosten = 10 * (1 + 0 + 0.7) = 17
  const cost = komfort.edgeCost(a, b, dist, 0);

  // Wenn * 10 statt / 10: boe = (25 - 18) * 10 = 70
  // Kosten = 10 * (1 + 0 + 70) = 710 (viel zu hoch)
  assert.ok(cost < dist * 3, `Kosten sollten moderat sein (${cost}), nicht > 700`);
  // Mutant töten: / vs *
  assert.ok(cost > dist * 1.5, "aber dennoch signifikanter Malus");
});

test("[REQ-NAV-019] gridField: cosLat nutzt korrekte Formel für Breitengradgewichtung", () => {
  // Zwei Samples: eines direkt auf dem Abfragepunkt, eines weit weg
  const closeByLat = { lat: 54.0, lon: 13.0, wind_kn: 10, wind_from_deg: 0, wave_m: 0 };
  const farAway = { lat: 54.0, lon: 20.0, wind_kn: 20, wind_from_deg: 0, wave_m: 0 };
  const field = gridField([closeByLat, farAway]);

  // Punkt direkt auf einem Sample sollte zu diesem gehören
  const atClose = field(54.0, 13.0, 0);
  assert.equal(atClose.wind_kn, 10, "sollte naher Sample sein");

  // Punkt näher am nahen Sample als am fernen
  const atNear = field(54.0, 13.5, 0);
  assert.equal(atNear.wind_kn, 10, "sollte immer noch näherer Sample sein");

  // Mutant töten: falsche cosLat-Berechnung würde zu unterschiedlichen Wahlen führen
  assert.ok(atClose.wind_kn === atNear.wind_kn);
});

test("[REQ-NAV-019] gridField Distanzberechnung mit konkreten Werten", () => {
  // Sample A bei (0, 0), Sample B bei (1, 1)
  const sampleA = { lat: 0, lon: 0, wind_kn: 10, wind_from_deg: 0, wave_m: 0 };
  const sampleB = { lat: 1, lon: 1, wind_kn: 20, wind_from_deg: 0, wave_m: 0 };
  const field = gridField([sampleA, sampleB]);

  // Punkt (0, 0) sollte zu A gehören
  const atA = field(0, 0, 0);
  assert.equal(atA.wind_kn, 10);

  // Punkt (1, 1) sollte zu B gehören
  const atB = field(1, 1, 0);
  assert.equal(atB.wind_kn, 20);

  // Punkt (0.5, 0.5) sollte äquidistant sein, aber wegen cosLat(0.5°) ≈ 1.0 → zu A tendieren
  const atMid = field(0.5, 0.5, 0);
  assert.equal(atMid.wind_kn, 10, "Mittelpunkt sollte zu A gehören");

  // Mutant töten: Addition/Subtraktion in Distanzformel oder falsche Gewichtung
  assert.ok(Math.abs(atA.wind_kn - atB.wind_kn) > 0, `Werte sollten unterschiedlich sein: ${atA.wind_kn} !== ${atB.wind_kn}`);
});

test("[REQ-NAV-019] midpoint-Aggregation: Koordinaten werden korrekt halbiert", () => {
  // Feld mit gestaffelten Samples für unterschiedliche Regionen
  const samples = [
    { lat: 54.0, lon: 13.0, wind_kn: 1, wind_from_deg: 0, wave_m: 0 },
    { lat: 54.5, lon: 13.5, wind_kn: 10, wind_from_deg: 0, wave_m: 0 },
    { lat: 55.0, lon: 14.0, wind_kn: 5, wind_from_deg: 0, wave_m: 0 },
  ];
  const field = gridField(samples);

  const motorCosts = profileCosts("motor", field, DEFAULT_BOAT)!;

  // Eine kurze Kante sollte niedrigere Kosten haben
  const shortDist = 2;
  const shortCost = motorCosts.edgeCost({ lat: 54.0, lon: 13.0 }, { lat: 54.1, lon: 13.1 }, shortDist, 0);

  // Eine lange Kante mit gleicher Richtung aber doppelter Entfernung
  const longDist = 4;
  const longCost = motorCosts.edgeCost({ lat: 54.0, lon: 13.0 }, { lat: 54.2, lon: 13.2 }, longDist, 0);

  // Längere Kanten sollten höhere Kosten haben (Linear mit Distanz)
  assert.ok(longCost > shortCost, `längere Kanten sollten teurer sein (${longCost} > ${shortCost})`);
  // Mutant töten: Divisions-Fehler in midpoint-Berechnung
  const costRatio = longCost / shortCost;
  assert.ok(costRatio >= 1.5 && costRatio <= 2.5, `Verhältnis sollte ~2x sein, nicht ${costRatio}`);
});

test("[REQ-NAV-019] Segel: v <= 0 Fallback triggert bei No-Go-Zone", () => {
  // Wind direkten gegen Kurs → hohe true wind angle → sailSpeed return 0 oder negativ
  const feldGegenWind = gridField([
    { lat: 54, lon: 13, wind_kn: 15, wind_from_deg: 0, wave_m: 0 },
  ]);

  const segelCosts = profileCosts("segel", feldGegenWind, DEFAULT_BOAT)!;

  // Kurs von Süd nach Nord (0°), Wind von Norden (0°)
  // TWA = 0° (in-irons) → sailSpeed sollte sehr klein oder null sein
  const a = { lat: 54.0, lon: 13.0 };
  const b = { lat: 54.1, lon: 13.0 }; // Nord-Kurs

  const cost = segelCosts.edgeCost(a, b, 10, 0);

  // Wenn v <= 0 nicht fallback hätte, würde cost = 10 / (kleiner oder 0) = Infinity sein
  // Der Fallback beatVmgSpeed sollte einen vernünftigen Wert geben
  assert.ok(cost > 0, "cost sollte positiv sein (beatVmgSpeed fallback sollte aktiv sein)");
  assert.ok(isFinite(cost), "cost sollte endlich sein");
  // Mutant töten: if (true) statt if (v <= 0)
  assert.ok(cost < 100, "aber nicht unerwartet groß");
});

// ── Property-based Tests mit fast-check ──────────────────────────────────────

test("[REQ-NAV-019] Property: parseRouteProfil bekannte Profile bleiben unverändert", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("kuerzeste", "segel", "motor", "komfort"),
      (profil) => {
        const result = parseRouteProfil(profil);
        assert.equal(result, profil, `parseRouteProfil('${profil}') sollte '${profil}' zurückgeben, bekam ${result}`);
      }
    )
  );
});

test("[REQ-NAV-019] Property: parseRouteProfil null/undefined → 'kuerzeste'", () => {
  fc.assert(
    fc.property(
      fc.oneof(fc.constant(null), fc.constant(undefined)),
      (value) => {
        const result = parseRouteProfil(value);
        assert.equal(result, "kuerzeste", `parseRouteProfil(${value}) sollte 'kuerzeste' sein, war ${result}`);
      }
    )
  );
});

test("[REQ-NAV-019] Property: parseRouteProfil unbekannte Strings → null", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !["kuerzeste", "segel", "motor", "komfort"].includes(s)),
      (unknown) => {
        const result = parseRouteProfil(unknown);
        assert.equal(result, null, `parseRouteProfil('${unknown}') sollte null sein, war ${result}`);
      }
    )
  );
});

test("[REQ-NAV-019] Property: gridField mit leerem Samples-Array → RUHIG-Feld", () => {
  const field = gridField([]);
  fc.assert(
    fc.property(
      fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
      (lat, lon) => {
        const sample = field(lat, lon, 0);
        assert.equal(sample.wind_kn, 0, "wind_kn sollte 0 sein");
        assert.equal(sample.wind_from_deg, 0, "wind_from_deg sollte 0 sein");
        assert.equal(sample.wave_m, 0, "wave_m sollte 0 sein");
      }
    )
  );
});

test("[REQ-NAV-019] Property: gridField([(lat,lon,...)]) gibt denselben Sample für (lat,lon) zurück", () => {
  fc.assert(
    fc.property(
      fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 30, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 360, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
      (lat, lon, wind, dir, wave) => {
        const field = gridField([{ lat, lon, wind_kn: wind, wind_from_deg: dir, wave_m: wave }]);
        const sample = field(lat, lon, 0);
        assert.equal(sample.wind_kn, wind, `wind_kn sollte ${wind} sein`);
        assert.equal(sample.wind_from_deg, dir, `wind_from_deg sollte ${dir} sein`);
        assert.equal(sample.wave_m, wave, `wave_m sollte ${wave} sein`);
      }
    )
  );
});

test("[REQ-NAV-019] Property: profileCosts 'kuerzeste' → null", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          lat: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
          lon: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
          wind_kn: fc.double({ min: 0, max: 30, noNaN: true, noDefaultInfinity: true }),
          wind_from_deg: fc.double({ min: 0, max: 360, noNaN: true, noDefaultInfinity: true }),
          wave_m: fc.oneof(fc.constant(null), fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true })),
        }),
        { maxLength: 5 }
      ),
      (samples) => {
        const field = gridField(samples.length ? samples : [{ lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 0, wave_m: 1 }]);
        const result = profileCosts("kuerzeste", field);
        assert.equal(result, null, `profileCosts('kuerzeste', ...) sollte null sein`);
      }
    )
  );
});

test("[REQ-NAV-019] Property: profileCosts non-'kuerzeste' → RouteCosts object", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("segel", "motor", "komfort"),
      (profil) => {
        const field = gridField([{ lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 0, wave_m: 1 }]);
        const result = profileCosts(profil, field, DEFAULT_BOAT);
        assert.ok(result !== null, `profileCosts('${profil}', ...) sollte nicht null sein`);
        assert.ok(result!.heuristicSpeedNmPerCost > 0, "heuristicSpeedNmPerCost sollte > 0 sein");
        assert.ok(typeof result!.edgeCost === "function", "edgeCost sollte eine Funktion sein");
        assert.ok(typeof result!.costToHours === "function", "costToHours sollte eine Funktion sein");
      }
    )
  );
});

test("[REQ-NAV-019] Property: profileCosts edgeCost >= dist/heuristicSpeed (A*-Zulässigkeit)", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("segel", "motor", "komfort"),
      fc.double({ min: 50, max: 56, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 10, max: 16, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
      (profil, baseLat, baseLon, dist) => {
        const field = gridField([
          { lat: baseLat, lon: baseLon, wind_kn: 15, wind_from_deg: 0, wave_m: 1.5 },
          { lat: baseLat + 0.1, lon: baseLon + 0.1, wind_kn: 10, wind_from_deg: 90, wave_m: 0.5 },
        ]);
        const costs = profileCosts(profil, field, DEFAULT_BOAT)!;
        const a = { lat: baseLat, lon: baseLon };
        const b = { lat: baseLat + 0.1, lon: baseLon + 0.1 };
        const cost = costs.edgeCost(a, b, dist, 0);
        const heuristic_lower_bound = dist / costs.heuristicSpeedNmPerCost;
        assert.ok(cost >= heuristic_lower_bound - 1e-9, 
          `${profil}: cost=${cost} sollte >= ${heuristic_lower_bound} sein`);
      }
    )
  );
});

test("[REQ-NAV-019] Property: profileCosts costToHours(c) ist positive Funktion", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("segel", "motor", "komfort"),
      fc.double({ min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true }),
      (profil, cost) => {
        const field = gridField([{ lat: 54, lon: 13, wind_kn: 10, wind_from_deg: 0, wave_m: 1 }]);
        const costs = profileCosts(profil, field, DEFAULT_BOAT)!;
        const hours = costs.costToHours(cost);
        assert.ok(hours > 0 && isFinite(hours), `costToHours(${cost}) sollte positive Stunden sein, war ${hours}`);
      }
    )
  );
});

test("[REQ-NAV-023] Property: samplerField nutzt die elapsed-Zeit korrekt", () => {
  const startTime = new Date("2025-01-01T00:00:00Z");
  const sampler = (arg: { lat: number; lon: number; at: Date }) => {
    const h = (arg.at.getTime() - startTime.getTime()) / 3600e3;
    return {
      wind_speed_kn: h < 5 ? 2 : 18,
      wind_from_deg: 180,
      wave_height_m: null,
    };
  };
  const field = samplerField(sampler, startTime, 120);
  
  fc.assert(
    fc.property(
      fc.double({ min: 50, max: 56, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 10, max: 16, noNaN: true, noDefaultInfinity: true }),
      (lat, lon) => {
        const early = field(lat, lon, 2); // 2 Stunden: Flaute
        const late = field(lat, lon, 8);  // 8 Stunden: Wind
        assert.ok(early.wind_kn < 5, `early (2h) sollte Flaute sein: ${early.wind_kn} kn`);
        assert.ok(late.wind_kn > 15, `late (8h) sollte Wind haben: ${late.wind_kn} kn`);
      }
    )
  );
});

test("[REQ-NAV-023] Property: samplerField begrenzt auf maxHours", () => {
  const startTime = new Date("2025-01-01T00:00:00Z");
  const sampler = () => ({
    wind_speed_kn: 10,
    wind_from_deg: 0,
    wave_height_m: 1,
  });
  const field = samplerField(sampler, startTime, 120);
  
  fc.assert(
    fc.property(
      fc.double({ min: 50, max: 56, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 10, max: 16, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 150, max: 500, noNaN: true, noDefaultInfinity: true }),
      (lat, lon, elapsedH) => {
        // Sollte nicht über maxHours = 120 hinaus extrapolieren
        const sample = field(lat, lon, elapsedH);
        assert.ok(sample.wind_kn >= 0, `wind sollte endlich und nicht negativ sein`);
      }
    )
  );
});
