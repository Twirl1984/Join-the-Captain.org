// Unit-Tests für die Routen-Profile (REQ-NAV-019): kürzeste / Segel-schnell /
// Motor-schnell / Komfort (wenig Welle). Reine Logik, synthetische Maske+Feld.
// Lauf:  node --import tsx --test src/lib/navigation/__tests__/route-profiles.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMask } from "../watermask";
import { findSeaRoute } from "../searoute";
import { gridField, profileCosts, parseRouteProfil } from "../route-profiles";
import { DEFAULT_BOAT } from "../../weather/polar";

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
