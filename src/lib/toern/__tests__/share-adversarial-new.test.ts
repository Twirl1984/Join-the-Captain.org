// [QA-ROUND-4] Neue aggressive Tests für Toern-Share
// Tests auf ID-Kollisionen, URL-Sicherheit, Daten-Integrität

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { generateShareId, buildShareSnapshot } from "../share";

// Test: generateShareId() mit kontrolliertem Zufall (Deterministik)
test("[QA-R4] generateShareId: Seed=0.5 ist immer deterministisch", () => {
  for (let i = 0; i < 100; i++) {
    // Injiziere Seed 0.5 manuell für Deterministik
    const id1 = generateShareId(() => 0.5);
    const id2 = generateShareId(() => 0.5);
    assert.strictEqual(id1, id2, `Deterministische ID bei Seed 0.5 sollte gleich sein`);
  }
});

// Test: generateShareId() uniqueness über viele Iterationen
test("[QA-R4] generateShareId: 10000 IDs sind (sehr wahrscheinlich) eindeutig", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 10000; i++) {
    const id = generateShareId();
    ids.add(id);
  }

  // Mit base36^8 sind ~2.6 Billionen mögliche IDs
  // 10000 Kollisionen wären äußerst unwahrscheinlich
  assert.strictEqual(
    ids.size,
    10000,
    "10000 IDs sollten alle eindeutig sein (keine Kollisionen)"
  );
});

// Test: Share-ID-Format (exakt 8 Zeichen, lowercase, nur Zahlen + Buchstaben)
test("[QA-R4] generateShareId: Format-Validierung (8 chars, base36)", () => {
  for (let i = 0; i < 1000; i++) {
    const id = generateShareId();

    assert.strictEqual(id.length, 8, `ID sollte 8 Zeichen sein, hat ${id.length}`);
    assert.ok(/^[0-9a-z]{8}$/.test(id), `ID "${id}" sollte nur [0-9a-z] sein`);

    // Kein Großbuchstabe
    assert.strictEqual(
      id,
      id.toLowerCase(),
      `ID sollte lowercase sein, hat aber "${id}"`
    );
  }
});

// Test: buildShareSnapshot mit null-Parametern
test("[QA-R4] buildShareSnapshot: null revierId wird als null beibehalten", () => {
  const snapshot = buildShareSnapshot({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    revierId: null as any, // Force null
    punkte: [{ lat: 54, lon: 13, name: "Start" }],
    plan: { total_nm: 10, eta: "2026-07-16T10:00:00Z", warnings: [] },
  });

  // revier_id sollte null oder undefined sein (oder gecatcht)
  // Aber nicht die ID von einem anderen Revier
  assert.ok(snapshot.revier_id === null || snapshot.revier_id === undefined);
});

// Test: buildShareSnapshot mit extrem langen Namen
test("[QA-R4] buildShareSnapshot: 50MB lange Punkte-Namen sollten nicht die Snapshot-Größe sprengen", () => {
  const hugeString = "X".repeat(50 * 1024 * 1024); // 50MB
  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: [
      { lat: 54, lon: 13, name: hugeString },
      { lat: 54.1, lon: 13.1 },
    ],
    plan: { total_nm: 10, eta: "2026-07-16T10:00:00Z", warnings: [] },
  });

  // Die Snapshot-Größe sollte NICHT 50MB sein, sondern deutlich gekürzt
  const snapshotSize = JSON.stringify(snapshot).length;
  console.log(
    `[QA-R4] Snapshot mit 50MB-Namen: ${(snapshotSize / 1024 / 1024).toFixed(2)}MB`
  );

  // Wenn die Snapshot-Größe > 10MB ist, könnte das ein DoS-Vektor sein
  if (snapshotSize > 10 * 1024 * 1024) {
    throw new Error(
      `FINDING: buildShareSnapshot mit 50MB-Namen erzeugt ${(snapshotSize / 1024 / 1024).toFixed(2)}MB Snapshot — DoS-Risiko!`
    );
  }
});

// Test: buildShareSnapshot mit extrem vielen Highlights
test("[QA-R4] buildShareSnapshot: 100k Highlights werden gekürzt oder verworfen", () => {
  const highlights = Array.from({ length: 100000 }, (_, i) => ({
    name: `Highlight ${i}`,
    lat: 54.0 + (i * 0.0001),
    lon: 13.0 + (i * 0.0001),
    typ: "sehenswuerdigkeit" as const,
  }));

  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: [{ lat: 54, lon: 13 }],
    plan: { total_nm: 10, eta: "2026-07-16T10:00:00Z", warnings: [] },
    highlights,
  });

  // Snapshot-Größe sollte vernünftig bleiben (<5MB)
  const size = JSON.stringify(snapshot).length;
  console.log(`[QA-R4] Snapshot mit 100k Highlights: ${(size / 1024 / 1024).toFixed(2)}MB`);

  if (size > 5 * 1024 * 1024) {
    throw new Error(
      `FINDING: buildShareSnapshot mit 100k Highlights erzeugt ${(size / 1024 / 1024).toFixed(2)}MB — DoS-Risiko!`
    );
  }
});

// Test: buildShareSnapshot mit Sonderzeichen in revierId (kein SQL-Injection)
test("[QA-R4] buildShareSnapshot: revierId mit SQL-Injection-Payload", () => {
  const maliciousRevier = "ruegen'; DROP TABLE toern_share; --";
  const snapshot = buildShareSnapshot({
    revierId: maliciousRevier,
    punkte: [{ lat: 54, lon: 13, name: "Start" }],
    plan: { total_nm: 10, eta: "2026-07-16T10:00:00Z", warnings: [] },
  });

  // Der revier_id sollte LITERAL als String gespeichert sein, nicht ausgeführt
  assert.strictEqual(
    snapshot.revier_id,
    maliciousRevier,
    "revier_id sollte literal als String sein"
  );

  // Das ist ok — SQL-Injection ist Sache des DB-Param-Binding, nicht des buildShareSnapshot
});

// Test: Share-Snapshot mit XSS in Namen
test("[QA-R4] buildShareSnapshot: XSS-Payload in Punkt-Namen wird nicht escapt", () => {
  const xssPayload = "<script>alert('XSS')</script>";
  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: [{ lat: 54, lon: 13, name: xssPayload }],
    plan: { total_nm: 10, eta: "2026-07-16T10:00:00Z", warnings: [] },
  });

  // buildShareSnapshot sollte NICHT html-escappen
  // Das ist Sache von React beim Rendern (React escapt per default)
  // Aber dokumentiere: der XSS-Payload ist literal im JSON
  assert.ok(
    JSON.stringify(snapshot).includes(xssPayload),
    "XSS-Payload sollte literal im JSON sein"
  );
  console.log(
    "[QA-R4] XSS in Namen wird nicht escapt (React ist verantwortlich) ✓"
  );
});

// Test: maxPunkte=1 mit 2 Eingabepunkten
test("[QA-R4] buildShareSnapshot: maxPunkte=1 mit 2 Eingabe-Punkten", () => {
  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: [
      { lat: 54.0, lon: 13.0, name: "Start" },
      { lat: 54.5, lon: 13.5, name: "End" },
    ],
    plan: { total_nm: 10, eta: "2026-07-16T10:00:00Z", warnings: [] },
    highlights: [],
    maxPunkte: 1,
  });

  // Mit maxPunkte=1 und 2 Eingabepunkten: sollte 1 Punkt sein
  // (Die Implementierung entscheidet, ob Start oder End beibehalten wird)
  console.log(`[QA-R4] maxPunkte=1, 2 Eingabepunkte → ${snapshot.punkte_json.length} Punkte`);

  // Das ist möglicherweise ein Edge Case, der dokumentiert sein sollte
  assert.ok(snapshot.punkte_json.length <= 1, "maxPunkte=1 sollte <= 1 Punkt geben");
});

// Test: warnings.length > 100 (großer Plan)
test("[QA-R4] buildShareSnapshot: Plan mit 1000 Warnungen", () => {
  const warnings = Array.from({ length: 1000 }, (_, i) =>
    `Warnung ${i}: Das ist eine lange Warnmeldung, um Speicher zu sprengen`
  );

  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: [{ lat: 54, lon: 13 }],
    plan: {
      total_nm: 10,
      eta: "2026-07-16T10:00:00Z",
      warnings,
    },
  });

  const size = JSON.stringify(snapshot).length;
  console.log(
    `[QA-R4] Snapshot mit 1000 Warnungen: ${(size / 1024).toFixed(2)}KB`
  );

  // Sollte nicht krank groß werden
  if (size > 500 * 1024) {
    console.warn(
      `[QA-R4] WARNING: 1000 Warnungen → ${(size / 1024).toFixed(2)}KB`
    );
  }
});

// Test: Punkte mit null-Namen
test("[QA-R4] buildShareSnapshot: Punkte mit undefined name → null im JSON", () => {
  const snapshot = buildShareSnapshot({
    revierId: "ruegen",
    punkte: [
      { lat: 54.0, lon: 13.0 }, // Kein name
      { lat: 54.5, lon: 13.5, name: undefined },
    ],
    plan: { total_nm: 10, eta: "2026-07-16T10:00:00Z", warnings: [] },
  });

  // Alle names sollten null sein (nicht undefined, nicht leer-string)
  for (const p of snapshot.punkte_json) {
    assert.strictEqual(
      p.name,
      null,
      `name sollte null sein, ist aber ${JSON.stringify(p.name)}`
    );
  }
});
