"use client";

// NavApp — Client-Shell der Navigations-App (/navigation).
//
// Baut auf dem /wetter-Tool auf (das als Test-Tab unverändert weiterlebt) und
// ergänzt: Reviere-GRUPPEN mit Suche, Tiefen-Layer (EMODnet), GPS-Position mit
// "Folgen" + Route ab eigener Position (echte, laufend aktualisierbare ETAs),
// Land-Vermeidungs-Routing (Wasserweg statt Luftlinie), Wolkenfelder über die
// Zeit und Flachwasser-Check gegen den Tiefgang.
// data-testid-Attribute sind der E2E-Vertrag (e2e/navigation.spec.ts).

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { REVIER_GRUPPEN, alleReviere, sucheReviere } from "@/lib/navigation/reviere";
import type { RouteSegmentInfo } from "@/lib/navigation/route-helpers";
import { flachwasserCheck, type FlachwasserStatus } from "@/lib/navigation/depth";
import { boatFromSpecs, BOAT_PRESETS, type BoatSpecs } from "@/lib/weather/polar";
import type { DepartureScan } from "@/lib/weather/departure-scan";
import { RECOMMENDED_SENSITIVITY } from "@/lib/weather/warnings";
import { WEATHER_MODELS, type WeatherModel } from "@/lib/weather/open-meteo";
import { compassPoint, windArrowRotationDeg } from "@/lib/weather/format";
import { boatPositionAt } from "@/lib/weather/playback";
import type { TimelinePoint } from "@/lib/weather/open-meteo";
import type { Waypoint, RoutePlan, RouteLeg } from "@/lib/weather/route-forecast";
import type { RevierPoi } from "@/lib/types";
import { useGeolocation } from "./useGeolocation";
import type { NavOverlay, NavRoutedLine, NavUiWaypoint } from "./NavMap";
import { gpxFromRoute } from "@/lib/navigation/gpx";
import { nearestHarborsGlobal, nearestRevier } from "@/lib/navigation/nearby";
import {
  magneticToTrue,
  crossBearingFix,
  gpsPlausibility,
  positionUncertaintyNm,
  bestCutAngleDeg,
  averageHeading,
  sightingAzimuth,
  missweisungForRevier,
  MIN_CUT_ANGLE_DEG,
  type Bearing,
} from "@/lib/navigation/peilung";
import { weatherSymbolsV2Enabled } from "@/lib/flags";
import { macheUebersetzer, STANDARD_SPRACHE, type Sprache } from "@/lib/i18n/sprache";
import { WOERTERBUECHER } from "@/lib/i18n/woerterbuch";
import {
  normalisiereSymbolWahl,
  andereWahl,
  umschaltBeschriftung,
  WX_SYMBOL_KEY,
  type WxSymbolWahl,
} from "@/lib/weather/wx-symbole";

const NavMap = dynamic(() => import("./NavMap"), {
  ssr: false,
  loading: () => <div className="wetter-leaflet wetter-map-skeleton" aria-hidden="true" />,
});

// Wetterzeichen v2 (REQ-WET-015/016): Windfahnen + Temperatur/Niederschlag statt
// Pfeil. Env-Flag (NEXT_PUBLIC_*, build-eingebacken) → einmal je Build ausgewertet.
// Seit REQ-WET-017 nur noch der STARTWERT: die Nutzerin schaltet zur Laufzeit um,
// die Wahl bleibt im Browser gespeichert (siehe lib/weather/wx-symbole.ts).
const SYMBOL_START: WxSymbolWahl = weatherSymbolsV2Enabled() ? "fahne" : "pfeil";

interface Timeline {
  times: string[];
  points: TimelinePoint[];
}

interface RoutingInfo {
  engine: string;
  points: Array<{ lat: number; lon: number; name: string | null }>;
  segments: RouteSegmentInfo[];
  hinweis: string;
}

interface DepthPoint {
  lat: number;
  lon: number;
  depth_m: number | null;
  /** Niedrigstwasser des Törns (m rel. MSL) am Punkt, falls Tide-Daten da. */
  tide_min_m?: number | null;
  /** Effektive Tiefe = Kartentiefe + Niedrigstwasser (REQ-NAV-012). */
  depth_eff_m?: number | null;
  check?: FlachwasserStatus;
}

/** Antwort von GET /api/weather/now — aktuelle Bedingungen am Ort (REQ-NAV-024). */
interface JetztWetter {
  wind_kn: number;
  gust_kn: number;
  wind_from_deg: number;
  wave_m: number | null;
  current_kn: number | null;
  current_to_deg: number | null;
  tide_m: number | null;
  gale: boolean;
  thunderstorm: boolean;
  high_wave: boolean;
}

const FEEDBACK_ISSUES = [
  "Wind stärker als vorhergesagt",
  "Wind schwächer als vorhergesagt",
  "Gewitter kam nicht (Fehlalarm)",
  "Gewitter/Sturm kam ungewarnt",
  "Welle falsch",
  "Ankunftszeit lag daneben",
] as const;

const fmtEta = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const DISCLAIMER_KEY = "jtc-nav-disclaimer-v1";

// `sprache` kommt vom Server (siehe app/navigation/page.tsx), damit beim ersten
// Rendern nicht kurz die falsche Sprache steht (REQ-I18N-001).
export function NavApp({ sprache = STANDARD_SPRACHE }: { sprache?: Sprache }) {
  const t = macheUebersetzer(WOERTERBUECHER, sprache);
  const [revierId, setRevierId] = useState(REVIER_GRUPPEN[0].reviere[0].id);
  // Pflicht-Hinweis bei Erstnutzung: App ist NICHT als Navigationsmittel
  // zugelassen (Open-Source-Daten) — Nutzer muss das aktiv bestätigen.
  // null = noch nicht geprüft (SSR-sicher), true = anzeigen.
  const [showDisclaimer, setShowDisclaimer] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setShowDisclaimer(localStorage.getItem(DISCLAIMER_KEY) !== "1");
    } catch {
      setShowDisclaimer(true);
    }
  }, []);
  const acceptDisclaimer = () => {
    try {
      localStorage.setItem(DISCLAIMER_KEY, "1");
    } catch {
      /* Privat-Modus: dann eben je Sitzung */
    }
    setShowDisclaimer(false);
  };
  // Windsymbol-Darstellung (REQ-WET-017): Pfeil oder Beaufort-Windfahne.
  // SSR-sicher nach dem Muster des Disclaimers oben: erst der Startwert aus dem
  // Env-Flag, dann im Effekt die gespeicherte Wahl nachziehen — beim
  // Server-Rendern gibt es kein localStorage.
  const [symbolWahl, setSymbolWahl] = useState<WxSymbolWahl>(SYMBOL_START);
  useEffect(() => {
    try {
      setSymbolWahl(normalisiereSymbolWahl(localStorage.getItem(WX_SYMBOL_KEY), SYMBOL_START));
    } catch {
      /* Privat-Modus: dann eben der Startwert */
    }
  }, []);
  const symbolsV2 = symbolWahl === "fahne";
  const toggleSymbolWahl = () => {
    const neu = andereWahl(symbolWahl);
    setSymbolWahl(neu);
    try {
      localStorage.setItem(WX_SYMBOL_KEY, neu);
    } catch {
      /* Privat-Modus: Wahl gilt nur für diese Sitzung */
    }
  };

  const [suche, setSuche] = useState("");
  const [waypoints, setWaypoints] = useState<NavUiWaypoint[]>([]);
  const nextId = useRef(1);
  const [showDepth, setShowDepth] = useState(true);
  // Karte im Vollbild (REQ-NAV-018): auf dem Handy den ganzen Bildschirm nutzen.
  const [mapFull, setMapFull] = useState(false);
  const [mode, setMode] = useState<"sail" | "motor">("sail");
  const [startTime, setStartTime] = useState(() => toLocalInput(new Date(Date.now() + 3600e3)));
  // Tiefgang als Roh-String: "0.5" darf beim Tippen nicht zu 1.8 springen
  // (Review-Finding: `Number(v) || 1.8` fraß die führende 0).
  const [tiefgangStr, setTiefgangStr] = useState("1.8");
  const tiefgang = useMemo(() => {
    const n = Number.parseFloat(tiefgangStr.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.min(20, n) : 1.8;
  }, [tiefgangStr]);
  // Boot (REQ-NAV-008): Presets + abgeleitete Werte, fließt in die ETA ein.
  const [specs, setSpecs] = useState<BoatSpecs>({});
  const boat = useMemo(() => boatFromSpecs(specs), [specs]);
  const applyPreset = (ps: BoatSpecs) => {
    setSpecs({ ...ps });
    if (ps.tiefgang_m) setTiefgangStr(String(ps.tiefgang_m));
  };
  // Abfahrts-Scan (REQ-NAV-009): Fenster-Ende + Ergebnis.
  const [scanTo, setScanTo] = useState(() => toLocalInput(new Date(Date.now() + 48 * 3600e3)));
  const [scan, setScan] = useState<DepartureScan | null>(null);
  // Routen-Profil (REQ-NAV-019): welcher WEG gesucht wird (nicht die Antriebsart).
  const [routeProfil, setRouteProfil] = useState<"kuerzeste" | "segel" | "motor" | "komfort">("kuerzeste");
  // Warn-Empfindlichkeit (REQ-NAV-015) — wirkt auf Route, Scan und Zeitreise.
  const [sensitivity, setSensitivity] = useState(RECOMMENDED_SENSITIVITY);
  // Wettermodell + gemessene Revier-Empfehlung (REQ-NAV-016 aus /wetter).
  const [model, setModel] = useState<WeatherModel>("best_match");
  const [modelRec, setModelRec] = useState<{
    model: string; label: string; mae_gust_kn: number | null; n_samples: number;
  } | null>(null);
  const [source, setSource] = useState<string | null>(null);
  // Feedback-Schleife (REQ-WET-012, portiert).
  const [fbRating, setFbRating] = useState<number | null>(null);
  const [fbOk, setFbOk] = useState<boolean | null>(null);
  const [fbText, setFbText] = useState("");
  const [fbName, setFbName] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbIssues, setFbIssues] = useState<string[]>([]);
  const [fbState, setFbState] = useState<"idle" | "sending" | "done">("idle");
  const [snapHinweis, setSnapHinweis] = useState<string | null>(null);
  // GPS
  const gps = useGeolocation();
  const [followGps, setFollowGps] = useState(false);
  const [startAtGps, setStartAtGps] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);
  // Ergebnis
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [routing, setRouting] = useState<RoutingInfo | null>(null);
  // Berechnete ANKUNFT je Wegpunkt-ID (aus plan.legs × routing.segments) —
  // Basis für die bidirektionale Liegezeit (Dauer ⇄ Uhrzeit, REQ-NAV-017).
  const [arrivals, setArrivals] = useState<Record<string, string>>({});
  const [depths, setDepths] = useState<DepthPoint[] | null>(null);
  const [depthLoading, setDepthLoading] = useState(false);
  const [depthError, setDepthError] = useState<string | null>(null);
  // Playback (Wolken/Wind über die Zeit)
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [playIdx, setPlayIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Erlebnisse entlang der Route (REQ-EXP-004): POIs im Korridor um den Wasserweg.
  const [erlebnisse, setErlebnisse] = useState<RevierPoi[] | null>(null);
  const [erlebnisseLoading, setErlebnisseLoading] = useState(false);
  const [erlebnisseError, setErlebnisseError] = useState<string | null>(null);
  const erlebnisseSeq = useRef(0);
  // Teilbarer Törn-Link (REQ-EXP-009): read-only Snapshot per Kurz-ID.
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "laden" | "fehler">("idle");
  // „Jetzt & hier" (REQ-NAV-024): aktuelle Bedingungen an der eigenen Position.
  const [jetztWx, setJetztWx] = useState<JetztWetter | null>(null);
  const [jetztDepth, setJetztDepth] = useState<{ depth_m: number; check?: FlachwasserStatus } | null>(null);
  const [jetztState, setJetztState] = useState<"idle" | "laden" | "fehler">("idle");
  const jetztSeq = useRef(0);
  // Kreuzpeilung (REQ-NAV-025): bis zu 3 Peilzeilen + editierbare Missweisung.
  // Referenz ist ENTWEDER ein kartierter Hafen (refName) ODER ein frei auf der
  // Karte angetipptes Objekt (custom) — so peilt man auch Gebäude an Land an.
  type PeilRow = { refName: string; magnetic: string; custom?: { lat: number; lon: number } };
  const [peilRows, setPeilRows] = useState<PeilRow[]>([
    { refName: "", magnetic: "" },
    { refName: "", magnetic: "" },
  ]);
  const [missweisung, setMissweisung] = useState<string>("");
  // Karten-Auswahlmodus: welche Peilzeile wartet auf einen Objekt-Klick?
  const [peilPickRow, setPeilPickRow] = useState<number | null>(null);
  // Welche Peilzeile liest gerade den Kompass (für die "…"-Anzeige am Knopf)?
  const [peilCapturing, setPeilCapturing] = useState<number | null>(null);
  // Zeile, deren Kompass kein gültiges Signal lieferte (statt falscher 0).
  const [peilNoSignal, setPeilNoSignal] = useState<number | null>(null);
  // Streuung der Kompass-Messreihe je Zeile (großer Wert ⇒ Kompass unruhig).
  const [peilSpread, setPeilSpread] = useState<{ row: number; spread: number; n: number } | null>(null);
  // Sequenz-Guard gegen Races: nur die JÜNGSTE Anfrage darf State setzen —
  // sonst überschreibt eine verspätete Antwort (z. B. nach Revier-Wechsel)
  // die aktuelle Karte mit dem Plan des alten Reviers (Review-Finding #4).
  const reqSeq = useRef(0);

  const revier = useMemo(
    () => alleReviere().find((r) => r.id === revierId) ?? REVIER_GRUPPEN[0].reviere[0],
    [revierId],
  );
  const sucheHits = useMemo(() => (suche.trim() ? sucheReviere(suche).slice(0, 6) : []), [suche]);
  const maxStart = useMemo(() => toLocalInput(new Date(Date.now() + 7 * 24 * 3600e3)), []);

  // Effektive Wegpunkte: optional die eigene GPS-Position als Start.
  const effectiveWaypoints = useMemo((): Waypoint[] => {
    // depart_at/stay_min MÜSSEN mit — sonst ist "Weiterfahrt ab" wirkungslos
    // (Bugfix REQ-NAV-017; Felder wurden bei der Portierung verworfen).
    const clicked = waypoints.map(({ lat, lon, name, depart_at, stay_min }) => ({
      lat, lon, name, depart_at, stay_min,
    }));
    if (startAtGps && gps.fix) {
      return [{ lat: gps.fix.lat, lon: gps.fix.lon, name: "Meine Position" }, ...clicked];
    }
    return clicked;
  }, [waypoints, startAtGps, gps.fix]);

  const canCalc = effectiveWaypoints.length >= 2;

  // Nächste Häfen ÜBER ALLE REVIERE zur GPS-Position (nicht ans ausgewählte
  // Revier gebunden — sonst zeigt „Jetzt & hier" in Nürnberg Nordsee-Häfen).
  const jetztHaefen = useMemo(
    () => (gps.fix ? nearestHarborsGlobal(gps.fix, alleReviere(), 3) : []),
    [gps.fix],
  );
  // Vorschlag: zum tatsächlich nächsten Revier wechseln (REQ-NAV-024). Nur wenn
  // es NICHT das aktuell gewählte ist — der User entscheidet per Klick.
  const revierVorschlag = useMemo(() => {
    if (!gps.fix) return null;
    const nr = nearestRevier(gps.fix, alleReviere());
    return nr && nr.id !== revierId ? nr : null;
  }, [gps.fix, revierId]);

  // Gerät/Browser erkennen, um bei blockiertem GPS NUR den passenden Freischalt-
  // Weg zu zeigen (REQ-NAV-005). Ein Deeplink in die OS-Einstellungen ist aus dem
  // WEB heraus nicht möglich (Apple/Google sperren das bewusst) — deshalb
  // wenigstens der kürzeste, gerätegenaue Klickpfad statt einer Sammel-Anleitung.
  // In der nativen App (Capacitor) geht der Ein-Klick-Sprung, siehe docs/ios-portierung.md.
  const geraet = useMemo((): { os: "ios-safari" | "ios-dritt" | "android" | "desktop"; browser: string } => {
    if (typeof navigator === "undefined") return { os: "desktop", browser: "" };
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) {
      const b = /CriOS/.test(ua)
        ? "Chrome"
        : /FxiOS/.test(ua)
          ? "Firefox"
          : /EdgiOS/.test(ua)
            ? "Edge"
            : /OPiOS|OPT\//.test(ua)
              ? "Opera"
              : "";
      return { os: b ? "ios-dritt" : "ios-safari", browser: b };
    }
    if (/Android/.test(ua)) return { os: "android", browser: "" };
    return { os: "desktop", browser: "" };
  }, []);

  // Kreuzpeilung (REQ-NAV-025): kartierte Referenzpunkte in der Nähe (Häfen).
  const peilRefs = useMemo(
    () => nearestHarborsGlobal(gps.fix ?? { lat: revier.center[0], lon: revier.center[1] }, alleReviere(), 8),
    [gps.fix, revier],
  );
  const effMissweisung =
    missweisung.trim() !== "" && Number.isFinite(Number(missweisung))
      ? Number(missweisung)
      : missweisungForRevier(revierId);
  // Referenzpunkt einer Peilzeile: frei angetipptes Objekt hat Vorrang, sonst
  // der gewählte kartierte Hafen.
  const peilRefPoint = (row: PeilRow): { lat: number; lon: number } | null => {
    if (row.custom) return row.custom;
    const h = peilRefs.find((r) => `${r.revier}::${r.name}` === row.refName);
    return h ? { lat: h.lat, lon: h.lon } : null;
  };
  // Gültige Peilungen (Referenz + rechtweisende Peilung).
  const peilBearings = useMemo((): Bearing[] => {
    return peilRows
      .map((row): Bearing | null => {
        const ref = peilRefPoint(row);
        const mag = Number(row.magnetic);
        if (!ref || row.magnetic.trim() === "" || !Number.isFinite(mag)) return null;
        return { ref, trueBearingDeg: magneticToTrue(mag, effMissweisung) };
      })
      .filter((b): b is Bearing => b !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peilRows, peilRefs, effMissweisung]);
  const peilFix = useMemo(
    () => (peilBearings.length >= 2 ? crossBearingFix(peilBearings) : null),
    [peilBearings],
  );
  // Schnittwinkel-Qualität: unter ~20° ist der Schnitt wertlos (Standlinien fast
  // parallel) — dann darf die App KEIN GPS-Urteil fällen (BUG-043).
  const peilCut = useMemo(
    () => (peilBearings.length >= 2 ? bestCutAngleDeg(peilBearings) : 0),
    [peilBearings],
  );
  const peilBrauchbar = peilBearings.length >= 2 && peilCut >= MIN_CUT_ANGLE_DEG;
  const peilUnsicherheit = useMemo(
    () => (peilFix ? positionUncertaintyNm(peilBearings, peilFix) : Infinity),
    [peilBearings, peilFix],
  );
  // Angepeilte Objekte für die Kartenmarker.
  const peilObjekte = useMemo(
    () =>
      peilRows
        .map((row, i) => {
          const ref = peilRefPoint(row);
          return ref ? { lat: ref.lat, lon: ref.lon, label: `Peilung ${i + 1}` } : null;
        })
        .filter((o): o is { lat: number; lon: number; label: string } => o !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peilRows, peilRefs],
  );
  const peilPlaus = useMemo(
    () =>
      peilFix && gps.fix && peilBrauchbar
        ? gpsPlausibility(gps.fix, peilFix, gps.fix.accuracy_m / 1852, peilUnsicherheit)
        : null,
    [peilFix, gps.fix, peilBrauchbar, peilUnsicherheit],
  );
  // Peillinien für die Karte: vom angepeilten Objekt zurück durch den Fix
  // (die Standlinie, auf der der Beobachter liegt) — sichtbar prüfbar.
  const peilLinien = useMemo(() => {
    if (!peilFix) return [];
    return peilBearings.map((b) => ({
      from: { lat: b.ref.lat, lon: b.ref.lon },
      to: { lat: peilFix.lat, lon: peilFix.lon },
    }));
  }, [peilBearings, peilFix]);

  // Kompass-Heading in eine Peilzeile übernehmen (Best-Effort; iOS braucht die
  // Berechtigung, sonst trägt der Nutzer die Peilung manuell ein).
  async function captureHeading(rowIdx: number) {
    try {
      const DOE = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (DOE && typeof DOE.requestPermission === "function") {
        if ((await DOE.requestPermission()) !== "granted") return;
      }
      setPeilCapturing(rowIdx);
      setPeilNoSignal((s) => (s === rowIdx ? null : s));
      setPeilSpread((s) => (s?.row === rowIdx ? null : s));
      // Handy-Kompasse springen (real: 170° → 209°). Eine EINZELNE Messung ist
      // wertlos → über ~2 s sammeln und zirkulär mitteln; große Streuung melden.
      const samples: number[] = [];
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener("deviceorientation", handler as EventListener);
        setPeilCapturing((c) => (c === rowIdx ? null : c));
        const avg = averageHeading(samples);
        if (avg && samples.length >= 3) {
          setPeilRows((rows) =>
            rows.map((r, i) => (i === rowIdx ? { ...r, magnetic: String(Math.round(avg.heading)) } : r)),
          );
          setPeilSpread({ row: rowIdx, spread: avg.spread_deg, n: samples.length });
        } else {
          // Kein (verwertbares) Kompass-Signal → NICHT die falsche 0 schreiben,
          // sondern sichtbar melden (User-Feedback).
          setPeilNoSignal(rowIdx);
        }
      };
      const handler = (
        e: DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number },
      ) => {
        const flach = e.beta == null || Math.abs(e.beta) < 30;
        // AUFRECHT (Anpeilen mit der Kamera): Azimut aus der 3D-Lage rechnen.
        // webkitCompassHeading meint die GERÄTE-OBERKANTE und ist beim aufrechten
        // Halten praktisch unbrauchbar (BUG-045: 90°-Drehung ⇒ wenige Grad).
        if (!flach) {
          const az = sightingAzimuth(e.alpha ?? NaN, e.beta ?? NaN, e.gamma ?? NaN);
          if (az != null) samples.push(az);
          return;
        }
        // FLACH gehalten (klassisch, über die Oberkante anvisieren):
        // iOS webkitCompassHeading; Accuracy < 0 bedeutet ungültig.
        if (typeof e.webkitCompassHeading === "number" && Number.isFinite(e.webkitCompassHeading)) {
          if (e.webkitCompassAccuracy != null && e.webkitCompassAccuracy < 0) return;
          samples.push(e.webkitCompassHeading);
          return;
        }
        // Android: nur absolute Orientierung ist brauchbar.
        if (e.absolute === true && e.alpha != null && Number.isFinite(e.alpha)) {
          samples.push((360 - e.alpha) % 360);
        }
      };
      window.addEventListener("deviceorientation", handler as EventListener);
      // Nach 2,5 s auswerten (genug Messungen, kein Listener-Leak).
      window.setTimeout(finish, 2500);
    } catch {
      setPeilCapturing((c) => (c === rowIdx ? null : c));
    }
  }

  // „Jetzt & hier": aktuelles Wetter + Tiefe unterm Kiel an der eigenen Position.
  async function loadJetzt() {
    if (!gps.fix) return;
    const { lat, lon } = gps.fix;
    const myId = ++jetztSeq.current;
    setJetztState("laden");
    const tg = Number(tiefgangStr) > 0 ? Number(tiefgangStr) : null;
    try {
      const [wxRes, depthRes] = await Promise.all([
        fetch(`/api/weather/now?lat=${lat}&lon=${lon}&model=${model}&sensitivity=${sensitivity}`),
        fetch(`/api/navigation/depth?lat=${lat}&lon=${lon}${tg != null ? `&tiefgang=${tg}` : ""}`),
      ]);
      if (myId !== jetztSeq.current) return; // veraltete Antwort verwerfen
      if (!wxRes.ok) {
        setJetztState("fehler");
        return;
      }
      setJetztWx((await wxRes.json()) as JetztWetter);
      setJetztDepth(depthRes.ok ? ((await depthRes.json()) as { depth_m: number; check?: FlachwasserStatus }) : null);
      setJetztState("idle");
    } catch {
      if (myId === jetztSeq.current) setJetztState("fehler");
    }
  }

  // Erlebnisse entlang der Route (REQ-EXP-004): POIs im Korridor um den
  // gerouteten Wasserweg, gefiltert nach Saison/Gültigkeit des Abfahrtsmonats.
  async function loadErlebnisse() {
    if (!routing) return;
    const myId = ++erlebnisseSeq.current;
    setErlebnisseLoading(true);
    setErlebnisseError(null);
    try {
      const pts = thin(routing.points, 20);
      const route = pts.map((p) => `${p.lat},${p.lon}`).join(";");
      const monat = new Date(startTime).getUTCMonth() + 1;
      const res = await fetch(
        `/api/erlebnis/poi?route=${encodeURIComponent(route)}&korridorNm=5&monat=${monat}`,
      );
      if (myId !== erlebnisseSeq.current) return;
      if (!res.ok) {
        setErlebnisseError("Erlebnisse gerade nicht verfügbar — später erneut versuchen.");
        return;
      }
      const data = (await res.json()) as { pois: RevierPoi[] };
      setErlebnisse(data.pois);
    } catch {
      if (myId === erlebnisseSeq.current)
        setErlebnisseError("Erlebnisse gerade nicht verfügbar — später erneut versuchen.");
    } finally {
      if (myId === erlebnisseSeq.current) setErlebnisseLoading(false);
    }
  }

  // Teilbarer Törn-Link (REQ-EXP-009): Snapshot der aktuellen Route anlegen.
  async function shareToern() {
    if (!routing || !plan) return;
    setShareState("laden");
    setShareUrl(null);
    try {
      const res = await fetch("/api/toern/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          revierId: revier.id,
          punkte: routing.points,
          plan,
          highlights: (erlebnisse ?? []).map((e) => ({ name: e.name, lat: e.lat, lon: e.lon, typ: e.typ })),
        }),
      });
      if (!res.ok) {
        setShareState("fehler");
        return;
      }
      const data = (await res.json()) as { id: string };
      setShareUrl(`${window.location.origin}/toern/${data.id}`);
      setShareState("idle");
    } catch {
      setShareState("fehler");
    }
  }

  const addWaypoint = (w: Waypoint) => {
    // Peilungs-Auswahlmodus (REQ-NAV-025): Karten-/Hafen-Klick setzt das
    // angepeilte OBJEKT der wartenden Zeile — kein Wegpunkt, kein Snap (das
    // Objekt darf an Land liegen, z. B. ein Kirchturm).
    if (peilPickRow != null) {
      const idx = peilPickRow;
      setPeilRows((rows) =>
        rows.map((r, j) => (j === idx ? { ...r, custom: { lat: w.lat, lon: w.lon }, refName: "" } : r)),
      );
      setPeilPickRow(null);
      return;
    }
    const id = `nwp-${nextId.current++}`;
    // Optimistisch setzen — Hafen-Klicks (mit Name) bleiben unangetastet;
    // freie Karten-Klicks werden sichtbar an die Küste gesnappt (REQ-NAV-010).
    setWaypoints((prev) => [...prev, { ...w, id }]);
    if (w.name) return;
    const myId = reqSeq.current;
    void (async () => {
      try {
        const res = await fetch(
          `/api/navigation/snap?revier=${encodeURIComponent(revier.id)}&lat=${w.lat}&lon=${w.lon}`,
        );
        const d = (await res.json().catch(() => ({}))) as {
          lat?: number; lon?: number; snapped?: boolean; error?: string;
        };
        if (myId !== reqSeq.current) return;
        if (res.status === 422) {
          // zu weit im Land: Punkt wieder entfernen + Hinweis
          setWaypoints((prev) => prev.filter((x) => x.id !== id));
          setSnapHinweis(d.error ?? "Der Punkt liegt zu weit im Land.");
          return;
        }
        if (res.ok && (d as { outside?: boolean }).outside) {
          // Außerhalb der Revier-Maske: erlaubt, aber ehrlich erklären, warum
          // die Route dorthin nur eine Luftlinie sein kann (BUG-038).
          setSnapHinweis(
            `Der Punkt liegt außerhalb des Reviers „${revier.label}“ — dorthin gibt es nur eine Luftlinie (kein Wasserweg-Routing). Ggf. oben das passende Revier wählen.`,
          );
          return;
        }
        if (res.ok && d.snapped && d.lat != null && d.lon != null) {
          setWaypoints((prev) =>
            prev.map((x) => (x.id === id ? { ...x, lat: d.lat!, lon: d.lon! } : x)),
          );
          setSnapHinweis("Wegpunkt an die nächste Wasserstelle gesetzt.");
        }
      } catch {
        /* Snap ist Komfort — Route-API snappt serverseitig ohnehin. */
      }
    })();
  };
  const removeWaypoint = (id: string) => setWaypoints((prev) => prev.filter((w) => w.id !== id));
  const setWaypointDepart = (id: string, value: string) =>
    setWaypoints((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, depart_at: value ? new Date(value).toISOString() : undefined, stay_min: undefined }
          : w,
      ),
    );
  const setWaypointStay = (id: string, hStr: string, mStr: string) => {
    const h = Math.max(0, Math.min(168, Math.floor(Number(hStr)) || 0));
    const m = Math.max(0, Math.min(59, Math.floor(Number(mStr)) || 0));
    const total = h * 60 + m;
    setWaypoints((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, stay_min: total > 0 ? total : undefined, depart_at: undefined }
          : w,
      ),
    );
  };
  // Anzeige-Ableitung: das NICHT führende Feld wird aus Ankunft + führendem Wert
  // berechnet (bidirektional, REQ-NAV-017). Ohne berechnete Ankunft bleibt es leer.
  const stayFieldsFor = (w: NavUiWaypoint): { h: string; m: string } => {
    if (w.stay_min != null) {
      return { h: String(Math.floor(w.stay_min / 60)), m: String(w.stay_min % 60) };
    }
    const arr = arrivals[w.id];
    if (w.depart_at && arr) {
      // Auf MINUTEN-Basis rechnen: die ETA trägt Sekundenanteile, angezeigt
      // wird sie aber minutengenau — sonst kippt die Dauer um 1 min (BUG-040).
      const arrMin = Math.floor(Date.parse(arr) / 60e3) * 60e3;
      const diffMin = Math.round((new Date(w.depart_at).getTime() - arrMin) / 60e3);
      if (diffMin >= 0) return { h: String(Math.floor(diffMin / 60)), m: String(diffMin % 60) };
    }
    return { h: "", m: "" };
  };
  const departFieldFor = (w: NavUiWaypoint): string => {
    if (w.depart_at) return toLocalInput(new Date(w.depart_at));
    const arr = arrivals[w.id];
    if (arr) {
      // Auch ohne Eingabe befüllen: Weiterfahrt = Ankunft (+ Liegezeit).
      // Erst eine ECHTE Eingabe (Uhrzeit anfassen / Dauer > 0) wandert in den
      // Request — die Anzeige ist ein abgeleiteter Default (User-Wunsch).
      const arrMin = Math.floor(Date.parse(arr) / 60e3) * 60e3;
      return toLocalInput(new Date(arrMin + (w.stay_min ?? 0) * 60e3));
    }
    return "";
  };

  /** Wegpunkt verschoben (Drag, REQ-NAV-013): Position übernehmen, dann
      dieselbe Wasser-Snap-Prüfung wie beim Setzen — bei "zu weit im Land"
      springt der Punkt auf die alte Position zurück. */
  const moveWaypoint = (id: string, lat: number, lon: number) => {
    const alt = waypoints.find((w) => w.id === id);
    if (!alt) return;
    const vorher = { lat: alt.lat, lon: alt.lon };
    setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, lat, lon } : w)));
    const myId = reqSeq.current;
    void (async () => {
      try {
        const res = await fetch(
          `/api/navigation/snap?revier=${encodeURIComponent(revier.id)}&lat=${lat}&lon=${lon}`,
        );
        const d = (await res.json().catch(() => ({}))) as {
          lat?: number; lon?: number; snapped?: boolean; error?: string;
        };
        if (myId !== reqSeq.current) return;
        if (res.status === 422) {
          setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, ...vorher } : w)));
          setSnapHinweis(d.error ?? "Der Punkt liegt zu weit im Land — zurückgesetzt.");
          return;
        }
        if (res.ok && (d as { outside?: boolean }).outside) {
          // Außerhalb der Revier-Maske: erlaubt, aber ehrlich erklären, warum
          // die Route dorthin nur eine Luftlinie sein kann (BUG-038).
          setSnapHinweis(
            `Der Punkt liegt außerhalb des Reviers „${revier.label}“ — dorthin gibt es nur eine Luftlinie (kein Wasserweg-Routing). Ggf. oben das passende Revier wählen.`,
          );
          return;
        }
        if (res.ok && d.snapped && d.lat != null && d.lon != null) {
          setWaypoints((prev) =>
            prev.map((w) => (w.id === id ? { ...w, lat: d.lat!, lon: d.lon! } : w)),
          );
          setSnapHinweis("Wegpunkt an die nächste Wasserstelle gesetzt.");
        }
      } catch {
        /* Snap ist Komfort — Route-API snappt serverseitig ohnehin. */
      }
    })();
  };
  const reset = () => {
    // Versehentliches Löschen verhindern (Usability-Audit G-002).
    if (waypoints.length > 0 && !window.confirm("Route und alle Wegpunkte löschen?")) return;
    reqSeq.current++;
    setScan(null);
    setSnapHinweis(null); // laufende Antworten verwerfen
    setWaypoints([]);
    setPlan(null);
    setRouting(null);
    setArrivals({});
    setDepths(null);
    setTimeline(null);
    setPlaying(false);
    setPlayIdx(0);
    setError(null);
  };

  async function calculate(opts: { silent?: boolean; scanWindowEnd?: string } = {}) {
    // Request-Stand festhalten: Wegpunkte + GPS-Offset, wie sie in
    // effectiveWaypoints eingehen (Basis fürs arrivals-Mapping der Antwort).
    const wpsSnapshot = waypoints;
    const gpsOffSnapshot = startAtGps && gps.fix ? 1 : 0;
    if (!canCalc) return;
    // Ab eigener Position gilt: Abfahrt JETZT (echte Ankunftszeiten).
    const startDate = startAtGps && gps.fix ? new Date() : new Date(startTime);
    if (Number.isNaN(startDate.getTime())) {
      setError("Bitte eine gültige Abfahrtszeit wählen.");
      return;
    }
    const myId = ++reqSeq.current;
    if (!opts.silent) {
      setLoading(true);
      setPlan(null);
      setRouting(null);
    }
    setError(null);
    try {
      const startIso = startDate.toISOString();
      const res = await fetch("/api/navigation/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          revier: revier.id,
          waypoints: effectiveWaypoints,
          startTime: startIso,
          mode,
          sensitivity,
          model,
          routeProfil,
          boat,
          ...(opts.scanWindowEnd
            ? { scanWindowEnd: opts.scanWindowEnd, scanStepH: 1 }
            : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        plan?: RoutePlan;
        routing?: RoutingInfo;
        scan?: DepartureScan | null;
        error?: string;
      };
      if (myId !== reqSeq.current) return; // veraltete Antwort verwerfen
      if (!res.ok || !data.plan || !data.routing) {
        setError(
          res.status === 502
            ? "Wetterdaten gerade nicht verfügbar — bitte später erneut versuchen."
            : data.error || "Berechnung fehlgeschlagen — bitte Eingaben prüfen.",
        );
        return;
      }
      setPlan(data.plan);
      setRouting(data.routing);
      // Ankunft je UI-Wegpunkt: Segment i verbindet User-Punkt i mit i+1;
      // das Leg, das am Segment-Endpunkt endet, trägt die Ankunfts-ETA.
      // WICHTIG: wpsSnapshot/gpsOffSnapshot (Request-Stand) statt Live-State —
      // segments wurden für GENAU diese Punktfolge gerechnet (tiefgangSnapshot-Muster).
      {
        const arr: Record<string, string> = {};
        wpsSnapshot.forEach((w, i) => {
          const effIdx = i + gpsOffSnapshot;
          if (effIdx === 0) return; // Startpunkt hat keine Ankunft
          const seg = data.routing!.segments[effIdx - 1];
          const leg = seg ? data.plan!.legs[seg.to - 1] : undefined;
          if (leg) arr[w.id] = leg.eta;
        });
        setArrivals(arr);
      }
      setScan(data.scan ?? null);
      setSource((data as { source?: string }).source ?? null);
      setFbState("idle");
      setDepths(null);
      setErlebnisse(null);
      setErlebnisseError(null);
      // Timeline zuerst (liefert die Tide fürs Flachwasser, REQ-NAV-012),
      // dann automatischer Tiefen-Check mit Tide-Verrechnung.
      void (async () => {
        const tl = await loadTimeline(data.routing!, startIso, data.plan!, myId);
        await checkDepths(data.routing, data.plan, myId, tl);
      })();
    } catch {
      if (myId === reqSeq.current) setError("Netzwerkfehler — bitte später erneut versuchen.");
    } finally {
      if (!opts.silent && myId === reqSeq.current) setLoading(false);
    }
  }

  // Immer die FRISCHE calculate-Instanz fürs Auto-Update-Interval bereithalten:
  // ein Interval über die Closure hätte GPS-Position/Wegpunkte vom Einschalt-
  // Zeitpunkt eingefroren — die "Live-ETA" wäre funktional tot (Finding #3).
  const calcRef = useRef(calculate);
  calcRef.current = calculate;

  // Zeitreise-Overlay: Wolken + Wind an den GEROUTETEN Punkten (max 20,
  // sonst wird die Open-Meteo-Multi-Location-Anfrage unnötig groß).
  async function loadTimeline(
    r: RoutingInfo,
    startIso: string,
    p: RoutePlan,
    myId: number,
  ): Promise<Timeline | null> {
    setTimeline(null);
    setPlaying(false);
    setPlayIdx(0);
    try {
      const pts = thin(r.points, 20).map(({ lat, lon }) => ({ lat, lon }));
      const res = await fetch("/api/weather/timeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          waypoints: pts,
          startTime: startIso,
          endTime: new Date(Date.parse(p.eta) + 3 * 3600e3).toISOString(),
          stepH: 1,
          sensitivity,
          model,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<Timeline>;
      if (myId !== reqSeq.current) return null;
      if (res.ok && data.times?.length && data.points?.length) {
        setTimeline(data as Timeline);
        return data as Timeline;
      }
    } catch {
      // Overlay ist Bonus — der Plan steht auch ohne.
    }
    return null;
  }

  /** Niedrigstwasser (m rel. MSL) am nächstgelegenen Timeline-Punkt über das
      gesamte Törnfenster — bewusst konservativ (REQ-NAV-012): geprüft wird
      gegen das tiefste Wasser der Fahrt, nicht nur den Ankunftsmoment. */
  function minTideAt(tl: Timeline | null, lat: number, lon: number): number | null {
    if (!tl?.points.length) return null;
    let best = tl.points[0];
    let bestD = Infinity;
    // Breitengrad-korrigiert: 1° Lon ist bei 55° N nur ~0,57° Lat wert —
    // sonst gewinnt ein ferner Ost-West-Punkt (Review-Finding kern-mathe).
    const cosLat = Math.cos((lat * Math.PI) / 180);
    for (const tp of tl.points) {
      const d = (tp.lat - lat) ** 2 + ((tp.lon - lon) * cosLat) ** 2;
      if (d < bestD) {
        bestD = d;
        best = tp;
      }
    }
    const tides = best.steps.map((st) => st.tide_m).filter((x): x is number => x != null);
    return tides.length ? Math.min(...tides) : null;
  }

  // Flachwasser-Check: Tiefe an den gerouteten Punkten gegen den Tiefgang.
  // Läuft automatisch nach jeder Berechnung; der Button wiederholt ihn manuell
  // (z. B. nach geändertem Tiefgang). Fehler bleiben in der Tiefen-Karte —
  // die Route selbst ist davon unabhängig gültig.
  async function checkDepths(
    routingArg?: RoutingInfo,
    planArg?: RoutePlan,
    seqId?: number,
    tlArg?: Timeline | null,
  ) {
    const r = routingArg ?? routing;
    const p = planArg ?? plan;
    const tl = tlArg !== undefined ? tlArg : timeline;
    // Snapshot gegen Closure-Race: ändert der Nutzer den Tiefgang WÄHREND die
    // Tiefen-Fetches laufen, muss der Check konsistent mit dem Wert rechnen,
    // mit dem die Anfragen gestartet wurden (Review-Finding ui-races).
    const tiefgangSnapshot = tiefgang;
    if (!r) return;
    const myId = seqId ?? reqSeq.current;
    setDepthLoading(true);
    setDepths(null);
    setDepthError(null);
    try {
      // Abtastdichte an der Routenlänge festmachen (~alle 2 sm, 8–24 Punkte) —
      // 12 fixe Punkte ließen auf langen Routen mehrere Meilen ungeprüft.
      const maxPts = Math.min(24, Math.max(8, Math.ceil((p?.total_nm ?? 20) / 2)));
      const pts = thin(r.points, maxPts);
      const results = await Promise.all(
        pts.map(async (p) => {
          const res = await fetch(
            `/api/navigation/depth?lat=${p.lat}&lon=${p.lon}&tiefgang=${tiefgangSnapshot}`,
          );
          const d = (await res.json().catch(() => ({}))) as {
            depth_m?: number | null;
            check?: FlachwasserStatus;
          };
          // Tide (REQ-NAV-012): Kartentiefe + Niedrigstwasser des Törns;
          // bei Tide-Daten entscheidet die EFFEKTIVE Tiefe (strenger).
          const depthM = res.ok ? (d.depth_m ?? null) : null;
          const tideMin = minTideAt(tl, p.lat, p.lon);
          const depthEff = depthM != null && tideMin != null ? Math.round((depthM + tideMin) * 10) / 10 : null;
          return {
            lat: p.lat,
            lon: p.lon,
            depth_m: depthM,
            tide_min_m: tideMin,
            depth_eff_m: depthEff,
            check: depthEff != null ? flachwasserCheck(depthEff, tiefgangSnapshot) : res.ok ? d.check : undefined,
          };
        }),
      );
      if (myId !== reqSeq.current) return;
      setDepths(results);
      if (results.every((d) => d.check == null)) {
        setDepthError("Tiefendaten gerade nicht verfügbar — später erneut prüfen.");
      }
    } catch {
      if (myId === reqSeq.current)
        setDepthError("Tiefendaten gerade nicht verfügbar — später erneut prüfen.");
    } finally {
      if (myId === reqSeq.current) setDepthLoading(false);
    }
  }

  async function sendFeedback() {
    setFbState("sending");
    try {
      const res = await fetch("/api/weather/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          zufriedenheit: fbRating ?? undefined,
          vorhersage_ok: fbOk ?? undefined,
          freitext: fbText || undefined,
          name: fbName.trim() || undefined,
          email: fbEmail.trim() || undefined,
          kontext: plan
            ? {
                revier: revierId,
                waypoints: effectiveWaypoints,
                startTime: new Date(startTime).toISOString(),
                mode,
                sensitivity,
                model,
                source,
                boat,
                abweichungen: fbIssues,
                plan: {
                  eta: plan.eta,
                  total_nm: plan.total_nm,
                  warnings: plan.warnings,
                  legs: plan.legs.map((l) => ({
                    from: l.from, to: l.to, wind_kn: l.wind_kn, gust_kn: l.gust_kn,
                    wind_from_deg: l.wind_from_deg, wave_m: l.wave_m,
                    depart: l.depart, eta: l.eta, warnings: l.warnings,
                  })),
                },
              }
            : undefined,
        }),
      });
      setFbState(res.ok ? "done" : "idle");
      if (!res.ok) setError("Feedback konnte nicht gespeichert werden — bitte später erneut.");
    } catch {
      setFbState("idle");
      setError("Netzwerkfehler — Feedback nicht gespeichert.");
    }
  }

  // Gemessene Modell-Empfehlung fürs Revier (Feedback-Loop, REQ-WET-011).
  useEffect(() => {
    let alive = true;
    fetch(`/api/weather/model-scores?revier=${encodeURIComponent(revierId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setModelRec(d?.empfehlung ?? null))
      .catch(() => alive && setModelRec(null));
    return () => {
      alive = false;
    };
  }, [revierId]);

  // Vollbild-Karte (REQ-NAV-018): Escape schließt, Body-Scroll wird gesperrt,
  // damit der Hintergrund nicht mitscrollt.
  useEffect(() => {
    if (!mapFull) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMapFull(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mapFull]);

  // Auto-Update: mit GPS-Start alle 60 s still neu rechnen → echte Live-ETA.
  // Über calcRef, damit jeder Tick die AKTUELLE Position/Route nutzt.
  const planVorhanden = plan != null;
  useEffect(() => {
    if (!autoUpdate || !startAtGps || !planVorhanden) return;
    const iv = setInterval(() => void calcRef.current({ silent: true }), 60_000);
    return () => clearInterval(iv);
  }, [autoUpdate, startAtGps, planVorhanden]);

  // Playback-Ticker.
  useEffect(() => {
    if (!playing || !timeline) return;
    const iv = setInterval(() => {
      setPlayIdx((i) => {
        if (i + 1 >= timeline.times.length) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 600);
    return () => clearInterval(iv);
  }, [playing, timeline]);

  const overlay: NavOverlay | null = useMemo(() => {
    if (!timeline || !timeline.times.length) return null;
    const idx = Math.min(playIdx, timeline.times.length - 1);
    const atMs = Date.parse(timeline.times[idx]);
    const points = timeline.points
      .map((p) => ({ lat: p.lat, lon: p.lon, step: p.steps[idx] }))
      .filter((p) => p.step);
    const boatPos =
      plan && routing && routing.points.length >= 2
        ? boatPositionAt(
            routing.points.map((p) => ({ lat: p.lat, lon: p.lon })),
            plan.legs,
            atMs,
          )
        : null;
    return { points, boat: boatPos };
  }, [timeline, playIdx, plan, routing]);

  const routed: NavRoutedLine | null = useMemo(
    () => (routing ? { points: routing.points, segments: routing.segments } : null),
    [routing],
  );

  const luftlinienSegmente = routing?.segments.filter((s) => s.routing === "luftlinie").length ?? 0;
  // "unbekannt" zählt zu den kritischen Punkten: depth_m == null bei
  // erfolgreicher Quelle heißt oft Land-/Trockenfall-Pixel (Wattenmeer!) —
  // ein grünes Häkchen wäre dort gefährlich falsch (Review-Finding #9).
  const kritischeTiefen =
    depths?.filter((d) => d.check === "gefahr" || d.check === "knapp" || d.check === "unbekannt") ??
    [];

  return (
    <div className="wetter-app stack" style={{ gap: 20 }}>
      {showDisclaimer === true && (
        <div className="nav-disclaimer-backdrop" role="dialog" aria-modal="true" aria-labelledby="nav-disclaimer-titel">
          <div className="card stack nav-disclaimer" style={{ gap: 12 }} data-testid="nav-disclaimer">
            <span className="section-label" id="nav-disclaimer-titel">
              Wichtiger Hinweis zur Nutzung
            </span>
            <p style={{ fontSize: 14, lineHeight: 1.7 }}>
              Diese App basiert auf frei verfügbaren Open-Source-Daten
              (OpenStreetMap, OpenSeaMap, EMODnet, GEBCO, Open-Meteo). Sie ist{" "}
              <strong>nicht als Navigationsmittel zugelassen</strong> und darf nur
              unterstützend zur Törn-<em>Planung</em> verwendet werden.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.7 }}>
              Als Skipper bist du verpflichtet, amtliche Seekarten, amtliche
              Warnungen und offizielle Navigationsmittel zu nutzen. Die Nutzung
              erfolgt auf eigene Verantwortung.
            </p>
            <button
              type="button"
              className="btn btn-teal btn-block"
              data-testid="nav-disclaimer-ok"
              onClick={acceptDisclaimer}
            >
              Verstanden — nur zur Planung nutzen
            </button>
          </div>
        </div>
      )}
      <div className="wetter-grid">
        {/* ── linke Spalte: Revier + Karte ── */}
        <div className="stack" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 6 }}>
            <label className="stack" style={{ gap: 6 }}>
              <span className="caption">{t("nav.revier_suchen")}</span>
              <input
                data-testid="nav-revier-search"
                type="search"
                className="wetter-select"
                placeholder="z.B. Palma, Nordsee, Stralsund …"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
              />
            </label>
            {sucheHits.length > 0 && (
              <div className="pills" data-testid="nav-search-hits">
                {sucheHits.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`pill ${r.id === revierId ? "active" : ""}`}
                    onClick={() => {
                      setRevierId(r.id);
                      setSuche("");
                      reset();
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
            <label className="stack" style={{ gap: 6 }}>
              <span className="caption">{t("nav.revier")}</span>
              <select
                data-testid="nav-revier-select"
                className="wetter-select"
                value={revierId}
                onChange={(e) => {
                  setRevierId(e.target.value);
                  reset();
                }}
              >
                {REVIER_GRUPPEN.map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {g.reviere.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>

          {/* Revier-Sicherheitshinweis (z. B. Gezeiten im Wattenmeer) */}
          {revier.warnhinweis && (
            <div className="wetter-warnband" role="note" data-testid="nav-revier-warnhinweis">
              <Icon name="shield" size={16} /> {revier.warnhinweis}
            </div>
          )}

          <div
            data-testid="nav-map"
            className={`wetter-map-frame${mapFull ? " wetter-map-frame--full" : ""}`}
            data-fullscreen={mapFull ? "true" : "false"}
          >
            <button
              type="button"
              data-testid="nav-map-fullscreen"
              className="nav-map-fullscreen-btn"
              aria-pressed={mapFull}
              aria-label={mapFull ? "Karte verkleinern" : "Karte im Vollbild anzeigen"}
              title={mapFull ? "Karte verkleinern" : "Karte im Vollbild anzeigen"}
              onClick={() => setMapFull((v) => !v)}
            >
              <Icon name={mapFull ? "minimize" : "maximize"} size={18} />
            </button>
            <NavMap
              revier={revier}
              waypoints={waypoints}
              onAddWaypoint={addWaypoint}
              onMoveWaypoint={moveWaypoint}
              routed={routed}
              overlay={overlay}
              showDepth={showDepth}
              gps={gps.fix}
              followGps={followGps}
              fullscreen={mapFull}
              peilObjekte={peilObjekte}
              peilLinien={peilLinien}
              peilFix={peilFix}
              symbolsV2={symbolsV2}
              erlebnisse={erlebnisse ?? undefined}
            />
            {peilPickRow != null && (
              <p className="nav-map-toast" data-testid="nav-peil-pick-hint" role="status">
                🎯 Tippe auf der Karte das Objekt an, das du anpeilst (Peilung {peilPickRow + 1}).
              </p>
            )}
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <label className="row" style={{ gap: 6 }}>
              <input
                data-testid="nav-depth-toggle"
                type="checkbox"
                checked={showDepth}
                onChange={(e) => setShowDepth(e.target.checked)}
              />
              <span className="caption">Tiefen-Layer (EMODnet)</span>
            </label>
            <span className="caption">
              Route: <span className="nav-legend-wasser">— Wasserweg</span> ·{" "}
              <span className="nav-legend-luft">- - Luftlinie</span>
            </span>
          </div>

          {/* Zeitreise: Wolkenfelder + Wind über die Zeit */}
          {timeline && timeline.times.length > 1 && (
            <div className="card stack" style={{ gap: 8 }} data-testid="nav-playback-panel">
              <div className="row-between">
                <span className="section-label">
                  {symbolsV2 ? "Wetter über die Zeit" : "Wolken & Wind über die Zeit"}
                  {/* REQ-WET-017: Darstellung zur Laufzeit wählbar, Wahl bleibt gespeichert. */}
                  <button
                    type="button"
                    data-testid="nav-symbol-toggle"
                    className="nav-symbol-toggle"
                    onClick={toggleSymbolWahl}
                    title={umschaltBeschriftung(symbolWahl)}
                    aria-label={umschaltBeschriftung(symbolWahl)}
                  >
                    {symbolsV2 ? "⇢ Pfeile" : "⇢ Windfahnen"}
                  </button>
                </span>
                <span className="caption" data-testid="nav-playback-time">
                  {fmtEta(timeline.times[Math.min(playIdx, timeline.times.length - 1)])}
                </span>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button
                  type="button"
                  data-testid="nav-playback-toggle"
                  className="wetter-remove"
                  aria-label={playing ? "Pause" : "Abspielen"}
                  onClick={() => {
                    if (!playing && playIdx >= timeline.times.length - 1) setPlayIdx(0);
                    setPlaying((p) => !p);
                  }}
                >
                  <Icon name={playing ? "x" : "play"} size={16} />
                </button>
                <input
                  type="range"
                  data-testid="nav-playback-slider"
                  className="wetter-slider"
                  style={{ flex: 1 }}
                  min={0}
                  max={timeline.times.length - 1}
                  step={1}
                  value={Math.min(playIdx, timeline.times.length - 1)}
                  onChange={(e) => {
                    setPlaying(false);
                    setPlayIdx(Number(e.target.value));
                  }}
                  aria-label="Zeitpunkt im Playback"
                />
              </div>
              <p className="caption">
                {symbolsV2 ? (
                  <>
                    Graue Flächen = Wolkenfelder (je dichter, desto dunstiger) · Windfahnen =
                    Richtung &amp; Stärke (Halbstrich 5 kn, Strich 10 kn, Wimpel 50 kn, Schaft zeigt
                    zur Herkunft) · Zahl = Knoten, ° = Temperatur · 🌦️/🌧️/⛈️ Regen (leicht/mäßig/
                    stark) · ☀️/🌙 klar (Tag/Nacht), 🌤️ heiter, ⛅ wolkig, ☁️ bedeckt · ⚡ Gewitter ·
                    ⛵ ungefähre Bootsposition zu diesem Zeitpunkt.
                  </>
                ) : (
                  <>
                    Graue Flächen = Wolkenfelder (je dichter, desto dunstiger) · Pfeile = Wind ·
                    ☀️/🌙 klar (Tag/Nacht), 🌤️ heiter, ⛅ wolkig, ☁️ bedeckt · ⚡ Gewitter ·
                    ⛵ ungefähre Bootsposition zu diesem Zeitpunkt.
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* ── rechte Spalte: GPS, Route, Abfahrt ── */}
        <div className="stack" style={{ gap: 16 }}>
          {/* GPS — Sub-Tool (REQ-NAV-024): eingeklappt, für die reine Planung
              nicht nötig; wer die Live-Position will, klappt es auf. */}
          <details className="card nav-subtool">
            <summary className="section-label" data-testid="nav-tool-gps">
              Meine Position (GPS)
            </summary>
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {gps.status !== "watching" ? (
                <button
                  type="button"
                  data-testid="nav-gps-start"
                  className="btn btn-outline-teal"
                  onClick={gps.start}
                >
                  <Icon name="map-pin" size={14} /> GPS aktivieren
                </button>
              ) : (
                <button type="button" data-testid="nav-gps-stop" className="btn btn-outline-teal" onClick={gps.stop}>
                  GPS stoppen
                </button>
              )}
              <span className="caption" data-testid="nav-gps-status" role="status">
                {gps.status === "idle" && "aus"}
                {gps.status === "watching" &&
                  (gps.fix
                    ? `aktiv · ±${Math.round(gps.fix.accuracy_m)} m${gps.fix.speed_kn != null ? ` · ${gps.fix.speed_kn} kn` : ""}`
                    : "suche Satelliten …")}
                {gps.status === "denied" && "Standort ist für diese Seite/den Browser blockiert."}
                {gps.status === "unavailable" && "GPS hier nicht verfügbar."}
              </span>
            </div>
            {(gps.status === "denied" || gps.status === "unavailable") && (
              <div className="wetter-warnband stack" style={{ gap: 6, fontSize: 12 }} data-testid="nav-gps-help">
                <strong>So schaltest du den Standort frei:</strong>
                {geraet.os === "ios-safari" && (
                  <ol className="stack" style={{ gap: 2, paddingLeft: 18, margin: 0 }} data-testid="nav-gps-help-ios-safari">
                    <li>Einstellungen → Datenschutz &amp; Sicherheit → <strong>Ortungsdienste</strong> einschalten</li>
                    <li>Gleich darunter: <strong>Safari-Websites</strong> → „Beim Verwenden“</li>
                    <li>Hierher zurück, Seite neu laden, „GPS aktivieren“ tippen</li>
                  </ol>
                )}
                {geraet.os === "ios-dritt" && (
                  <ol className="stack" style={{ gap: 2, paddingLeft: 18, margin: 0 }} data-testid="nav-gps-help-ios-dritt">
                    <li>Einstellungen → Datenschutz &amp; Sicherheit → <strong>Ortungsdienste</strong> einschalten</li>
                    <li>
                      Einstellungen → <strong>{geraet.browser || "dein Browser"}</strong> → <strong>Standort</strong> →
                      „Beim Verwenden der App“ <em>(diesen Schritt übersehen die meisten)</em>
                    </li>
                    <li>Hierher zurück, Seite neu laden, „GPS aktivieren“ tippen</li>
                  </ol>
                )}
                {geraet.os === "android" && (
                  <ol className="stack" style={{ gap: 2, paddingLeft: 18, margin: 0 }} data-testid="nav-gps-help-android">
                    <li><strong>Schloss-Symbol</strong> in der Adresszeile → Berechtigungen → <strong>Standort</strong> → Zulassen</li>
                    <li>Falls das fehlt: Android-Einstellungen → Apps → dein Browser → Berechtigungen → Standort</li>
                    <li>Seite neu laden, „GPS aktivieren“ tippen</li>
                  </ol>
                )}
                {geraet.os === "desktop" && (
                  <ol className="stack" style={{ gap: 2, paddingLeft: 18, margin: 0 }} data-testid="nav-gps-help-desktop">
                    <li><strong>Schloss-Symbol</strong> links in der Adresszeile → <strong>Standort</strong> → Zulassen</li>
                    <li>Seite neu laden, „GPS aktivieren“ tippen</li>
                  </ol>
                )}
                <button
                  type="button"
                  data-testid="nav-gps-retry"
                  className="pill"
                  style={{ alignSelf: "flex-start" }}
                  onClick={gps.start}
                >
                  Standort erneut anfragen
                </button>
                <span className="caption">
                  Ein direkter Link in die Einstellungen ist Webseiten von Apple/Google gesperrt —
                  in unserer App fürs iPhone/Android kommt der Ein-Klick-Knopf.
                </span>
              </div>
            )}
            {gps.fix && (
              <>
                <label className="row" style={{ gap: 6 }}>
                  <input
                    data-testid="nav-follow"
                    type="checkbox"
                    checked={followGps}
                    onChange={(e) => setFollowGps(e.target.checked)}
                  />
                  <span className="caption">Karte folgt meiner Position</span>
                </label>
                <label className="row" style={{ gap: 6 }}>
                  <input
                    data-testid="nav-start-at-gps"
                    type="checkbox"
                    checked={startAtGps}
                    onChange={(e) => setStartAtGps(e.target.checked)}
                  />
                  <span className="caption">
                    Route startet an meiner Position (Abfahrt = jetzt → echte Ankunftszeiten)
                  </span>
                </label>
                {startAtGps && plan && (
                  <label className="row" style={{ gap: 6 }}>
                    <input
                      data-testid="nav-auto-update"
                      type="checkbox"
                      checked={autoUpdate}
                      onChange={(e) => setAutoUpdate(e.target.checked)}
                    />
                    <span className="caption">ETA automatisch aktualisieren (alle 60 s)</span>
                  </label>
                )}
              </>
            )}
            </div>
          </details>

          {/* Jetzt & hier (REQ-NAV-024): aktuelle Bedingungen an der Position */}
          <details className="card nav-subtool" data-testid="nav-jetzt">
            <summary className="section-label" data-testid="nav-tool-jetzt">
              Jetzt &amp; hier — Position, Wetter, Häfen
            </summary>
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
              {!gps.fix ? (
                <p className="caption" data-testid="nav-jetzt-hint">
                  Aktiviere oben „Meine Position (GPS)“, um aktuelles Wetter, die Tiefe unter dem
                  Kiel und die nächsten Häfen an deiner Position zu sehen.
                </p>
              ) : (
                <>
                  {revierVorschlag && (
                    <div
                      className="wetter-warnband"
                      style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                      data-testid="nav-jetzt-revier-vorschlag"
                    >
                      Du bist am nächsten an <strong>{revierVorschlag.label}</strong> (
                      {revierVorschlag.distance_nm} sm).
                      <button
                        type="button"
                        data-testid="nav-jetzt-revier-switch"
                        className="pill"
                        onClick={() => setRevierId(revierVorschlag.id)}
                      >
                        Dorthin wechseln
                      </button>
                    </div>
                  )}
                  <div className="row-between">
                    <span className="caption">
                      Position {gps.fix.lat.toFixed(3)}, {gps.fix.lon.toFixed(3)}
                    </span>
                    <button
                      type="button"
                      data-testid="nav-jetzt-load"
                      className="pill"
                      disabled={jetztState === "laden"}
                      onClick={() => void loadJetzt()}
                    >
                      {jetztState === "laden" ? "Lade …" : jetztWx ? "Aktualisieren" : "Bedingungen laden"}
                    </button>
                  </div>
                  {jetztState === "fehler" && (
                    <p className="caption" data-testid="nav-jetzt-error" role="alert">
                      Bedingungen gerade nicht verfügbar — bitte später erneut.
                    </p>
                  )}
                  {jetztWx && (
                    <div className="stack" style={{ gap: 6 }} data-testid="nav-jetzt-result">
                      <p className="caption">
                        <strong>Wetter:</strong> {jetztWx.wind_kn} kn aus{" "}
                        {compassPoint(jetztWx.wind_from_deg)} · Böen {jetztWx.gust_kn} kn
                        {jetztWx.wave_m != null ? ` · Welle ${jetztWx.wave_m} m` : ""}
                        {jetztWx.current_kn != null && jetztWx.current_kn > 0
                          ? ` · Strom ${jetztWx.current_kn} kn`
                          : ""}
                      </p>
                      {(jetztWx.gale || jetztWx.thunderstorm || jetztWx.high_wave) && (
                        <p className="wetter-warnband" style={{ fontSize: 12 }} data-testid="nav-jetzt-warn">
                          {[
                            jetztWx.gale && "Sturm",
                            jetztWx.thunderstorm && "Gewitter",
                            jetztWx.high_wave && "hohe Welle",
                          ]
                            .filter(Boolean)
                            .join(" · ")}{" "}
                          — Vorsicht.
                        </p>
                      )}
                      {jetztDepth && (
                        <p className="caption" data-testid="nav-jetzt-depth">
                          <strong>Unter dem Kiel:</strong> {jetztDepth.depth_m} m Wassertiefe
                          {jetztDepth.check ? ` · ${jetztDepth.check}` : ""}
                        </p>
                      )}
                    </div>
                  )}
                  {jetztHaefen.length > 0 && (
                    <div className="stack" style={{ gap: 2 }} data-testid="nav-jetzt-haefen">
                      <span className="caption">
                        <strong>Nächste Häfen:</strong>
                      </span>
                      {jetztHaefen.map((h) => (
                        <span key={`${h.revier}-${h.name}`} className="caption">
                          {h.name} ({h.revier}) — {h.distance_nm} sm {h.kompass}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </details>

          {/* Peilung — Kreuzpeilung als GPS-Backup (REQ-NAV-025/026) */}
          <details className="card nav-subtool" data-testid="nav-peilung">
            <summary className="section-label" data-testid="nav-tool-peilung">
              Peilung — Standort-Backup (wenn GPS spinnt)
            </summary>
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
              <p className="caption">
                <strong>Handy aufrecht halten und mit der Kamera-Rückseite auf das Objekt zielen</strong>,
                dann „Kompass“ tippen. Peile 2–3 markante Objekte an
                — der Schnitt der Peilungen ergibt deinen Standort. Klassische Seemannschaft als
                Rückfall, wenn die GPS-Position unplausibel wirkt. <strong>Planungshilfe</strong>,
                ersetzt keinen Handpeilkompass und keine amtliche Seekarte.
              </p>
              {peilRefs.length < 2 ? (
                <p className="caption" data-testid="nav-peil-hint">
                  Keine Referenzpunkte in der Nähe — wähle ein passendes Revier oder aktiviere GPS.
                </p>
              ) : (
                <>
                  <label className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    <span className="caption">Missweisung (° Ost, grobe Näherung)</span>
                    <input
                      data-testid="nav-peil-missweisung"
                      type="number"
                      step={1}
                      className="wetter-select"
                      style={{ width: 76, minHeight: 44, fontSize: 16 }}
                      value={missweisung !== "" ? missweisung : String(missweisungForRevier(revierId))}
                      onChange={(e) => setMissweisung(e.target.value)}
                      aria-label="Missweisung in Grad Ost"
                    />
                  </label>
                  {peilRows.map((row, i) => (
                    <div key={i} className="stack" style={{ gap: 4 }}>
                      <span className="caption">Peilung {i + 1}</span>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        {row.custom ? (
                          <span
                            className="pill"
                            data-testid={`nav-peil-custom-${i}`}
                            style={{ flex: 1, minWidth: 140, display: "flex", justifyContent: "space-between", gap: 6 }}
                          >
                            📍 Objekt {row.custom.lat.toFixed(3)}, {row.custom.lon.toFixed(3)}
                            <button
                              type="button"
                              data-testid={`nav-peil-custom-clear-${i}`}
                              aria-label="Objekt entfernen"
                              onClick={() =>
                                setPeilRows((rows) =>
                                  rows.map((r, j) => (j === i ? { ...r, custom: undefined } : r)),
                                )
                              }
                              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
                            >
                              ×
                            </button>
                          </span>
                        ) : (
                          <select
                            data-testid={`nav-peil-ref-${i}`}
                            className="wetter-select"
                            style={{ flex: 1, minWidth: 120, minHeight: 44, fontSize: 16 }}
                            value={row.refName}
                            onChange={(e) =>
                              setPeilRows((rows) =>
                                rows.map((r, j) => (j === i ? { ...r, refName: e.target.value } : r)),
                              )
                            }
                          >
                            <option value="">Objekt wählen …</option>
                            {peilRefs.map((h) => (
                              <option key={`${h.revier}::${h.name}`} value={`${h.revier}::${h.name}`}>
                                {h.name} ({h.revier}) — {h.distance_nm} sm {h.kompass}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          data-testid={`nav-peil-pick-${i}`}
                          className={`pill ${peilPickRow === i ? "active" : ""}`}
                          title="Objekt auf der Karte antippen (z. B. ein Turm an Land)"
                          onClick={() => setPeilPickRow(peilPickRow === i ? null : i)}
                        >
                          📍 Karte
                        </button>
                        <input
                          data-testid={`nav-peil-mag-${i}`}
                          type="number"
                          min={0}
                          max={359}
                          inputMode="numeric"
                          className="wetter-select"
                          style={{ width: 84, minHeight: 44, fontSize: 16 }}
                          placeholder="° mag"
                          value={row.magnetic}
                          onChange={(e) =>
                            setPeilRows((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, magnetic: e.target.value } : r)),
                            )
                          }
                          aria-label={`Magnetische Peilung ${i + 1} in Grad`}
                        />
                        <button
                          type="button"
                          data-testid={`nav-peil-capture-${i}`}
                          className={`pill ${peilCapturing === i ? "active" : ""}`}
                          title="Kompass-Peilung vom Handy übernehmen"
                          disabled={peilCapturing === i}
                          onClick={() => void captureHeading(i)}
                        >
                          {peilCapturing === i ? "Kompass …" : "Kompass"}
                        </button>
                      </div>
                      {peilNoSignal === i && (
                        <span className="caption" data-testid={`nav-peil-nosignal-${i}`} style={{ color: "var(--warn, #d9534f)" }}>
                          ⚠ Kein gültiges Kompass-Signal — bitte manuell eintragen oder Handy in einer
                          8 bewegen (kalibrieren) und erneut „Kompass“ tippen.
                        </span>
                      )}
                      {peilSpread?.row === i && (
                        <span
                          className="caption"
                          data-testid={`nav-peil-spread-${i}`}
                          style={peilSpread.spread > 15 ? { color: "var(--warn, #d9534f)" } : undefined}
                        >
                          {peilSpread.spread > 15
                            ? `⚠ Kompass unruhig (±${peilSpread.spread}° über ${peilSpread.n} Messungen) — Handy in einer 8 bewegen und erneut messen.`
                            : `Kompass ruhig (±${peilSpread.spread}° über ${peilSpread.n} Messungen).`}
                        </span>
                      )}
                    </div>
                  ))}
                  {peilRows.length < 3 && (
                    <button
                      type="button"
                      data-testid="nav-peil-add"
                      className="pill"
                      onClick={() => setPeilRows((rows) => [...rows, { refName: "", magnetic: "" }])}
                    >
                      + 3. Peilung (genauer)
                    </button>
                  )}
                  {peilFix ? (
                    <div className="stack" style={{ gap: 4 }} data-testid="nav-peil-fix">
                      <p className="caption">
                        <strong>Geschätzter Standort:</strong> {peilFix.lat.toFixed(4)},{" "}
                        {peilFix.lon.toFixed(4)}
                        {Number.isFinite(peilUnsicherheit)
                          ? ` · Unsicherheit ± ${peilUnsicherheit < 0.1 ? Math.round(peilUnsicherheit * 1852) + " m" : peilUnsicherheit.toFixed(2) + " sm"}`
                          : ""}
                        {peilFix.n >= 3 ? ` · Fehlerdreieck ± ${peilFix.error_nm} sm` : ""}
                      </p>
                      <p className="caption">
                        Schnittwinkel {peilCut}° {peilBrauchbar ? "(brauchbar)" : "(zu spitz!)"}
                      </p>
                      {!peilBrauchbar && (
                        <p className="wetter-warnband" style={{ fontSize: 12 }} data-testid="nav-peil-geometrie" role="alert">
                          ⚠ Die Peillinien liegen fast übereinander (Schnittwinkel {peilCut}°) — der
                          Schnittpunkt ist Zufall und <strong>nicht verwertbar</strong>. Wähle Objekte,
                          die von dir aus möglichst <strong>~90° auseinander</strong> liegen. Solange
                          gibt es kein GPS-Urteil.
                        </p>
                      )}
                      {peilPlaus && (
                        <p
                          className={peilPlaus.plausibel ? "caption" : "wetter-warnband"}
                          style={{ fontSize: 12 }}
                          data-testid="nav-peil-plaus"
                          role={peilPlaus.plausibel ? undefined : "alert"}
                        >
                          {peilPlaus.plausibel
                            ? `GPS deckt sich mit der Peilung: ${peilPlaus.deviation_nm} sm Abweichung (erlaubt bis ${peilPlaus.toleranz_nm} sm).`
                            : `⚠ GPS weicht ${peilPlaus.deviation_nm} sm ab — mehr als die ${peilPlaus.toleranz_nm} sm, die Kompass + GPS-Genauigkeit hergeben. Position prüfen, Kompass kalibrieren, Peilungen wiederholen.`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="caption" data-testid="nav-peil-need">
                      Mindestens 2 Objekte mit Peilung eingeben.
                    </p>
                  )}
                </>
              )}
            </div>
          </details>

          {/* Wegpunkte */}
          <div className="card stack" style={{ gap: 8 }}>
            <span className="section-label">Route</span>
            {startAtGps && gps.fix && (
              <p className="caption row" style={{ gap: 6 }} data-testid="nav-gps-startpoint">
                <Icon name="map-pin" size={13} /> Start: Meine Position (
                {gps.fix.lat.toFixed(3)}, {gps.fix.lon.toFixed(3)})
              </p>
            )}
            {waypoints.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                Karte oder Hafen anklicken — die Route weicht Land automatisch aus.
              </p>
            ) : (
              <ol className="wetter-wp-list">
                {waypoints.map((w, i) => (
                  <li key={w.id} data-testid="nav-waypoint-item">
                    <span className="row-between">
                      <span className="row" style={{ gap: 8 }}>
                        <span className="wp-marker wp-marker-inline">{i + 1}</span>
                        <span style={{ fontSize: 13 }}>
                          {w.name || `${w.lat.toFixed(3)}, ${w.lon.toFixed(3)}`}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="wetter-remove"
                        aria-label={`Wegpunkt ${i + 1} entfernen`}
                        onClick={() => removeWaypoint(w.id)}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </span>
                    {/* Liegezeit an Zwischenstopps: Dauer (h/min) ⇄ Uhrzeit,
                        bidirektional über die berechnete Ankunft (REQ-NAV-017). */}
                    {i > 0 && i < waypoints.length - 1 && (
                      <div className="stack" style={{ gap: 4, paddingLeft: 28 }}>
                        {arrivals[w.id] ? (
                          <span className="caption" data-testid="nav-arrival">
                            Ankunft {fmtEta(arrivals[w.id])}
                          </span>
                        ) : (w.stay_min != null || w.depart_at) && (
                          <span className="caption" data-testid="nav-arrival-pending">
                            Dauer und Uhrzeit werden nach „Route berechnen“ gekoppelt.
                          </span>
                        )}
                        <label className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                          <span className="caption">Liegezeit</span>
                          <input
                            type="number"
                            min={0}
                            max={168}
                            inputMode="numeric"
                            data-testid="nav-stay-h"
                            className="wetter-select"
                            style={{ minHeight: 44, fontSize: 16, width: 76 }}
                            placeholder="0"
                            value={stayFieldsFor(w).h}
                            onChange={(e) => setWaypointStay(w.id, e.target.value, stayFieldsFor(w).m)}
                            aria-label={`Liegezeit Stunden an Wegpunkt ${i + 1}`}
                          />
                          <span className="caption">h</span>
                          <input
                            type="number"
                            min={0}
                            max={59}
                            inputMode="numeric"
                            data-testid="nav-stay-min"
                            className="wetter-select"
                            style={{ minHeight: 44, fontSize: 16, width: 76 }}
                            placeholder="0"
                            value={stayFieldsFor(w).m}
                            onChange={(e) => setWaypointStay(w.id, stayFieldsFor(w).h, e.target.value)}
                            aria-label={`Liegezeit Minuten an Wegpunkt ${i + 1}`}
                          />
                          <span className="caption">min</span>
                        </label>
                        <label className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                          <span className="caption">Weiterfahrt ab</span>
                          <input
                            type="datetime-local"
                            data-testid="nav-depart-at"
                            className="wetter-select"
                            style={{ minHeight: 44, fontSize: 16, maxWidth: 230 }}
                            value={departFieldFor(w)}
                            onChange={(e) => setWaypointDepart(w.id, e.target.value)}
                            aria-label={`Weiterfahrt ab Wegpunkt ${i + 1}`}
                          />
                        </label>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {waypoints.length > 0 && (
              <button type="button" className="btn btn-outline-teal" onClick={reset}>
                Zurücksetzen
              </button>
            )}
          </div>

          {/* Abfahrt + Modus + Tiefgang */}
          <div className="card stack" style={{ gap: 12 }}>
            {!startAtGps && (
              <label className="stack" style={{ gap: 6 }}>
                <span className="caption">Abfahrt (bis 7 Tage voraus)</span>
                <input
                  data-testid="nav-start-time"
                  type="datetime-local"
                  className="wetter-select"
                  value={startTime}
                  max={maxStart}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
            )}
            <div className="row" style={{ gap: 8 }} role="radiogroup" aria-label="Fahrmodus">
              <button
                type="button"
                role="radio"
                className={`pill ${mode === "sail" ? "active" : ""}`}
                aria-checked={mode === "sail"}
                onClick={() => setMode("sail")}
                title="So viel wie möglich segeln — Motor nur bei Flaute oder hart am Wind"
              >
                Segeln (Motor wenn nötig)
              </button>
              <button
                type="button"
                role="radio"
                className={`pill ${mode === "motor" ? "active" : ""}`}
                aria-checked={mode === "motor"}
                onClick={() => setMode("motor")}
              >
                Motor
              </button>
            </div>
            <label className="stack" style={{ gap: 4 }}>
              <span className="caption">{t("nav.tiefgang_label")}</span>
              <input
                data-testid="nav-tiefgang"
                type="number"
                min={0.2}
                max={20}
                step={0.1}
                className="wetter-select"
                value={tiefgangStr}
                onChange={(e) => setTiefgangStr(e.target.value)}
              />
            </label>
          </div>

          {/* Boot (REQ-NAV-008): Presets + Ableitung — fließt in die ETA ein */}
          <details className="card nav-subtool">
            <summary className="section-label" data-testid="nav-tool-boot">
              Boot anpassen (optional)
            </summary>
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
              <div className="pills">
                {BOAT_PRESETS.map((ps) => (
                  <button
                    key={ps.id}
                    type="button"
                    data-testid={`nav-boat-preset-${ps.id}`}
                    className={`pill ${specs.name === ps.specs.name ? "active" : ""}`}
                    onClick={() => applyPreset(ps.specs)}
                  >
                    {ps.label}
                  </button>
                ))}
              </div>
              <p className="caption" data-testid="nav-boat-derived">
                → Rumpfgeschwindigkeit {boat.hull_speed_kn} kn ·{" "}
                {boat.has_engine ? `Marschfahrt ${boat.cruise_speed_motor_kn} kn` : "ohne Motor"}
                {boat.min_wind_kn != null ? ` · min ${boat.min_wind_kn} kn Wind` : ""}
                {boat.max_wind_kn != null ? ` · max ${boat.max_wind_kn} kn` : ""}
                {" "}· Preset setzt auch den Tiefgang
              </p>
            </div>
          </details>

          {/* Warn-Empfindlichkeit (REQ-NAV-015) */}
          <div className="card stack" style={{ gap: 10 }}>
            <span className="section-label">Warn-Empfindlichkeit</span>
            <input
              data-testid="risk-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="wetter-slider"
              aria-label="Warn-Empfindlichkeit: 0 risikofreudig bis 1 vorsichtig"
            />
            <div className="row-between" style={{ fontSize: 11 }}>
              <span className="muted">Risikofreudig — wenige Fehlalarme</span>
              <span className="muted">Vorsichtig — keine verpasste Warnung</span>
            </div>
            <p className="caption">
              Fehlalarm (FP) heißt: unnötig in den Hafen. Verpasste Warnung (FN) heißt: ungewarnt
              im Sturm — schwere Stürme (≥&nbsp;9&nbsp;Bft) warnen deshalb immer, unabhängig vom
              Regler.
            </p>
            {/* Wettermodell — transparent wählbar, mit gemessener Revier-Empfehlung */}
            <label className="stack" style={{ gap: 6 }}>
              <span className="caption">Wettermodell</span>
              <select
                data-testid="model-select"
                className="wetter-select"
                value={model}
                onChange={(e) => setModel(e.target.value as WeatherModel)}
              >
                {(Object.keys(WEATHER_MODELS) as WeatherModel[]).map((m) => (
                  <option key={m} value={m}>
                    {WEATHER_MODELS[m].label}
                  </option>
                ))}
              </select>
              <span className="caption" data-testid="model-reason">
                {WEATHER_MODELS[model].grund}
              </span>
              {modelRec && modelRec.model !== model && (
                <span className="caption row" style={{ gap: 6 }} data-testid="model-recommendation">
                  📊 Gemessen fürs Revier: <strong>{modelRec.label}</strong> trifft am besten
                  (Böen-MAE {modelRec.mae_gust_kn} kn, n={modelRec.n_samples})
                  <button
                    type="button"
                    className="pill"
                    data-testid="model-adopt"
                    onClick={() => setModel(modelRec.model as WeatherModel)}
                  >
                    übernehmen
                  </button>
                </span>
              )}
            </label>
          </div>

          {/* Routen-Profil (REQ-NAV-019): kürzester / Segel- / Motor- / Komfort-Weg */}
          <div className="card stack" style={{ gap: 8 }}>
            <span className="section-label">Welcher Weg?</span>
            <div className="pills" role="radiogroup" aria-label="Routen-Profil">
              {(
                [
                  ["kuerzeste", "Kürzester", "reiner Wasserweg, ohne Wetter"],
                  ["segel", "Segel-schnell", "meidet Flaute, kreuzt durch die No-Go-Zone"],
                  ["motor", "Motor-schnell", "Marschfahrt, hohe Welle bremst"],
                  ["komfort", "Komfort", "meidet Seegang und Starkwind, auch per Umweg"],
                ] as const
              ).map(([wert, label, hint]) => (
                <button
                  key={wert}
                  type="button"
                  role="radio"
                  aria-checked={routeProfil === wert}
                  data-testid={`nav-profil-${wert}`}
                  className={`pill ${routeProfil === wert ? "active" : ""}`}
                  title={hint}
                  onClick={() => setRouteProfil(wert)}
                >
                  {label}
                </button>
              ))}
            </div>
            {routeProfil !== "kuerzeste" && (
              <p className="caption" data-testid="nav-profil-hinweis">
                Wetter-bepreister Weg zur Abfahrtszeit — Planungshilfe, ersetzt keine
                laufende Wetterbeobachtung unterwegs.
              </p>
            )}
          </div>

          {/* Abfahrts-Scan (REQ-NAV-009) — Sub-Tool (REQ-NAV-024), eingeklappt */}
          <details className="card nav-subtool">
            <summary className="section-label" data-testid="nav-tool-scan">
              Beste Abfahrt finden
            </summary>
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            <label className="stack" style={{ gap: 4 }}>
              <span className="caption">spätester Start</span>
              <input
                data-testid="nav-departure-to"
                type="datetime-local"
                className="wetter-select"
                value={scanTo}
                onChange={(e) => setScanTo(e.target.value)}
              />
            </label>
            <button
              data-testid="nav-departure-scan"
              type="button"
              className="btn btn-outline-teal btn-block"
              disabled={!canCalc || loading}
              onClick={() => void calculate({ scanWindowEnd: new Date(scanTo).toISOString() })}
            >
              Abfahrt empfehlen (über Wasserweg)
            </button>
            {scan && (
              <div className="stack" style={{ gap: 6 }} data-testid="nav-departure-result">
                {scan.all_windy && (
                  <p className="wetter-warnband" style={{ fontSize: 12 }}>
                    Im ganzen Fenster gibt es Warnungen — unten der am wenigsten kritische Slot.
                  </p>
                )}
                <ol className="wetter-slot-list">
                  {scan.slots.map((sl) => {
                    const isRec = scan.recommended?.departure === sl.departure;
                    return (
                      <li key={sl.departure}>
                        <button
                          type="button"
                          data-testid={isRec ? "nav-departure-recommended" : "nav-departure-slot"}
                          className={`wetter-slot ${sl.avoid ? "avoid" : ""} ${isRec ? "recommended" : ""}`}
                          onClick={() => {
                            setStartTime(toLocalInput(new Date(sl.departure)));
                            void calculate();
                          }}
                          title={sl.warnings.join(" · ") || "keine Warnungen"}
                        >
                          <span className="row" style={{ gap: 6 }}>
                            <Icon name={sl.avoid ? "shield" : "check"} size={14} />
                            {fmtEta(sl.departure)}
                          </span>
                          <span className="caption">
                            {sl.avoid
                              ? sl.warnings[0]
                              : `${sl.min_wind_kn}–${sl.max_wind_kn} kn Wind · Böen ${sl.max_gust_kn} · ${sl.duration_h} h${isRec ? " · empfohlen" : ""}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            </div>
          </details>

          <button
            data-testid="nav-calc"
            type="button"
            className="btn btn-teal btn-block"
            disabled={!canCalc || loading}
            onClick={() => void calculate()}
          >
            {loading ? t("nav.berechne_laeuft") : t("nav.berechnen")}
            {!loading && <Icon name="arrow-right" size={16} />}
          </button>
            {!canCalc && (
              <p className="caption" data-testid="nav-calc-hint">
                {t("nav.mindestens_zwei")}
              </p>
            )}
        </div>
      </div>

      {/* ── Ergebnis ── */}
      {loading && (
        <div className="grid-features" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="card wetter-skeleton" style={{ height: 120 }} />
          ))}
        </div>
      )}

      {snapHinweis && (
        <p className="caption" data-testid="nav-snap-hinweis" role="status">
          ⚓ {snapHinweis}
        </p>
      )}

      {error && (
        <div className="wetter-error" role="alert" data-testid="nav-error">
          <Icon name="info-circle" size={18} /> {error}
        </div>
      )}

      {plan && routing && !loading && (
        <div data-testid="nav-result" className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <span className="tag phase-planung">Navigation</span>
            {source === "open-meteo-archive" && (
              <span className="tag badge-verworfen" data-testid="archive-badge">
                Archivdaten · Validierung
              </span>
            )}
            <strong>{plan.total_nm} sm</strong>
            <span className="muted" data-testid="nav-eta">
              Ankunft {fmtEta(plan.eta)}
              {(() => {
                const fahrtH = plan.legs.reduce((a, l) => a + (l.duration_h ?? 0), 0);
                return fahrtH > 0 ? ` · Ø ${(plan.total_nm / fahrtH).toFixed(1)} kn` : "";
              })()}
            </span>
            {plan.eta_alternative && (
              <span className="caption" data-testid="nav-eta-alternative">
                (unter Segeln kreuzend: {fmtEta(plan.eta_alternative)})
              </span>
            )}
            <button
              type="button"
              data-testid="nav-gpx-export"
              className="pill"
              title={t("nav.gpx_titel")}
              onClick={() => {
                const pts = (routing?.points ?? effectiveWaypoints).map((p) => ({
                  lat: p.lat,
                  lon: p.lon,
                  name: (p as { name?: string | null }).name ?? null,
                }));
                const blob = new Blob([gpxFromRoute(pts, plan)], { type: "application/gpx+xml" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "jtc-toern.gpx";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              GPX ↓
            </button>
            <button
              type="button"
              data-testid="nav-share-toern"
              className="pill"
              title={t("nav.teilen_titel")}
              disabled={shareState === "laden"}
              onClick={() => void shareToern()}
            >
              {shareState === "laden" ? "Erzeuge Link …" : "Törn teilen"}
            </button>
            {startAtGps && (
              <span className="tag phase-auf_dem_toern" data-testid="nav-live-badge">
                ab eigener Position
              </span>
            )}
          </div>

          <p className="caption" data-testid="nav-routing-hinweis">
            {routing.hinweis}
            {luftlinienSegmente > 0 &&
              ` · ${luftlinienSegmente} Teilstrecke(n) als Luftlinie (außerhalb der Maske).`}
          </p>

          {shareState === "fehler" && (
            <p className="caption" role="status" data-testid="nav-share-error">
              Link konnte gerade nicht erzeugt werden — später erneut versuchen.
            </p>
          )}
          {shareUrl && (
            <p className="caption" data-testid="nav-share-result">
              Geteilter Törn-Link:{" "}
              <a href={shareUrl} target="_blank" rel="noreferrer">
                {shareUrl}
              </a>
            </p>
          )}

          {plan.warnings.length > 0 && (
            <div className="wetter-warnband stack" style={{ gap: 6 }}>
              {plan.warnings.map((w, i) => (
                <div key={i} data-testid="nav-warning-item" className="row" style={{ gap: 8 }}>
                  <Icon name="shield" size={16} /> {w}
                </div>
              ))}
            </div>
          )}

          {/* Flachwasser-Check */}
          <div className="card stack" style={{ gap: 8 }}>
            <div className="row-between">
              <span className="section-label">Tiefen entlang der Route</span>
              <button
                type="button"
                data-testid="nav-depth-check"
                className="btn btn-outline-teal"
                disabled={depthLoading}
                onClick={() => void checkDepths()}
              >
                {depthLoading ? "Prüfe …" : `Erneut gegen ${tiefgang} m Tiefgang prüfen`}
              </button>
            </div>
            {depthLoading && !depths && (
              <p className="caption" data-testid="nav-depth-loading">
                Tiefen entlang der Route werden automatisch geprüft …
              </p>
            )}
            {depthError && (
              <p className="caption" role="status" data-testid="nav-depth-error">
                {depthError}
              </p>
            )}
            {depths && (
              <div className="stack" style={{ gap: 6 }} data-testid="nav-depth-result">
                {kritischeTiefen.length > 0 ? (
                  <div className="wetter-warnband stack" style={{ gap: 4 }}>
                    {kritischeTiefen.map((d, i) => (
                      <span key={i} data-testid="nav-depth-warning">
                        {d.check === "gefahr" &&
                          `⚠ GEFAHR: ${d.depth_eff_m ?? d.depth_m} m Tiefe${d.tide_min_m != null ? ` (Karte ${d.depth_m} m, NW ${d.tide_min_m >= 0 ? "+" : ""}${d.tide_min_m} m)` : ""}`}
                        {d.check === "knapp" &&
                          `△ knapp: ${d.depth_eff_m ?? d.depth_m} m Tiefe${d.tide_min_m != null ? ` (Karte ${d.depth_m} m, NW ${d.tide_min_m >= 0 ? "+" : ""}${d.tide_min_m} m)` : ""}`}
                        {d.check === "unbekannt" &&
                          "△ keine Tiefe (evtl. Land/trockenfallend — amtliche Karte prüfen)"}{" "}
                        bei {d.lat.toFixed(3)}, {d.lon.toFixed(3)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="caption">
                    ✓ Keine kritischen Stellen an den {depths.length} geprüften Punkten.
                  </p>
                )}
                <p className="caption">
                  Geprüft an {depths.length} Routenpunkten · EMODnet/GEBCO (Planungsdaten, keine
                  amtliche Seekarte)
                  {depths.some((d) => d.tide_min_m != null)
                    ? " · Tide: konservativ gegen das Niedrigstwasser des Törns gerechnet (Kartennull-Unsicherheit beachten)"
                    : ""}{" "}
                  — enge Passagen zusätzlich in der amtlichen Karte prüfen.
                </p>
              </div>
            )}
          </div>

          {/* Erlebnisse entlang der Route (REQ-EXP-004) */}
          <details className="card nav-subtool" data-testid="nav-erlebnisse">
            <summary className="section-label" data-testid="nav-tool-erlebnisse">
              Erlebnisse entlang der Route
            </summary>
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
              <div className="row-between">
                <p className="caption">
                  Buchten, Sehenswürdigkeiten und Versorgung im Korridor um den Wasserweg —
                  kuratiert mit Quellenangabe, keine amtliche Freigabe.
                </p>
                <button
                  type="button"
                  data-testid="nav-erlebnisse-load"
                  className="btn btn-outline-teal"
                  disabled={erlebnisseLoading}
                  onClick={() => void loadErlebnisse()}
                >
                  {erlebnisseLoading ? "Lädt …" : "Erlebnisse laden"}
                </button>
              </div>
              {erlebnisseError && (
                <p className="caption" role="status" data-testid="nav-erlebnisse-error">
                  {erlebnisseError}
                </p>
              )}
              {erlebnisse && (
                <div className="stack" style={{ gap: 6 }} data-testid="nav-erlebnisse-result">
                  {erlebnisse.length === 0 ? (
                    <p className="caption">Keine kuratierten Erlebnisse im Korridor gefunden.</p>
                  ) : (
                    erlebnisse.map((e) => (
                      <div key={e.id} className="row" style={{ gap: 8 }} data-testid="nav-erlebnisse-item">
                        <Icon name="anchor" size={14} />
                        <span>
                          {e.name}
                          <span className="caption"> — {e.beschreibung}</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </details>

          <div className="grid-features">
            {plan.legs.map((leg) => (
              <NavLegCard key={leg.leg} leg={leg} />
            ))}
          </div>
        </div>
      )}

      {!plan && !loading && !error && (
        <div className="empty">
          <p>
            Revier wählen, Häfen/Punkte anklicken, berechnen — die Route führt automatisch um
            Land herum und zeigt Wind, Strömung, Wolken und echte Ankunftszeiten. Mit GPS
            startet sie an deiner Position.
          </p>
        </div>
      )}

      {plan && !loading && (
        <div className="card stack" style={{ gap: 10 }} data-testid="feedback-card">
          <span className="section-label">Dein Feedback</span>
          {fbState === "done" ? (
            <p data-testid="feedback-thanks" className="muted" style={{ fontSize: 13 }}>
              Danke! Dein Feedback fließt in die Kalibrierung der Warnungen ein.
              {" "}Direkter Draht: <a href="mailto:support@join-the-captain.org">support@join-the-captain.org</a>
            </p>
          ) : (
            <>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="caption" style={{ minWidth: 130 }}>
                  Hat die Vorhersage gepasst?
                </span>
                <button
                  type="button"
                  data-testid="feedback-ok"
                  className={`pill ${fbOk === true ? "active" : ""}`}
                  onClick={() => setFbOk(fbOk === true ? null : true)}
                >
                  👍 passte
                </button>
                <button
                  type="button"
                  data-testid="feedback-not-ok"
                  className={`pill ${fbOk === false ? "active" : ""}`}
                  onClick={() => setFbOk(fbOk === false ? null : false)}
                >
                  👎 lag daneben
                </button>
              </div>
              {fbOk === false && (
                <div className="pills" data-testid="feedback-issues">
                  {FEEDBACK_ISSUES.map((issue) => (
                    <button
                      key={issue}
                      type="button"
                      className={`pill ${fbIssues.includes(issue) ? "active" : ""}`}
                      onClick={() =>
                        setFbIssues((prev) =>
                          prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue],
                        )
                      }
                    >
                      {issue}
                    </button>
                  ))}
                </div>
              )}
              <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                <span className="caption" style={{ minWidth: 130 }}>
                  Wie zufrieden bist du?
                </span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    data-testid={`feedback-star-${n}`}
                    className="wetter-star"
                    style={{ minWidth: 48, minHeight: 48 }}
                    aria-label={`${n} von 5 Sternen`}
                    aria-pressed={fbRating != null && n <= fbRating}
                    onClick={() => setFbRating(fbRating === n ? null : n)}
                  >
                    <Icon
                      name="star"
                      size={24}
                      style={{ color: fbRating != null && n <= fbRating ? "var(--accent)" : "var(--fg-faint)" }}
                    />
                  </button>
                ))}
              </div>
              <textarea
                data-testid="feedback-text"
                className="wish-input"
                rows={2}
                maxLength={2000}
                placeholder="Was war falsch, was wünschst du dir noch?"
                value={fbText}
                onChange={(e) => setFbText(e.target.value)}
              />
              <div className="wetter-specs-grid">
                <label className="stack" style={{ gap: 4 }}>
                  <span className="caption">Name (optional)</span>
                  <input
                    data-testid="feedback-name"
                    type="text"
                    maxLength={120}
                    className="wetter-select"
                    value={fbName}
                    onChange={(e) => setFbName(e.target.value)}
                  />
                </label>
                <label className="stack" style={{ gap: 4 }}>
                  <span className="caption">E-Mail (optional, für Rückfragen)</span>
                  <input
                    data-testid="feedback-email"
                    type="email"
                    maxLength={200}
                    className="wetter-select"
                    value={fbEmail}
                    onChange={(e) => setFbEmail(e.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                data-testid="feedback-submit"
                className="btn btn-outline-gold"
                disabled={fbState === "sending" || (fbRating == null && fbOk == null && !fbText.trim())}
                onClick={sendFeedback}
              >
                {fbState === "sending" ? "Sende …" : "Feedback senden"}
              </button>
            </>
          )}
        </div>
      )}

      <p data-testid="nav-attribution" className="caption center-note" style={{ flexWrap: "wrap" }}>
        <Icon name="cloud" size={14} /> Wetter: Open-Meteo (CC-BY 4.0) · Tiefen: EMODnet
        Bathymetry (CC-BY 4.0) & GEBCO · Karte: © OpenStreetMap, © OpenSeaMap ·
        Küstenlinien-Routing: OSM (~1 km, Planungsqualität) · Open-Source-Daten — nicht als
        Navigationsmittel zugelassen, nur unterstützend zur Planung; amtliche Seekarten,
        amtliche Warnungen und Seemannschaft bleiben Pflicht.
      </p>
    </div>
  );
}

/** Kompakte Leg-Karte: Distanz, Kurs, Wind, Strom → SOG, ETA. */
function NavLegCard({ leg }: { leg: RouteLeg }) {
  const warn = leg.warnings.length > 0;
  return (
    <div data-testid="nav-leg" className={`card stack ${warn ? "wetter-leg-warn" : ""}`} style={{ gap: 8 }}>
      <div className="row-between">
        <h3 style={{ fontSize: 14, fontFamily: "var(--font-sans)", fontWeight: 500 }}>
          Leg {leg.leg}: {leg.from} → {leg.to}
        </h3>
        <span
          className={`tag ${leg.mode === "sail" ? "phase-auf_dem_toern" : leg.mode === "kreuzen" ? "phase-planung" : "phase-vor_buchung"}`}
          data-testid="leg-mode"
        >
          {leg.mode === "sail" ? "Segel" : leg.mode === "kreuzen" ? "Kreuzen" : "Motor"}
        </span>
      </div>
      {leg.alternative && (
        <p className="caption" data-testid="leg-alternative">
          Alternativ {leg.alternative.mode === "kreuzen" ? "⛵ kreuzen" : "⚙ Motor"}:{" "}
          {leg.alternative.speed_kn} kn · {leg.alternative.duration_h} h · ETA{" "}
          {fmtEta(leg.alternative.eta)}
        </p>
      )}
      <div className="wetter-leg-facts">
        <span>{leg.distance_nm} sm</span>
        <span>Kurs {leg.course_deg}°</span>
        <span
          className="row"
          style={{ gap: 4 }}
          title={`Wind aus ${compassPoint(leg.wind_from_deg)} (${leg.wind_from_deg}°)`}
        >
          <Icon
            name="send"
            size={12}
            style={{ transform: `rotate(${windArrowRotationDeg(leg.wind_from_deg)}deg)` }}
          />
          {leg.wind_kn} kn {compassPoint(leg.wind_from_deg)}
        </span>
        {leg.current_kn != null && leg.current_kn > 0.1 && (
          <span title={`Strömung setzt nach ${leg.current_to_deg}°`}>
            Strom {leg.current_kn} kn → Fahrt {leg.sog_kn} kn über Grund
          </span>
        )}
        {leg.wave_m != null && <span>Welle {leg.wave_m} m</span>}
        {leg.duration_h != null && <span>{leg.duration_h} h</span>}
      </div>
      <div className="row-between" style={{ paddingTop: 6, borderTop: "1px solid var(--border)" }}>
        <span className="caption">ETA {fmtEta(leg.eta)}</span>
        {warn && (
          <span className="wetter-leg-warnlabel row" style={{ gap: 4 }}>
            <Icon name="shield" size={13} /> {leg.warnings.join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}

/** Gleichmäßig auf höchstens `max` Punkte ausdünnen (Endpunkte bleiben). */
function thin<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [arr[0]];
  for (let k = 1; k < max - 1; k++) {
    out.push(arr[Math.round((k * (arr.length - 1)) / (max - 1))]);
  }
  out.push(arr[arr.length - 1]);
  return out;
}
