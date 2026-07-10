// qa-weekend.ts — Wochenend-QA: Validierung der Routenplanung gegen ECHTE
// Wetter-/Tiefendaten (REQ-PROC-003, docs/qa-validierung.md).
//
// Läuft gegen eine laufende Instanz (Staging/Live/lokal):
//   QA_BASE_URL=https://join-the-captain.org npx tsx scripts/qa-weekend.ts
//
// Prüfungen je Referenz-Route (fixtures/qa-routes.json):
//   R1  Route berechenbar (HTTP 200, engine=wassermaske wo erwartet)
//   R2  Distanz im plausiblen Korridor (min/max aus Fixture)
//   R3  ETA nach Start, Dauer plausibel (< 48 h)
//   R4  Alle Legs tragen Wetter (wind_kn endlich, >= 0)
//   R5  Tiefen-Stichproben antworten (WARN bei Bereichs-Abweichung, kein FAIL —
//       EMODnet-Raster vs. Punktkoordinate ist erwartbar unscharf)
//   R6  Routen-Profile: komfort/segel/motor liefern 200 + profil in Antwort;
//       Komfort-Distanz >= kürzeste Distanz (Umweg erlaubt, nie kürzer)
//   A1  Archiv-Selbstkalibrierung: windigster Tag im Januar 2025 (Ostsee,
//       direkt aus dem Open-Meteo-Archiv ermittelt) → Route zu diesem Termin
//       muss Warnungen ausweisen, wenn Böen > 25 kn lagen. KEINE erfundenen
//       Sturm-Namen — der Referenzwert kommt aus derselben Messquelle.
//
// Exit-Codes: 0 = alles ok (WARNs erlaubt) · 1 = mind. ein FAIL · 2 = Netz/Config.
// Ausgabe: eine JSON-Zeile je Check (maschinenlesbar) + Summary auf stderr.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
// Basic-Auth fürs Staging-Gate: QA_BASIC_AUTH="user:pass" (fetch erlaubt keine
// Credentials in der URL).
const AUTH = process.env.QA_BASIC_AUTH
  ? { authorization: `Basic ${Buffer.from(process.env.QA_BASIC_AUTH).toString("base64")}` }
  : ({} as Record<string, string>);
const FIXTURE = resolve(process.cwd(), "fixtures/qa-routes.json");

type Check = { route: string; check: string; status: "OK" | "WARN" | "FAIL"; detail: string };
const results: Check[] = [];
const report = (c: Check) => {
  results.push(c);
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...c }));
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gedrosselter POST mit 429-Backoff — der QA-Lauf soll das Rate-Limit der
 *  App respektieren, nicht messen (dafür gibt es den Unit-Test REQ-SAFE-004). */
async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  for (let attempt = 0; ; attempt++) {
    await sleep(1500);
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...AUTH },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429 && attempt < 3) {
      await sleep(25_000 * (attempt + 1));
      continue;
    }
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }
}

interface FixtureRoute {
  id: string;
  name: string;
  waypoints: Array<{ lat: number; lon: number; name?: string }>;
  mode?: string;
  start_time?: string;
  revier?: string;
  checks: {
    distance_nm_min?: number;
    distance_nm_max?: number;
    depth_points?: Array<{ lat: number; lon: number; expect_m: [number, number]; desc: string }>;
  };
}

/** Revier-Zuordnung: Fixture kann es setzen; sonst grob über die Koordinate. */
function revierFor(r: FixtureRoute): string {
  if (r.revier) return r.revier;
  const { lat, lon } = r.waypoints[0];
  if (lat > 42 && lat < 44.5 && lon > 15 && lon < 18) return "kroatien-dalmatien";
  if (lat > 54.2 && lat < 55 && lon > 12.5 && lon < 14.5) return "ruegen";
  if (lat > 54.2 && lat < 55.2 && lon > 9.3 && lon < 11) return "kieler-bucht";
  if (lat > 54.7 && lat < 55.4 && lon > 9.5 && lon < 11.5) return "daenische-suedsee";
  if (lat > 49 && lat < 49.2 && lon > 10.8 && lon < 11.1) return "brombachsee";
  if (lat > 53.5 && lat < 54.5 && lon > 7 && lon < 9.5) return "deutsche-bucht";
  return "ruegen";
}

/** Nächster 7-Tage-Zeitpunkt (Vorhersagefenster) — Fixtures mit Vergangenheits-
 *  Startzeit werden im Archivmodus separat geprüft (A1). */
function forecastStart(): string {
  const d = new Date(Date.now() + 24 * 3600e3);
  d.setUTCHours(8, 0, 0, 0);
  return d.toISOString();
}

async function checkRoute(r: FixtureRoute): Promise<void> {
  const revier = revierFor(r);
  const body = {
    revier,
    waypoints: r.waypoints,
    startTime: forecastStart(),
    mode: r.mode === "motor" ? "motor" : "sail",
    sensitivity: 0.75,
  };
  let res;
  try {
    res = await post("/api/navigation/route", body);
  } catch (e) {
    report({ route: r.id, check: "R1-erreichbar", status: "FAIL", detail: String(e) });
    return;
  }
  if (res.status !== 200 || !res.json.plan) {
    report({ route: r.id, check: "R1-erreichbar", status: "FAIL", detail: `HTTP ${res.status}: ${res.json.error ?? "?"} (revier=${revier})` });
    return;
  }
  report({ route: r.id, check: "R1-erreichbar", status: "OK", detail: `engine=${res.json.routing.engine}` });

  const nm = res.json.plan.total_nm as number;
  const { distance_nm_min: mn, distance_nm_max: mx } = r.checks;
  if (mn != null && mx != null) {
    report({
      route: r.id, check: "R2-distanz",
      status: nm >= mn * 0.9 && nm <= mx * 1.15 ? "OK" : "FAIL",
      detail: `${nm} nm (erwartet ${mn}-${mx})`,
    });
  }

  const start = Date.parse(body.startTime);
  const eta = Date.parse(res.json.plan.eta);
  const h = (eta - start) / 3600e3;
  report({ route: r.id, check: "R3-eta", status: eta > start && h < 48 ? "OK" : "FAIL", detail: `${h.toFixed(1)} h` });

  const badLegs = (res.json.plan.legs as any[]).filter((l) => !Number.isFinite(l.wind_kn) || l.wind_kn < 0);
  report({ route: r.id, check: "R4-wetter", status: badLegs.length === 0 ? "OK" : "FAIL", detail: `${res.json.plan.legs.length} Legs, ${badLegs.length} ohne Wetter` });

  for (const dp of r.checks.depth_points ?? []) {
    try {
      const dres = await fetch(`${BASE}/api/navigation/depth?revier=${revier}&lat=${dp.lat}&lon=${dp.lon}&tiefgang=2`, { headers: AUTH, signal: AbortSignal.timeout(15_000) });
      const dj: any = await dres.json();
      if (dres.status !== 200 || dj.depth_m == null) {
        report({ route: r.id, check: `R5-tiefe:${dp.desc}`, status: "WARN", detail: `HTTP ${dres.status}` });
      } else {
        const inRange = dj.depth_m >= dp.expect_m[0] * 0.3 && dj.depth_m <= dp.expect_m[1] * 3;
        report({ route: r.id, check: `R5-tiefe:${dp.desc}`, status: inRange ? "OK" : "WARN", detail: `${dj.depth_m} m (grober Korridor ${dp.expect_m[0]}-${dp.expect_m[1]})` });
      }
    } catch (e) {
      report({ route: r.id, check: `R5-tiefe:${dp.desc}`, status: "WARN", detail: String(e) });
    }
  }

  // R6: Profile — jede Variante antwortet; Komfort ist nie kürzer als kürzeste.
  for (const profil of ["segel", "motor", "komfort"]) {
    try {
      const pres = await post("/api/navigation/route", { ...body, routeProfil: profil });
      if (pres.status !== 200 || pres.json.routing?.profil !== profil) {
        report({ route: r.id, check: `R6-profil:${profil}`, status: "FAIL", detail: `HTTP ${pres.status}, profil=${pres.json.routing?.profil}` });
      } else {
        const pnm = pres.json.plan.total_nm as number;
        const ok = profil !== "komfort" || pnm >= nm - 0.2;
        report({ route: r.id, check: `R6-profil:${profil}`, status: ok ? "OK" : "FAIL", detail: `${pnm} nm (kürzeste ${nm} nm)` });
      }
    } catch (e) {
      report({ route: r.id, check: `R6-profil:${profil}`, status: "FAIL", detail: String(e) });
    }
  }
}

/** A1: Selbstkalibrierte Archiv-Validierung (Rügen, Januar 2025). */
async function checkArchive(): Promise<void> {
  try {
    const url = "https://archive-api.open-meteo.com/v1/archive?latitude=54.5&longitude=13.4&start_date=2025-01-01&end_date=2025-01-31&hourly=wind_gusts_10m&wind_speed_unit=kn&timezone=UTC";
    const aj: any = await (await fetch(url, { signal: AbortSignal.timeout(30_000) })).json();
    const gusts: number[] = aj.hourly.wind_gusts_10m;
    const times: string[] = aj.hourly.time;
    let maxI = 0;
    gusts.forEach((g, i) => { if (g != null && g > (gusts[maxI] ?? 0)) maxI = i; });
    const peak = gusts[maxI];
    const at = times[maxI];
    if (peak == null || peak < 25) {
      report({ route: "ARCHIV_RUEGEN", check: "A1-sturm", status: "WARN", detail: `kein Starkwind im Jan 2025 gefunden (max ${peak} kn)` });
      return;
    }
    const res = await post("/api/navigation/route", {
      revier: "ruegen",
      waypoints: [{ lat: 54.512, lon: 13.643 }, { lat: 54.68, lon: 13.43 }],
      startTime: `${at}:00Z`.replace("::", ":"),
      mode: "sail",
      sensitivity: 0.75,
    });
    const warnings = [
      ...(res.json.plan?.warnings ?? []),
      ...((res.json.plan?.legs ?? []) as any[]).flatMap((l) => l.warnings ?? []),
    ];
    report({
      route: "ARCHIV_RUEGEN", check: "A1-sturm",
      status: res.status === 200 && warnings.length > 0 ? "OK" : "FAIL",
      detail: `Archiv-Böe ${peak} kn am ${at} → ${warnings.length} Warnungen (HTTP ${res.status})`,
    });
  } catch (e) {
    report({ route: "ARCHIV_RUEGEN", check: "A1-sturm", status: "FAIL", detail: String(e) });
  }
}

async function main() {
  let fixture: { routes: FixtureRoute[] };
  try {
    fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
  } catch (e) {
    console.error(`Fixture nicht lesbar: ${e}`);
    process.exit(2);
  }
  for (const r of fixture.routes) await checkRoute(r);
  await checkArchive();

  const fails = results.filter((c) => c.status === "FAIL");
  const warns = results.filter((c) => c.status === "WARN");
  console.error(`\nqa-weekend gegen ${BASE}: ${results.length} Checks · ${fails.length} FAIL · ${warns.length} WARN`);
  for (const f of fails) console.error(`  FAIL ${f.route}/${f.check}: ${f.detail}`);
  process.exit(fails.length > 0 ? 1 : 0);
}

void main();
