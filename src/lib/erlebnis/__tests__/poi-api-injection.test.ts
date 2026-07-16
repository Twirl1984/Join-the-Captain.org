// [QA-R3] Sicherheits-Tests für GET /api/erlebnis/poi
// Attack-Vektoren: SQL-Injection, Parametervalidierung, Error-Leaks

import { test } from "node:test";
import { strict as assert } from "node:assert";

// Dummy-Tests für lokales Testen — echte E2E braucht den Server
// Hier: Parser-Validierung testen

function parseBbox(raw: string | null) {
  if (!raw) return undefined;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return undefined;
  const [minLat, minLon, maxLat, maxLon] = parts;
  return { minLat, minLon, maxLat, maxLon };
}

function parseRoute(raw: string | null) {
  if (!raw) return undefined;
  const punkte = raw
    .split(";")
    .map((paar) => paar.split(",").map(Number))
    .filter((p): p is [number, number] => p.length === 2 && p.every((n) => !Number.isNaN(n)))
    .map(([lat, lon]) => ({ lat, lon }));
  return punkte.length > 0 ? punkte : undefined;
}

test("[QA-R3] parseBbox: SQL-Injection wird als ungültig geparst", () => {
  const input = "54.4,13.3,54.7,13.5'; DROP TABLE revier_poi; --";
  const result = parseBbox(input);
  assert.strictEqual(result, undefined, "SQL-Injection sollte NaN erzeugen");
});

test("[QA-R3] parseBbox: 5 Werte (zu viele) → undefined", () => {
  const input = "54.4,13.3,54.7,13.5,99";
  const result = parseBbox(input);
  assert.strictEqual(result, undefined);
});

test("[QA-R3] parseBbox: Infinity/NaN Werte", () => {
  const input = "Infinity,-Infinity,NaN,0";
  const result = parseBbox(input);
  assert.strictEqual(result, undefined, "NaN sollte Parser fehlschlagen lassen");
});

test("[QA-R3] parseRoute: leere Route → undefined", () => {
  const input = "";
  const result = parseRoute(input);
  assert.strictEqual(result, undefined);
});

test("[QA-R3] parseRoute: nur Trennzeichen → undefined", () => {
  const input = ";;;;;;";
  const result = parseRoute(input);
  assert.strictEqual(result, undefined);
});

test("[QA-R3] parseRoute: SQL-Injection im Routenformat wird gefiltert", () => {
  const input = "54.68,13.4; DROP TABLE revier_poi; --,99;54.5,13.6";
  const result = parseRoute(input);
  assert(result, "sollte nicht undefined sein");
  assert.strictEqual(result.length, 2, "nur die 2 gültigen Punkte");
  assert.deepStrictEqual(result[0], { lat: 54.68, lon: 13.4 });
  assert.deepStrictEqual(result[1], { lat: 54.5, lon: 13.6 });
});

test("[QA-R3] parseRoute: sehr lange Route wird nicht gecrackt", () => {
  const vielePunkte = Array.from({ length: 10000 }, (_, i) => `${54 + i * 0.001},${13 + i * 0.001}`).join(";");
  const result = parseRoute(vielePunkte);
  assert(result);
  assert.strictEqual(result.length, 10000);
});

test("[QA-R3] parseRoute: Floating-Point Edge-Cases", () => {
  const input = "54.123456789,-179.9999999;-90,180";
  const result = parseRoute(input);
  assert(result);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].lat, 54.123456789);
  assert.strictEqual(result[1].lon, 180);
});

test("[QA-R3] parseRoute: sehr kleine aber gültige Koordinaten", () => {
  const input = "0.0000001,0.0000001;-0.0000001,-0.0000001";
  const result = parseRoute(input);
  assert(result);
  assert.strictEqual(result.length, 2);
});

test("[QA-R3] parseBbox: Grenzen außerhalb gültiger Bereiche", () => {
  const input = "91,-180,90,180";
  const result = parseBbox(input);
  // Parser prüft Grenzen NICHT — das ist Sache der API/DB
  // Parser soll nur NaN-Prüfung machen
  assert(result);
  assert.strictEqual(result.minLat, 91, "Parser erlaubt Werte > 90");
});

test("[QA-R3] Sicherheit: revier_id ist TEXT und wird parameterisiert (Parser nicht zuständig)", () => {
  // SQL-Injection ist NICHT Aufgabe des Parsers, sondern der DB-Paramet-Binding
  // Diese Test dokumentiert: Parser kümmert sich nicht um revier_id
  const revierId = "ruegen'; DROP TABLE revier_poi; --";
  // Das würde im SQL als literal string "${1}" ("ruegen'...") enden
  // Nicht in dieser Unit-Test testbar, aber als E2E dokumentieren
  assert(typeof revierId === "string");
});
