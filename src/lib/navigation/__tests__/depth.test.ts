// Unit-Tests für den Tiefen-Adapter (depth.ts) — TDD: zuerst geschrieben.
// Lauf: node --import tsx --test src/lib/navigation/__tests__/depth.test.ts
//
// Quelle 1: EMODnet Bathymetry REST (Europa, ~115 m, CC-BY 4.0).
// Fallback:  GEBCO via OpenTopoData (global, grob).
// fetch wird injiziert -> Tests laufen komplett offline.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchDepth, fetchRouteDepths, flachwasserCheck } from "../depth";

type FetchLike = (url: string) => Promise<Response>;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("[REQ-NAV-003] fetchDepth: EMODnet liefert avg<0 -> positive Tiefe in Metern", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    return jsonResponse({ avg: -17.4, min: -19, max: -15 });
  };
  const d = await fetchDepth(54.5, 13.2, { fetchImpl });
  assert.equal(d.source, "emodnet");
  assert.equal(d.depth_m, 17.4);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("emodnet"), `EMODnet-URL erwartet, war: ${calls[0]}`);
  // WKT ist POINT(lon lat) — Verwechslung wäre ein klassischer Karten-Bug.
  assert.ok(calls[0].includes(encodeURIComponent("POINT(13.2 54.5)")), calls[0]);
});

test("[REQ-NAV-003] fetchDepth: EMODnet avg>=0 (Land) -> depth_m null, kein Fallback nötig", async () => {
  const d = await fetchDepth(52, 10, {
    fetchImpl: async () => jsonResponse({ avg: 42.0 }),
  });
  assert.equal(d.depth_m, null);
  assert.equal(d.source, "emodnet");
});

test("[REQ-NAV-003] fetchDepth: EMODnet down -> GEBCO-Fallback (elevation<0 -> Tiefe)", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    if (url.includes("emodnet")) return jsonResponse({ error: "kaputt" }, 503);
    return jsonResponse({ results: [{ elevation: -230.7 }] });
  };
  const d = await fetchDepth(39.5, 2.6, { fetchImpl });
  assert.equal(d.source, "gebco");
  assert.equal(d.depth_m, 230.7);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes("39.5,2.6"), `GEBCO erwartet lat,lon: ${calls[1]}`);
});

test("[REQ-NAV-003] fetchDepth: beide Quellen down -> Fehler (kein stilles null)", async () => {
  await assert.rejects(
    fetchDepth(39.5, 2.6, { fetchImpl: async () => jsonResponse({}, 500) }),
    /Tiefendaten/,
  );
});

test("[REQ-NAV-003] fetchDepth: validiert Koordinaten", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ avg: -5 });
  await assert.rejects(fetchDepth(91, 0, { fetchImpl }), /Koordinaten/);
  await assert.rejects(fetchDepth(0, 181, { fetchImpl }), /Koordinaten/);
  await assert.rejects(fetchDepth(Number.NaN, 0, { fetchImpl }), /Koordinaten/);
});

test("[REQ-NAV-003] fetchRouteDepths: eine Abfrage je Punkt, Reihenfolge bleibt erhalten", async () => {
  const fetchImpl: FetchLike = async (url) => {
    // Tiefe aus der lat kodieren, damit die Zuordnung prüfbar ist.
    const m = decodeURIComponent(url).match(/POINT\([\d.]+ ([\d.]+)\)/);
    const lat = m ? Number(m[1]) : 0;
    return jsonResponse({ avg: -lat });
  };
  const ds = await fetchRouteDepths(
    [
      { lat: 10, lon: 1 },
      { lat: 20, lon: 2 },
      { lat: 30, lon: 3 },
    ],
    { fetchImpl },
  );
  assert.deepEqual(
    ds.map((d) => d.depth_m),
    [10, 20, 30],
  );
});

test("[REQ-NAV-003] flachwasserCheck: gefahr / knapp / ok / unbekannt", () => {
  // Tiefgang 1.8 m, Sicherheitsmarge default 0.5 m.
  assert.equal(flachwasserCheck(1.7, 1.8), "gefahr"); // flacher als Tiefgang
  assert.equal(flachwasserCheck(1.8, 1.8), "gefahr"); // exakt = aufsetzen
  assert.equal(flachwasserCheck(2.1, 1.8), "knapp"); // unter Tiefgang+Marge
  assert.equal(flachwasserCheck(2.31, 1.8), "ok");
  assert.equal(flachwasserCheck(null, 1.8), "unbekannt");
  // Eigene Marge:
  assert.equal(flachwasserCheck(2.7, 1.8, 1.0), "knapp");
  assert.equal(flachwasserCheck(2.9, 1.8, 1.0), "ok");
});

test("[REQ-NAV-012] Tide-Verrechnung: Niedrigwasser kippt den Flachwasser-Status", () => {
  // Karte 2.6 m, Niedrigstwasser −0.9 m → effektiv 1.7 m bei 1.8 m Tiefgang = GEFAHR.
  assert.equal(flachwasserCheck(2.6 + -0.9, 1.8), "gefahr");
  // Ohne Tide wäre es ok (2.6 > 1.8 + 0.5).
  assert.equal(flachwasserCheck(2.6, 1.8), "ok");
  // Hochwasser (+0.8) entspannt eine knappe Stelle.
  assert.equal(flachwasserCheck(2.2 + 0.8, 1.8), "ok");
});

// === Mutation-Härtung: Koordinaten-Grenzen ===

test("[REQ-NAV-003] fetchDepth: lehnt ungültige Breitengerade > 90 ab", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ avg: -5 });
  // Grenzfälle: Mutant "Math.abs(lat) >= 90" würde auch 90.1 akzeptieren; Original ">" lehnt es ab.
  await assert.rejects(fetchDepth(90.1, 0, { fetchImpl }), /Koordinaten/);
  await assert.rejects(fetchDepth(-90.1, 0, { fetchImpl }), /Koordinaten/);
  // Aber 90 und 89.999... sollte ok sein.
  const d = await fetchDepth(90.0, 0, { fetchImpl });
  assert.equal(d.depth_m, 5);
  const d2 = await fetchDepth(89.999, 0, { fetchImpl });
  assert.equal(d2.depth_m, 5);
});

test("[REQ-NAV-003] fetchDepth: lehnt ungültigen Längengrad > 180 ab", async () => {
  const fetchImpl: FetchLike = async () => jsonResponse({ avg: -5 });
  // Grenzfälle: Mutant "Math.abs(lon) >= 180" würde auch 180.1 akzeptieren; Original ">" lehnt es ab.
  await assert.rejects(fetchDepth(0, 180.1, { fetchImpl }), /Koordinaten/);
  await assert.rejects(fetchDepth(0, -180.1, { fetchImpl }), /Koordinaten/);
  // Aber 180 und 179.999... sollte ok sein.
  const d = await fetchDepth(0, 180.0, { fetchImpl });
  assert.equal(d.depth_m, 5);
  const d2 = await fetchDepth(0, 179.999, { fetchImpl });
  assert.equal(d2.depth_m, 5);
});

// === Mutation-Härtung: EMODnet avg-Validierung ===

test("[REQ-NAV-003] fetchDepth: EMODnet mit avg=0 (exakt Null=Land) -> depth_m null", async () => {
  // Mutant "body.avg <= 0" würde 0 als Tiefe nehmen; Original "< 0" lehnt es ab.
  const d = await fetchDepth(54.5, 13.2, {
    fetchImpl: async () => jsonResponse({ avg: 0 }),
  });
  assert.equal(d.depth_m, null, "avg=0 ist Land, sollte null sein");
  assert.equal(d.source, "emodnet");
});

test("[REQ-NAV-003] fetchDepth: EMODnet mit avg=NaN -> Fallback zu GEBCO", async () => {
  // Mutant "typeof body.avg === 'number' || ..." würde NaN akzeptieren;
  // Original "&& Number.isFinite" lehnt NaN korrekt ab.
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    if (url.includes("emodnet")) return jsonResponse({ avg: NaN });
    return jsonResponse({ results: [{ elevation: -50 }] });
  };
  const d = await fetchDepth(54, 13, { fetchImpl });
  assert.equal(d.source, "gebco", "NaN bei EMODnet sollte zu GEBCO fallback");
  assert.equal(d.depth_m, 50);
  assert.equal(calls.length, 2);
});

test("[REQ-NAV-003] fetchDepth: EMODnet mit avg=undefined -> Fallback zu GEBCO", async () => {
  // Validiert, dass typeof-Check + isFinite zusammen arbeiten.
  const fetchImpl: FetchLike = async (url) => {
    if (url.includes("emodnet")) return jsonResponse({ avg: undefined });
    return jsonResponse({ results: [{ elevation: -30 }] });
  };
  const d = await fetchDepth(50, 10, { fetchImpl });
  assert.equal(d.source, "gebco");
  assert.equal(d.depth_m, 30);
});

test("[REQ-NAV-003] fetchDepth: EMODnet avg ist String -> Fallback zu GEBCO", async () => {
  const fetchImpl: FetchLike = async (url) => {
    if (url.includes("emodnet")) return jsonResponse({ avg: "not a number" });
    return jsonResponse({ results: [{ elevation: -20 }] });
  };
  const d = await fetchDepth(50, 10, { fetchImpl });
  assert.equal(d.source, "gebco");
});

test("[REQ-NAV-003] fetchDepth: EMODnet mit res.ok=false (aber body vorhanden) -> GEBCO-Fallback", async () => {
  // Mutant "if (res.ok) -> true" würde auch !ok akzeptieren.
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    if (url.includes("emodnet")) {
      // Status 404, aber JSON vorhanden (sollte nicht verarbeitet werden)
      return jsonResponse({ avg: -999 }, 404);
    }
    return jsonResponse({ results: [{ elevation: -40 }] });
  };
  const d = await fetchDepth(50, 10, { fetchImpl });
  assert.equal(d.source, "gebco", "res.ok=false sollte ignoriert werden");
  assert.equal(d.depth_m, 40);
  assert.equal(calls.length, 2);
});

// === Mutation-Härtung: GEBCO elevation-Validierung ===

test("[REQ-NAV-003] fetchDepth: GEBCO mit elev=0 (exakt Null=Land) -> depth_m null", async () => {
  // Mutant "elev <= 0" würde 0 als Tiefe nehmen; Original "< 0" lehnt es ab.
  const d = await fetchDepth(39, 2, {
    fetchImpl: async () => jsonResponse({ results: [{ elevation: 0 }] }),
  });
  assert.equal(d.depth_m, null, "elevation=0 ist Land");
  assert.equal(d.source, "gebco");
});

test("[REQ-NAV-003] fetchDepth: GEBCO mit elev=NaN -> wirft Fehler", async () => {
  // Mutant "typeof elev === 'number' || ..." würde NaN akzeptieren.
  await assert.rejects(
    fetchDepth(39, 2, {
      fetchImpl: async (url) => {
        if (url.includes("gebco")) return jsonResponse({ results: [{ elevation: NaN }] });
        return jsonResponse({}, 503); // EMODnet auch down
      },
    }),
    /Tiefendaten/,
  );
});

test("[REQ-NAV-003] fetchDepth: GEBCO mit elev=undefined -> wirft Fehler", async () => {
  await assert.rejects(
    fetchDepth(39, 2, {
      fetchImpl: async (url) => {
        if (url.includes("gebco")) return jsonResponse({ results: [{ elevation: undefined }] });
        return jsonResponse({}, 503);
      },
    }),
    /Tiefendaten/,
  );
});

test("[REQ-NAV-003] fetchDepth: GEBCO mit res.ok=false (aber body vorhanden) -> wirft Fehler", async () => {
  // Mutant "if (res.ok) -> true" würde auch !ok bei GEBCO akzeptieren.
  await assert.rejects(
    fetchDepth(39, 2, {
      fetchImpl: async (url) => {
        if (url.includes("emodnet")) return jsonResponse({}, 503);
        return jsonResponse({ results: [{ elevation: -50 }] }, 500); // GEBCO auch !ok
      },
    }),
    /Tiefendaten/,
  );
});

test("[REQ-NAV-003] fetchDepth: GEBCO results=null -> wirft Fehler", async () => {
  // Mutant "body.results?.[0]?.elevation" ohne `?` würde crashes/falsch verarbeiten.
  await assert.rejects(
    fetchDepth(39, 2, {
      fetchImpl: async (url) => {
        if (url.includes("emodnet")) return jsonResponse({}, 503);
        return jsonResponse({ results: null });
      },
    }),
    /Tiefendaten/,
  );
});

test("[REQ-NAV-003] fetchDepth: GEBCO results=[] (leeres Array) -> wirft Fehler", async () => {
  await assert.rejects(
    fetchDepth(39, 2, {
      fetchImpl: async (url) => {
        if (url.includes("emodnet")) return jsonResponse({}, 503);
        return jsonResponse({ results: [] });
      },
    }),
    /Tiefendaten/,
  );
});

// === Mutation-Härtung: flachwasserCheck Grenzen ===

test("[REQ-NAV-003] flachwasserCheck: exakte Grenzen für Tiefgang und Marge", () => {
  // Mutant "depth_m < tiefgang_m + marge_m" → "<=" würde grenzfälle anders klassifizieren.
  const tiefgang = 1.5;
  const marge = 0.5;

  // Exakt an der Marge-Schwelle: sollte noch "knapp" sein.
  assert.equal(flachwasserCheck(2.0, tiefgang, marge), "knapp", "depth=tiefgang+marge sollte knapp sein");

  // Knapp oberhalb: sollte "ok" sein.
  assert.equal(flachwasserCheck(2.01, tiefgang, marge), "ok", "depth>tiefgang+marge sollte ok sein");

  // Knapp darunter: sollte noch "knapp" sein.
  assert.equal(flachwasserCheck(1.99, tiefgang, marge), "knapp", "depth<tiefgang+marge sollte knapp sein");

  // Exakt Tiefgang: sollte "gefahr" sein.
  assert.equal(flachwasserCheck(1.5, tiefgang, marge), "gefahr", "depth=tiefgang sollte gefahr sein");

  // Knapp oberhalb Tiefgang: sollte "knapp" sein.
  assert.equal(flachwasserCheck(1.51, tiefgang, marge), "knapp", "depth>tiefgang sollte knapp/ok sein");
});

test("[REQ-NAV-003] flachwasserCheck: null und nicht-finite Werte unterscheiden (LogicalOperator-Mutant)", () => {
  // Mutant "depth_m == null && !Number.isFinite(depth_m)" würde null und non-finite unterscheiden;
  // Original "== null || !Number.isFinite" vereint sie.
  assert.equal(flachwasserCheck(null, 1.8), "unbekannt", "null sollte unbekannt sein");
  assert.equal(flachwasserCheck(NaN, 1.8), "unbekannt", "NaN sollte auch unbekannt sein");
  // Infinity sollte auch unbekannt sein
  assert.equal(flachwasserCheck(Infinity, 1.8), "unbekannt", "Infinity sollte unbekannt sein");
  assert.equal(flachwasserCheck(-Infinity, 1.8), "unbekannt", "-Infinity sollte unbekannt sein");
});

test("[REQ-NAV-003] flachwasserCheck: benutzerdefinierte Margen werden respektiert", () => {
  // Zusätzliche Absicherung für marge_m=0 (extreme Sicherheit).
  assert.equal(flachwasserCheck(1.8, 1.8, 0), "gefahr", "depth=tiefgang mit marge=0");
  assert.equal(flachwasserCheck(1.81, 1.8, 0), "ok", "depth>tiefgang mit marge=0");

  // Marge=2.0 (großzügig).
  assert.equal(flachwasserCheck(3.8, 1.8, 2.0), "knapp");
  assert.equal(flachwasserCheck(3.81, 1.8, 2.0), "ok");
});

test("[REQ-NAV-003] fetchRouteDepths: mehrere Punkte mit unterschiedlichen Tiefen", async () => {
  // Zusätzliche Absicherung: Reihenfolge bleibt, auch wenn Tiefen gleich sind.
  const fetchImpl: FetchLike = async (url) => {
    const m = decodeURIComponent(url).match(/POINT\(([\d.]+) ([\d.]+)\)/);
    if (!m) return jsonResponse({});
    const lon = Number(m[1]);
    // Return unterschiedliche Tiefen je nach Position.
    if (lon === 1) return jsonResponse({ avg: -10 });
    if (lon === 2) return jsonResponse({ avg: -20 });
    if (lon === 3) return jsonResponse({ avg: -30 });
    return jsonResponse({});
  };
  const ds = await fetchRouteDepths(
    [
      { lat: 50, lon: 1 },
      { lat: 51, lon: 2 },
      { lat: 52, lon: 3 },
    ],
    { fetchImpl },
  );
  assert.equal(ds.length, 3);
  assert.deepEqual(ds.map((d) => d.depth_m), [10, 20, 30]);
  // Quellen sollten alle emodnet sein
  assert.ok(ds.every((d) => d.source === "emodnet"));
});

test("[REQ-NAV-003] fetchDepth: Rounding 1-Dezimal (round1) wird angewendet", async () => {
  // Test-Absicherung: -12.34 → 12.3, -12.35 → 12.4, -12.44 → 12.4.
  const testCases = [
    { avg: -12.34, expected: 12.3 },
    { avg: -12.35, expected: 12.4 },
    { avg: -12.44, expected: 12.4 },
    { avg: -12.45, expected: 12.5 },
  ];
  for (const tc of testCases) {
    const d = await fetchDepth(54, 13, {
      fetchImpl: async () => jsonResponse({ avg: tc.avg }),
    });
    assert.equal(d.depth_m, tc.expected, `avg=${tc.avg} sollte ${tc.expected} sein`);
  }
});

test("[REQ-NAV-003] fetchDepth: EMODnet WKT-Koordinaten-Reihenfolge POINT(lon lat)", async () => {
  // Direkter Test für Argument-Swap-Mutanten: WKT ist POINT(lon lat), nicht POINT(lat lon).
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    return jsonResponse({ avg: -5 });
  };
  // fetchDepth(lat=55, lon=10) sollte POINT(10 55) erzeugen.
  await fetchDepth(55, 10, { fetchImpl });
  assert.equal(calls.length, 1);
  const decoded = decodeURIComponent(calls[0]);
  assert.ok(decoded.includes("POINT(10 55)"), `Expected POINT(10 55), got: ${decoded}`);
});

test("[REQ-NAV-003] fetchDepth: GEBCO Koordinaten-Reihenfolge lat,lon", async () => {
  // GEBCO nutzt ?locations=lat,lon Format.
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    if (url.includes("emodnet")) return jsonResponse({}, 503);
    return jsonResponse({ results: [{ elevation: -10 }] });
  };
  // fetchDepth(lat=39.5, lon=2.6)
  await fetchDepth(39.5, 2.6, { fetchImpl });
  assert.equal(calls.length, 2);
  const gebcoUrl = calls[1];
  assert.ok(gebcoUrl.includes("39.5,2.6"), `GEBCO sollte 39.5,2.6 haben, got: ${gebcoUrl}`);
});

// === Zusätzliche Mutation-Härtung für kritische Edge-Cases ===

test("[REQ-NAV-003] fetchDepth: typeof-Check für avg ist strikt (nicht nur 'number')", async () => {
  // Mutant "typeof body.avg === 'number' || Number.isFinite" würde ein 'number' ISO akzeptieren
  // Original: && Number.isFinite lehnt NaN strict ab.
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    if (url.includes("emodnet")) {
      return jsonResponse({ avg: "12" }); // String, kein number
    }
    return jsonResponse({ results: [{ elevation: -50 }] });
  };
  const d = await fetchDepth(54, 13, { fetchImpl });
  assert.equal(d.source, "gebco", "String-avg sollte zu GEBCO Fallback");
  assert.equal(calls.length, 2, "sollte beide APIs abfragen");
});

test("[REQ-NAV-003] fetchDepth: typeof-Check für elev ist strikt bei GEBCO", async () => {
  // Mutant "typeof elev === 'number' || Number.isFinite" würde '12' akzeptieren
  // Original: && Number.isFinite lehnt es ab.
  await assert.rejects(
    fetchDepth(39, 2, {
      fetchImpl: async (url) => {
        if (url.includes("emodnet")) return jsonResponse({}, 503);
        return jsonResponse({ results: [{ elevation: "50" }] }); // String
      },
    }),
    /Tiefendaten/,
    "String-elevation sollte wirft fehler",
  );
});

test("[REQ-NAV-003] fetchDepth: Fehler wenn EMODnet throws UND GEBCO throws", async () => {
  // Mutant "if (res.ok) -> true" bei beiden würde auch Fehler ignorieren
  // Original: catch block springt zum Fallback oder wirft am Ende.
  let emodnetCalls = 0;
  let gebcoCalls = 0;
  await assert.rejects(
    fetchDepth(54, 13, {
      fetchImpl: async (url) => {
        if (url.includes("emodnet")) {
          emodnetCalls++;
          throw new Error("emodnet network error");
        } else {
          gebcoCalls++;
          throw new Error("gebco network error");
        }
      },
    }),
    /Tiefendaten/,
  );
  assert.equal(emodnetCalls, 1, "EMODnet sollte versucht werden");
  assert.equal(gebcoCalls, 1, "GEBCO sollte nach EMODnet-Fehler versucht werden");
});

test("[REQ-NAV-003] fetchDepth: results undefined sollte GEBCO-Fehler auslösen", async () => {
  // Mutant "body.results?.[0]?.elevation" → "body.results[0]" würde Fehler bei undefined
  // Original: optional chaining lehnt es sauber ab (undefined -> falsy).
  await assert.rejects(
    fetchDepth(39, 2, {
      fetchImpl: async (url) => {
        if (url.includes("emodnet")) return jsonResponse({}, 503);
        return jsonResponse({ results: undefined }); // undefined, nicht []
      },
    }),
    /Tiefendaten/,
  );
});

test("[REQ-NAV-003] flachwasserCheck: null-Check differenziert null von anderen Werten", () => {
  // Mutant "if (depth_m == null ...) -> if (false)" würde null durchlassen
  // Original: expliziter null-Check.
  const statusNull = flachwasserCheck(null, 1.8, 0.5);
  assert.equal(statusNull, "unbekannt", "null sollte unbekannt sein");

  // Vergleich: positive Tiefe sollte nicht "unbekannt" sein
  const statusOk = flachwasserCheck(5.0, 1.8, 0.5);
  assert.notEqual(statusOk, "unbekannt", "positive Tiefe sollte nicht unbekannt sein");
});
