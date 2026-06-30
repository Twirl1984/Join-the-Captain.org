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
}

/** Default-Profil eines fahrtentauglichen ~35-Fuß-Charterbootes. */
export const DEFAULT_BOAT: Boat = {
  name: "Default 35ft Charter",
  cruise_speed_motor_kn: 6.5,
  hull_speed_kn: 7.2,
  upwind_no_go_deg: 35,
  drive_efficiency: 0.62,
};

export type SailMode = "sail" | "motor";

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
  const motor = motorSpeed(boat);
  if (mode === "motor") return { speed_kn: motor, mode: "motor" };
  const sail = sailSpeed(twsKn, twaDeg, boat);
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
