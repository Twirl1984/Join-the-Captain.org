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
import { useGeolocation } from "./useGeolocation";
import type { NavOverlay, NavRoutedLine, NavUiWaypoint } from "./NavMap";
import { gpxFromRoute } from "@/lib/navigation/gpx";

const NavMap = dynamic(() => import("./NavMap"), {
  ssr: false,
  loading: () => <div className="wetter-leaflet wetter-map-skeleton" aria-hidden="true" />,
});

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

export function NavApp() {
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

  const addWaypoint = (w: Waypoint) => {
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
              <span className="caption">Revier suchen (Name, Gruppe oder Hafen)</span>
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
              <span className="caption">Revier</span>
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
            />
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
                <span className="section-label">Wolken & Wind über die Zeit</span>
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
                Graue Flächen = Wolkenfelder (je dichter, desto dunstiger) · Pfeile = Wind ·
                ☀️/🌙 klar (Tag/Nacht), 🌤️ heiter, ⛅ wolkig, ☁️ bedeckt · ⚡ Gewitter ·
                ⛵ ungefähre Bootsposition zu diesem Zeitpunkt.
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
                {gps.status === "denied" && "Berechtigung verweigert — in den Browser-/App-Einstellungen erlauben."}
                {gps.status === "unavailable" && "GPS hier nicht verfügbar."}
              </span>
            </div>
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
              <span className="caption">Tiefgang (m) — für den Flachwasser-Check</span>
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
            {loading ? "Berechne …" : "Route über Wasser berechnen"}
            {!loading && <Icon name="arrow-right" size={16} />}
          </button>
            {!canCalc && (
              <p className="caption" data-testid="nav-calc-hint">
                Mindestens 2 Wegpunkte setzen — auf die Karte oder einen Hafen tippen.
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
              title="Route als GPX für Plotter/Apps herunterladen"
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
