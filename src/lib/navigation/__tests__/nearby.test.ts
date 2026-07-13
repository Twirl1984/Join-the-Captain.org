// Unit-Tests nächste Häfen (REQ-NAV-024). Lauf: node --import tsx --test …/nearby.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestHarbors, nearestRevier, nearestHarborsGlobal } from "../nearby";

const haefen = [
  { name: "Nah", lat: 54.0, lon: 13.0 },
  { name: "Mittel", lat: 54.3, lon: 13.0 },
  { name: "Fern", lat: 55.0, lon: 13.0 },
  { name: "Ost", lat: 54.0, lon: 13.5 },
];

test("[REQ-NAV-024] nearestHarbors sortiert nach Distanz und deckelt auf n", () => {
  const r = nearestHarbors({ lat: 54.0, lon: 13.0 }, haefen, 3);
  assert.equal(r.length, 3);
  assert.equal(r[0].name, "Nah");
  assert.equal(r[0].distance_nm, 0);
  assert.ok(r[0].distance_nm <= r[1].distance_nm && r[1].distance_nm <= r[2].distance_nm);
});

test("[REQ-NAV-024] bearing + Kompasspunkt stimmen grob (Norden/Osten)", () => {
  const r = nearestHarbors({ lat: 54.0, lon: 13.0 }, haefen, 4);
  const nord = r.find((h) => h.name === "Mittel")!;
  const ost = r.find((h) => h.name === "Ost")!;
  assert.ok(nord.bearing_deg < 10 || nord.bearing_deg > 350, `Nord ~0° (${nord.bearing_deg})`);
  assert.equal(nord.kompass, "N");
  assert.ok(Math.abs(ost.bearing_deg - 90) < 10, `Ost ~90° (${ost.bearing_deg})`);
});

test("[REQ-NAV-024] leere Hafenliste → leeres Ergebnis", () => {
  assert.deepEqual(nearestHarbors({ lat: 0, lon: 0 }, [], 3), []);
});

// ── nearestRevier / nearestHarborsGlobal (REQ-NAV-024) ──────────────────────
const reviere = [
  { id: "nordsee", label: "Nordsee", center: [54.0, 8.1] as [number, number],
    haefen: [{ name: "Cuxhaven", lat: 53.87, lon: 8.72 }, { name: "Helgoland", lat: 54.18, lon: 7.89 }] },
  { id: "brombachsee", label: "Brombachsee", center: [49.15, 10.95] as [number, number],
    haefen: [{ name: "Ramsberg", lat: 49.14, lon: 10.96 }, { name: "Absberg", lat: 49.16, lon: 10.98 }] },
];

test("[REQ-NAV-024] nearestRevier: bei Nürnberg gewinnt Brombachsee, nicht die Nordsee", () => {
  const nuernberg = { lat: 49.45, lon: 11.08 };
  const r = nearestRevier(nuernberg, reviere)!;
  assert.equal(r.id, "brombachsee");
});

test("[REQ-NAV-024] nearestHarborsGlobal liefert Häfen mit Revier-Label, positionsnah", () => {
  const nuernberg = { lat: 49.45, lon: 11.08 };
  const h = nearestHarborsGlobal(nuernberg, reviere, 3);
  assert.ok(h.length >= 1);
  assert.equal(h[0].revier, "Brombachsee");
  assert.ok(["Ramsberg", "Absberg"].includes(h[0].name));
});
