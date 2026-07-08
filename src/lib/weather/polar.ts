// polar.ts — grobe Bootsgeschwindigkeits-Heuristik für die ETA-Schätzung.
//
// Portiert aus dem Schwesterprojekt jtc.de (lib/weather/polar.js, getestet).
// KEIN echtes VPP/Polardiagramm (MVP). Liefert eine plausible Fahrt in Knoten
// aus wahrem Wind (TWS) und wahrem Windeinfallswinkel (TWA), plus eine
// Motor-Marschfahrt. Pro Bootsklasse über einfache Faktoren konfigurierbar;
// echte Herstellerpolaren können später ein `polar`-Objekt setzen.
//
// Konventionen: TWS in Knoten, TWA in Grad (0 = im Wind, 180 = vor dem Wind),
// Ergebnis Bootsgeschwindigkeit in Knoten.

export interface Boat {
  name: string;
  /** Motor-Marschfahrt in Knoten. */
  cruise_speed_motor_kn: number;
  /** Kappung der Rumpfgeschwindigkeit in Knoten. */
  hull_speed_kn: number;
  /** Unter diesem Windeinfallswinkel kein Vortrieb am Wind. */
  upwind_no_go_deg: number;
  /** Spitzen-Anteil von TWS, der in Fahrt umgesetzt wird. */
  drive_efficiency: number;
  /** false = Jolle/Kat ohne Motor: kein Motor-Fallback bei Flaute. */
  has_engine: boolean;
  /** Unter diesem MITTELwind (kn): "zu wenig Wind"-Warnung (Segeln). */
  min_wind_kn: number | null;
  /** Über diesem MITTELwind (kn): "über Bootslimit"-Warnung (Kentergefahr/Charterlimit). */
  max_wind_kn: number | null;
}

/** Default-Profil eines fahrtentauglichen ~35-Fuß-Charterbootes. */
export const DEFAULT_BOAT: Boat = {
  name: "Default 35ft Charter",
  cruise_speed_motor_kn: 6.5,
  hull_speed_kn: 7.2,
  upwind_no_go_deg: 35,
  drive_efficiency: 0.62,
  has_engine: true,
  min_wind_kn: null, // Yacht mit Motor: Flaute ist kein Sicherheitsthema
  max_wind_kn: 35,
};

export type SailMode = "sail" | "motor";

// ── Bootsdaten → Geschwindigkeiten (Verdränger-Heuristik) ────────────────────
// Für Segler, die Länge/Verdrängung/PS kennen, aber keine Marschfahrt.

export interface BoatSpecs {
  name?: string;
  /** Wasserlinienlänge in Metern. */
  length_waterline_m?: number;
  /** Verdrängung in Tonnen. */
  displacement_t?: number;
  /** Motorleistung in PS. */
  engine_hp?: number;
  /** Direkte Marschfahrt (kn) — überschreibt die PS-Ableitung. */
  cruise_speed_motor_kn?: number;
  /** false = kein Motor an Bord (Jolle/Kat) → kein Flaute-Fallback. */
  has_engine?: boolean;
  /** Mindest-Mittelwind (kn) fürs sinnvolle Segeln. */
  min_wind_kn?: number | null;
  /** Max. Mittelwind (kn) — darüber Bootslimit (Kentergefahr/Charterregel). */
  max_wind_kn?: number | null;
  /** Typischer Tiefgang (m) — Vorbelegung für den Flachwasser-Check. */
  tiefgang_m?: number;
}

/**
 * Anklickbare Standard-Boote — übernehmen alle Parameter auf einen Schlag.
 * Werte sind bewusst konservative Faustwerte (editierbar nach Übernahme).
 */
export const BOAT_PRESETS: Array<{ id: string; label: string; specs: BoatSpecs }> = [
  {
    id: "jolle",
    label: "Jolle (z.B. 420er)",
    specs: {
      name: "Jolle", tiefgang_m: 1.0, length_waterline_m: 4, has_engine: false,
      min_wind_kn: 4, max_wind_kn: 16,
    },
  },
  {
    id: "katamaran",
    label: "Strand-Kat (z.B. Hobie 16)",
    specs: {
      name: "Strand-Katamaran", tiefgang_m: 0.3, length_waterline_m: 5, has_engine: false,
      min_wind_kn: 5, max_wind_kn: 20,
    },
  },
  {
    id: "kielboot",
    label: "Kleinkreuzer / Kielboot",
    specs: {
      name: "Kleinkreuzer", tiefgang_m: 1.2, length_waterline_m: 6.5, displacement_t: 1.2, engine_hp: 6,
      has_engine: true, min_wind_kn: 3, max_wind_kn: 22,
    },
  },
  {
    id: "charter35",
    label: "Charter-Yacht 35 ft",
    specs: {
      name: "Charter 35ft", tiefgang_m: 1.8, length_waterline_m: 10, displacement_t: 8, engine_hp: 40,
      has_engine: true, min_wind_kn: null, max_wind_kn: 35,
    },
  },
  {
    id: "yacht45",
    label: "Yacht 45 ft",
    specs: {
      name: "Yacht 45ft", tiefgang_m: 2.2, length_waterline_m: 12.5, displacement_t: 12, engine_hp: 75,
      has_engine: true, min_wind_kn: null, max_wind_kn: 40,
    },
  },
];

/** Rumpfgeschwindigkeit (kn) aus der Wasserlinie: 1.34·√LWL[ft] = 2.43·√LWL[m]. */
export function hullSpeedKn(lengthWaterlineM: number): number {
  return round(2.43 * Math.sqrt(lengthWaterlineM));
}

/**
 * Erreichbare Verdrängerfahrt (kn) aus PS + Verdrängung + Wasserlinie.
 * Klassische Displacement-Formel: SLR = 10.665 / (lb/SHP)^(1/3), v = SLR·√LWL[ft],
 * gedeckelt bei SLR 1.34 (Rumpfgeschwindigkeit). Marschfahrt = 85 % davon
 * (niemand fährt Dauervollgas).
 */
export function motorCruiseFromPower(
  engineHp: number,
  displacementT: number,
  lengthWaterlineM: number,
): number {
  if (engineHp <= 0 || displacementT <= 0 || lengthWaterlineM <= 0) {
    return DEFAULT_BOAT.cruise_speed_motor_kn;
  }
  const lb = displacementT * 2204.62;
  const slr = Math.min(1.34, 10.665 / Math.cbrt(lb / engineHp));
  const lwlFt = lengthWaterlineM * 3.28084;
  const vMax = slr * Math.sqrt(lwlFt);
  return round(0.85 * vMax);
}

/**
 * Baut ein vollständiges Boot aus (teilweisen) Bootsdaten. Fehlende Werte
 * fallen auf das Default-Charterboot zurück; eine direkt angegebene
 * Marschfahrt gewinnt gegen die PS-Ableitung.
 */
export function boatFromSpecs(specs: BoatSpecs = {}): Boat {
  const lwl = specs.length_waterline_m;
  const hull = lwl && lwl > 0 ? hullSpeedKn(lwl) : DEFAULT_BOAT.hull_speed_kn;
  let cruise = DEFAULT_BOAT.cruise_speed_motor_kn;
  if (specs.cruise_speed_motor_kn && specs.cruise_speed_motor_kn > 0) {
    cruise = specs.cruise_speed_motor_kn;
  } else if (specs.engine_hp && specs.displacement_t && lwl) {
    cruise = motorCruiseFromPower(specs.engine_hp, specs.displacement_t, lwl);
  }
  return {
    name: specs.name || DEFAULT_BOAT.name,
    cruise_speed_motor_kn: round(Math.min(cruise, hull)),
    hull_speed_kn: hull,
    upwind_no_go_deg: DEFAULT_BOAT.upwind_no_go_deg,
    drive_efficiency: DEFAULT_BOAT.drive_efficiency,
    has_engine: specs.has_engine ?? true,
    min_wind_kn: specs.min_wind_kn ?? null,
    max_wind_kn: specs.max_wind_kn ?? DEFAULT_BOAT.max_wind_kn,
  };
}

/**
 * Relative Effizienz über den Windeinfallswinkel (0..1). Modelliert das typische
 * Profil: nichts in der No-Go-Zone, Maximum am Halbwind/leicht raum (~100°),
 * etwas weniger ganz vorm Wind.
 */
function angleFactor(twa: number, noGo: number): number {
  const a = Math.abs(((twa % 360) + 360) % 360);
  const ang = a > 180 ? 360 - a : a; // auf 0..180 falten
  if (ang < noGo) return 0;
  // glatter Anstieg von noGo→100°, sanfter Abfall 100°→180°
  if (ang <= 100) return Math.sin((Math.PI / 2) * ((ang - noGo) / (100 - noGo)));
  return 0.75 + 0.25 * Math.cos((Math.PI / 2) * ((ang - 100) / 80));
}

/** Geschätzte Segelgeschwindigkeit (kn). */
export function sailSpeed(twsKn: number, twaDeg: number, boat: Boat = DEFAULT_BOAT): number {
  if (!Number.isFinite(twsKn) || twsKn <= 0) return 0;
  const af = angleFactor(twaDeg, boat.upwind_no_go_deg ?? DEFAULT_BOAT.upwind_no_go_deg);
  if (af === 0) return 0;
  const raw = boat.drive_efficiency * twsKn * af;
  return round(Math.min(raw, boat.hull_speed_kn ?? DEFAULT_BOAT.hull_speed_kn));
}

/**
 * VMG beim Aufkreuzen (REQ-NAV-011): Liegt das Ziel in der No-Go-Zone, segelt
 * man Schläge am optimalen Am-Wind-Winkel βopt und macht Richtung Ziel nur die
 * Projektion gut: v_vmg = sailSpeed(tws, βopt) · cos(βopt).
 * Heuristik βopt = no_go + 10° (dokumentiert, kein echtes Polardiagramm).
 */
export function beatVmgSpeed(twsKn: number, boat: Boat = DEFAULT_BOAT): number {
  const beta = (boat.upwind_no_go_deg ?? DEFAULT_BOAT.upwind_no_go_deg) + 10;
  const v = sailSpeed(twsKn, beta, boat);
  return round(v * Math.cos((beta * Math.PI) / 180));
}

/** Motor-Marschfahrt (konstant, Bootsdatum). */
export function motorSpeed(boat: Boat = DEFAULT_BOAT): number {
  return boat.cruise_speed_motor_kn ?? DEFAULT_BOAT.cruise_speed_motor_kn;
}

/**
 * Effektive Fahrt für einen Leg. mode 'sail' → reine Segelfahrt, fällt aber auf
 * Motorfahrt zurück, wenn Segeln zu langsam ist (z.B. am Wind/Flaute) und der
 * Skipper laut Profil motoren würde. mode 'motor' → immer Marschfahrt.
 */
export function effectiveSpeed({
  twsKn,
  twaDeg,
  mode = "sail",
  boat = DEFAULT_BOAT,
}: {
  twsKn: number;
  twaDeg: number;
  mode?: SailMode;
  boat?: Boat;
}): { speed_kn: number; mode: SailMode } {
  const sail = sailSpeed(twsKn, twaDeg, boat);
  // Ohne Motor (Jolle/Kat) gibt es keinen Fallback: bei Flaute bleibt nur
  // Kriechfahrt (Paddeln/Treiben) — die Flaute-WARNUNG kommt aus planRoute.
  if (boat.has_engine === false) {
    return { speed_kn: Math.max(sail, 0.5), mode: "sail" };
  }
  const motor = motorSpeed(boat);
  if (mode === "motor") return { speed_kn: motor, mode: "motor" };
  // Unter ~60% Marschfahrt würde man realistisch den Motor zuschalten.
  if (sail < 0.6 * motor) return { speed_kn: motor, mode: "motor" };
  return { speed_kn: sail, mode: "sail" };
}

/**
 * Wahrer Windeinfallswinkel aus Bootskurs (COG) und Windrichtung (woher der Wind
 * kommt, meteorologisch). Ergebnis 0..180.
 */
export function twaFromCourse(courseDeg: number, windFromDeg: number): number {
  let d = Math.abs((((windFromDeg - courseDeg) % 360) + 360) % 360);
  if (d > 180) d = 360 - d;
  return d;
}

function round(x: number, dp = 2): number {
  const m = 10 ** dp;
  return Math.round(x * m) / m;
}
