// Unit-Tests GPX-Export (REQ-NAV-021). Lauf: node --import tsx --test …/gpx.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { gpxFromRoute } from "../gpx";

const pts = [
  { lat: 54.5121, lon: 13.6431, name: "Start" },
  { lat: 54.7, lon: 13.2, name: null },
  { lat: 54.952, lon: 12.464, name: "Ziel <Hafen> & Co" },
];

test("[REQ-NAV-021] GPX enthält alle Punkte als rtept mit Namen/Fallback", () => {
  const g = gpxFromRoute(pts);
  assert.equal((g.match(/<rtept /g) ?? []).length, 3);
  assert.ok(g.includes('lat="54.512100"'));
  assert.ok(g.includes("<name>Start</name>"));
  assert.ok(g.includes("<name>WP 2</name>"), "anonymer Punkt bekommt WP-Nummer");
});

test("[REQ-NAV-021] Sonderzeichen werden escaped, Disclaimer enthalten", () => {
  const g = gpxFromRoute(pts);
  assert.ok(g.includes("Ziel &lt;Hafen&gt; &amp; Co"));
  assert.ok(!g.includes("<Hafen>"));
  assert.ok(g.includes("ersetzt keine amtlichen Seekarten"));
});

test("[REQ-NAV-021] gültiger GPX-1.1-Rahmen", () => {
  const g = gpxFromRoute(pts);
  assert.ok(g.startsWith('<?xml version="1.0"'));
  assert.ok(g.includes('<gpx version="1.1"'));
  assert.ok(g.trimEnd().endsWith("</gpx>"));
});
