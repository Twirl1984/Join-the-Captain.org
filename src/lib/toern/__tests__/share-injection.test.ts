// [QA-R3] Sicherheits-Tests für POST /api/toern/share und Datenbankkonsistenz

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildShareSnapshot, generateShareId } from "../share";

test("[QA-R3] buildShareSnapshot: sehr lange revierId wird nicht gecrackt", () => {
  const longRevierId = "x".repeat(10000);
  const snapshot = buildShareSnapshot({
    revierId: longRevierId,
    punkte: [
      { lat: 54.68, lon: 13.4 },
      { lat: 54.5, lon: 13.6 },
    ],
    plan: {
      total_nm: 12.4,
      eta: "2026-07-15T14:00:00Z",
      warnings: [],
    },
  });
  assert.strictEqual(snapshot.revier_id, longRevierId, "lange Werte sollten akzeptiert werden");
});

test("[QA-R3] buildShareSnapshot: SQL-Injection-Payload in revierId wird als String gespeichert", () => {
  const injection = "ruegen'; DROP TABLE geteilter_toern; --";
  const snapshot = buildShareSnapshot({
    revierId: injection,
    punkte: [{ lat: 54.68, lon: 13.4 }],
    plan: {
      total_nm: 1,
      eta: "2026-07-15T10:00:00Z",
      warnings: [],
    },
  });
  assert.strictEqual(snapshot.revier_id, injection, "Injection bleibt als Literal-String");
  // Db-Binding wird es sicher speichern
});

test("[QA-R3] buildShareSnapshot: XSS in Highlight-Namen wird nicht escapt (Escaping Sache von React)", () => {
  const xss = "<script>alert('XSS')</script>";
  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: [{ lat: 54.68, lon: 13.4 }],
    plan: {
      total_nm: 1,
      eta: "2026-07-15T10:00:00Z",
      warnings: [],
    },
    highlights: [
      {
        name: xss,
        lat: 54.68,
        lon: 13.4,
        typ: "sehenswuerdigkeit",
      },
    ],
  });
  assert.strictEqual(snapshot.highlights_json?.[0]?.name, xss, "XSS wird 1:1 gespeichert");
  // UI sollte escapen (React default)
});

test("[QA-R3] buildShareSnapshot: Höchstlänge maxPunkte wird beachtet", () => {
  const punkte100 = Array.from({ length: 100 }, (_, i) => ({
    lat: 54.5 + i * 0.01,
    lon: 13.5 + i * 0.01,
  }));

  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: punkte100,
    plan: {
      total_nm: 100,
      eta: "2026-07-15T10:00:00Z",
      warnings: [],
    },
    maxPunkte: 10,
  });

  assert.strictEqual(snapshot.punkte_json.length, 10, "Sollte auf maxPunkte=10 gekürzt sein");
  assert.deepStrictEqual(
    snapshot.punkte_json[0],
    { lat: punkte100[0].lat, lon: punkte100[0].lon, name: null },
    "Start wird behalten"
  );
  assert.deepStrictEqual(
    snapshot.punkte_json[snapshot.punkte_json.length - 1],
    { lat: punkte100[99].lat, lon: punkte100[99].lon, name: null },
    "Ende wird behalten"
  );
});

test("[QA-R3] buildShareSnapshot: maxPunkte > array.length wird nicht geändert", () => {
  const punkte5 = Array.from({ length: 5 }, (_, i) => ({
    lat: 54.5 + i * 0.01,
    lon: 13.5 + i * 0.01,
  }));

  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: punkte5,
    plan: {
      total_nm: 5,
      eta: "2026-07-15T10:00:00Z",
      warnings: [],
    },
    maxPunkte: 100,
  });

  assert.strictEqual(snapshot.punkte_json.length, 5, "Sollte nicht vergrößert werden");
});

test("[QA-R3] generateShareId: Länge ist IMMER 8 Zeichen", () => {
  for (let i = 0; i < 100; i++) {
    const id = generateShareId();
    assert.strictEqual(id.length, 8, `Iteration ${i}: ID sollte 8 Zeichen sein`);
  }
});

test("[QA-R3] generateShareId: nutzt NUR base36-Alphabet", () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 1000; i++) {
    const id = generateShareId();
    for (const char of id) {
      assert(alphabet.includes(char), `Ungültiges Zeichen '${char}' in ID '${id}'`);
    }
  }
});

test("[QA-R3] generateShareId: Großbuchstaben sind NICHT erlaubt", () => {
  for (let i = 0; i < 1000; i++) {
    const id = generateShareId();
    assert(!id.match(/[A-Z]/), `ID '${id}' enthält Großbuchstaben`);
  }
});

test("[QA-R3] generateShareId: Sonderzeichen sind NICHT erlaubt", () => {
  for (let i = 0; i < 1000; i++) {
    const id = generateShareId();
    assert(!id.match(/[^a-z0-9]/), `ID '${id}' enthält Sonderzeichen`);
  }
});

test("[QA-R3] generateShareId mit injiziertem Zufall: deterministisch bei seed=0.5", () => {
  const zufall = () => 0.5;
  const id = generateShareId(zufall);
  // 0.5 * 36 = 18 → 's' (18. Index im Alphabet)
  assert.strictEqual(id, "ssssssss", "Deterministische Zufall sollte 'ssssssss' geben");
});

test("[QA-R3] buildShareSnapshot: highlights mit leerer liste → null (nicht leeres array)", () => {
  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: [{ lat: 54.68, lon: 13.4 }],
    plan: {
      total_nm: 1,
      eta: "2026-07-15T10:00:00Z",
      warnings: [],
    },
    highlights: [],
  });
  assert.strictEqual(snapshot.highlights_json, null, "Leere Highlights sollten null sein");
});

test("[QA-R3] buildShareSnapshot: highlights=undefined → null", () => {
  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: [{ lat: 54.68, lon: 13.4 }],
    plan: {
      total_nm: 1,
      eta: "2026-07-15T10:00:00Z",
      warnings: [],
    },
  });
  assert.strictEqual(snapshot.highlights_json, null);
});

test("[QA-R3] buildShareSnapshot: maxPunkte wird Default korrekt gesetzt", () => {
  const punkte70 = Array.from({ length: 70 }, (_, i) => ({
    lat: 54.5 + i * 0.01,
    lon: 13.5 + i * 0.01,
  }));

  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: punkte70,
    plan: {
      total_nm: 70,
      eta: "2026-07-15T10:00:00Z",
      warnings: [],
    },
    // maxPunkte nicht gesetzt, sollte default zu 60
  });

  assert.strictEqual(snapshot.punkte_json.length, 60, "Default maxPunkte sollte 60 sein");
});

test("[QA-R3] buildShareSnapshot: Punkte-Namen werden korrekt mapped (undefined → null)", () => {
  const punkte = [
    { lat: 54.68, lon: 13.4, name: "Start" },
    { lat: 54.5, lon: 13.6 }, // keine name property
    { lat: 54.3, lon: 13.7, name: undefined },
  ];

  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte,
    plan: {
      total_nm: 1,
      eta: "2026-07-15T10:00:00Z",
      warnings: [],
    },
  });

  assert.strictEqual(snapshot.punkte_json[0].name, "Start");
  assert.strictEqual(snapshot.punkte_json[1].name, null, "undefined → null");
  assert.strictEqual(snapshot.punkte_json[2].name, null);
});
