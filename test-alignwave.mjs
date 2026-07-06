// Test: alignWave mit versetzten Gittern
function parseUtc(t) {
  let s = t;
  if (/T\d\d:\d\d$/.test(s)) s += ":00";
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s += "Z";
  return Date.parse(s);
}

function alignWave(atmoTimes, marineTimes, waves) {
  if (!marineTimes || !waves) return atmoTimes.map(() => null);
  const byTime = new Map();
  marineTimes.forEach((t, i) => byTime.set(parseUtc(t), waves[i] ?? null));
  return atmoTimes.map((t) => byTime.get(t) ?? null);
}

// Szenario 1: Exakte Übereinstimmung (aktueller Fall)
console.log("=== Szenario 1: Exakte Übereinstimmung ===");
const atmoTimes1 = [
  parseUtc("2025-01-01T00:00"),
  parseUtc("2025-01-01T01:00"),
  parseUtc("2025-01-01T02:00"),
];
const marineTimes1 = [
  "2025-01-01T00:00",
  "2025-01-01T01:00",
  "2025-01-01T02:00",
];
const waves1 = [0.5, 1.0, 1.5];
const result1 = alignWave(atmoTimes1, marineTimes1, waves1);
console.log("Atmo times:", atmoTimes1);
console.log("Marine times:", marineTimes1);
console.log("Waves:", waves1);
console.log("Result:", result1);
console.log("Expected: [0.5, 1.0, 1.5]");
console.log("All values matched:", result1.every((v, i) => v === waves1[i]));

// Szenario 2: 30-Minuten-Versatz (wie im Finding beschrieben)
console.log("\n=== Szenario 2: 30-Minuten-Versatz ===");
const atmoTimes2 = [
  parseUtc("2025-01-01T00:00"),
  parseUtc("2025-01-01T01:00"),
  parseUtc("2025-01-01T02:00"),
];
const marineTimes2 = [
  "2025-01-01T00:30",
  "2025-01-01T01:30",
  "2025-01-01T02:30",
];
const waves2 = [0.5, 1.0, 1.5];
const result2 = alignWave(atmoTimes2, marineTimes2, waves2);
console.log("Atmo times:", atmoTimes2);
console.log("Marine times (30 min versetzt):", marineTimes2);
console.log("Waves:", waves2);
console.log("Result:", result2);
console.log("Expected (was ist das?): Interpolation oder nearestNeighbor?");
console.log("What we actually got (all nulls?):", result2.every(v => v === null));

// Szenario 3: Leicht versetztes Raster (Real-World-Scenario)
console.log("\n=== Szenario 3: Real-World - Unterschiedliche Rasterungen ===");
const atmoTimes3 = [
  parseUtc("2025-01-01T00:00"),
  parseUtc("2025-01-01T01:00"),
  parseUtc("2025-01-01T02:00"),
];
const marineTimes3 = [
  "2025-01-01T00:15",  // nicht exakt T00:00
  "2025-01-01T01:15",  // nicht exakt T01:00
  "2025-01-01T02:15",  // nicht exakt T02:00
];
const waves3 = [0.5, 1.0, 1.5];
const result3 = alignWave(atmoTimes3, marineTimes3, waves3);
console.log("Atmo times:", atmoTimes3);
console.log("Marine times (15 min versetzt):", marineTimes3);
console.log("Waves:", waves3);
console.log("Result:", result3);
console.log("All nulls (mismatch):", result3.every(v => v === null));
