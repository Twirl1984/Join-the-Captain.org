"use client";

// Wetter-Routen-Planer — Client-Shell: Revier, Karte, Wegpunkte (mit optionaler
// Liegezeit), Bootsprofil (PS/Länge/Verdrängung → Geschwindigkeit), Abfahrt,
// Risiko-Schieberegler, Abfahrts-Empfehlung im Zeitfenster → Ergebnis-Panel.
// data-testid-Attribute sind der E2E-Vertrag (e2e/wetter.spec.ts).

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { REVIERE } from "@/lib/weather/reviere";
import { RECOMMENDED_SENSITIVITY } from "@/lib/weather/warnings";
import { compassPoint, windArrowRotationDeg } from "@/lib/weather/format";
import { boatFromSpecs, type BoatSpecs } from "@/lib/weather/polar";
import { boatPositionAt } from "@/lib/weather/playback";
import { WEATHER_MODELS, type WeatherModel, type TimelinePoint } from "@/lib/weather/open-meteo";
import type { Waypoint, RoutePlan, RouteLeg } from "@/lib/weather/route-forecast";
import type { DepartureScan, DepartureSlot } from "@/lib/weather/departure-scan";
import type { WetterOverlay } from "./WetterMap";

interface Timeline {
  times: string[];
  points: TimelinePoint[];
}

// Wegpunkt mit stabiler UI-Id — Keys dürfen nicht am Array-Index hängen,
// sonst remountet React (und Leaflet) beim Löschen aus der Mitte alle Nachfolger.
export type UiWaypoint = Waypoint & { id: string };

// Leaflet rendert nur im Browser → ohne SSR laden.
const WetterMap = dynamic(() => import("./WetterMap"), {
  ssr: false,
  loading: () => <div className="wetter-leaflet wetter-map-skeleton" aria-hidden="true" />,
});

// Default-Abfahrt: morgen 08:00 Lokalzeit, als datetime-local-String.
function defaultStart(): string {
  const d = new Date(Date.now() + 24 * 3600e3);
  d.setHours(8, 0, 0, 0);
  return toLocalInput(d);
}
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const fmtEta = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function WetterApp() {
  const [revierId, setRevierId] = useState(REVIERE[0].id);
  const [waypoints, setWaypoints] = useState<UiWaypoint[]>([]);
  const nextId = useRef(1);
  const [startTime, setStartTime] = useState(defaultStart);
  const [mode, setMode] = useState<"sail" | "motor">("sail");
  const [sensitivity, setSensitivity] = useState(RECOMMENDED_SENSITIVITY);
  const [specs, setSpecs] = useState<BoatSpecs>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [source, setSource] = useState<string | null>(null);
  // Abfahrts-Empfehlung
  const [scanTo, setScanTo] = useState(() => toLocalInput(new Date(Date.now() + 72 * 3600e3)));
  const [scan, setScan] = useState<DepartureScan | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  // Wettermodell (transparent wählbar)
  const [model, setModel] = useState<WeatherModel>("best_match");
  // Playback (Zeitreise über die geplante Route)
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [playIdx, setPlayIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Feedback
  const [fbRating, setFbRating] = useState<number | null>(null);
  const [fbOk, setFbOk] = useState<boolean | null>(null);
  const [fbText, setFbText] = useState("");
  const [fbName, setFbName] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbState, setFbState] = useState<"idle" | "sending" | "done">("idle");

  const revier = useMemo(() => REVIERE.find((r) => r.id === revierId) ?? REVIERE[0], [revierId]);
  const maxStart = useMemo(() => toLocalInput(new Date(Date.now() + 7 * 24 * 3600e3)), []);
  const boat = useMemo(() => boatFromSpecs(specs), [specs]);

  // Playback-Ticker: alle 900 ms ein Zeitschritt, am Ende stoppen.
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
    }, 900);
    return () => clearInterval(iv);
  }, [playing, timeline]);

  // Overlay des aktiven Zeitschritts: Symbole je Punkt + Bootsposition.
  const overlay: WetterOverlay | null = useMemo(() => {
    if (!timeline || !timeline.times.length) return null;
    const idx = Math.min(playIdx, timeline.times.length - 1);
    const atMs = Date.parse(timeline.times[idx]);
    const points = timeline.points
      .map((p) => ({ lat: p.lat, lon: p.lon, step: p.steps[idx] }))
      .filter((p) => p.step);
    const boatPos =
      plan && waypoints.length >= 2 ? boatPositionAt(waypoints, plan.legs, atMs) : null;
    return { points, boat: boatPos };
  }, [timeline, playIdx, plan, waypoints]);

  const addWaypoint = (w: Waypoint) =>
    setWaypoints((prev) => [...prev, { ...w, id: `wp-${nextId.current++}` }]);
  const removeWaypoint = (id: string) => setWaypoints((prev) => prev.filter((w) => w.id !== id));
  const setWaypointDepart = (id: string, value: string) =>
    setWaypoints((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, depart_at: value ? new Date(value).toISOString() : undefined } : w,
      ),
    );
  const reset = () => {
    setWaypoints([]);
    setPlan(null);
    setScan(null);
    setTimeline(null);
    setPlaying(false);
    setPlayIdx(0);
    setFbState("idle");
    setError(null);
  };

  const apiWaypoints = () =>
    waypoints.map(({ lat, lon, name, depart_at }) => ({ lat, lon, name, depart_at }));

  async function calculate(startIso?: string) {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/weather/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          waypoints: apiWaypoints(),
          startTime: startIso ?? new Date(startTime).toISOString(),
          mode,
          sensitivity,
          model,
          boat,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        plan?: RoutePlan;
        source?: string;
        error?: string;
      };
      if (!res.ok || !data.plan) {
        setError(
          res.status === 502
            ? "Wetterdaten gerade nicht verfügbar — bitte später erneut versuchen."
            : data.error || "Berechnung fehlgeschlagen — bitte Eingaben prüfen.",
        );
        return;
      }
      setPlan(data.plan);
      setSource(data.source ?? null);
      setFbState("idle");
      // Timeline fürs Playback nachladen (Abfahrt erstes Leg → ETA + Puffer).
      void loadTimeline(data.plan, startIso ?? new Date(startTime).toISOString());
    } catch {
      setError("Netzwerkfehler — bitte später erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTimeline(p: RoutePlan, startIso: string) {
    setTimeline(null);
    setPlaying(false);
    setPlayIdx(0);
    try {
      const res = await fetch("/api/weather/timeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          waypoints: apiWaypoints(),
          startTime: startIso,
          endTime: new Date(Date.parse(p.eta) + 3 * 3600e3).toISOString(),
          stepH: 3,
          sensitivity,
          model,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<Timeline>;
      if (res.ok && data.times?.length && data.points?.length) {
        setTimeline(data as Timeline);
      }
    } catch {
      // Playback ist ein Bonus — Fehler still lassen, der Plan steht ja.
    }
  }

  async function scanWindow() {
    setScanLoading(true);
    setError(null);
    setScan(null);
    try {
      const res = await fetch("/api/weather/departure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          waypoints: apiWaypoints(),
          windowStart: new Date(startTime).toISOString(),
          windowEnd: new Date(scanTo).toISOString(),
          stepH: 3,
          mode,
          sensitivity,
          model,
          boat,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<DepartureScan> & {
        error?: string;
      };
      if (!res.ok || !data.slots) {
        setError(data.error || "Abfahrts-Scan fehlgeschlagen — bitte Eingaben prüfen.");
        return;
      }
      setScan(data as DepartureScan);
    } catch {
      setError("Netzwerkfehler — bitte später erneut versuchen.");
    } finally {
      setScanLoading(false);
    }
  }

  const adoptSlot = (slot: DepartureSlot) => {
    setStartTime(toLocalInput(new Date(slot.departure)));
    void calculate(slot.departure);
  };

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
                waypoints: apiWaypoints(),
                startTime: new Date(startTime).toISOString(),
                sensitivity,
                model,
                source,
                eta: plan.eta,
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

  // Alternative Häfen in der Nähe des Startpunkts — wenn im ganzen Fenster
  // Warnungen stehen, soll der Nutzer einfach umplanen können (bewusst simpel:
  // wir empfehlen nahe Revier-Häfen, keine automatische Neu-Route).
  const nearbyHarbours = useMemo(() => {
    if (!scan?.all_windy || waypoints.length < 1) return [];
    const start = waypoints[0];
    const ziel = waypoints[waypoints.length - 1];
    return revier.haefen
      .filter((h) => h.name !== start.name && h.name !== ziel.name)
      .map((h) => ({
        ...h,
        d: Math.hypot(h.lat - start.lat, (h.lon - start.lon) * Math.cos((start.lat * Math.PI) / 180)),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
  }, [scan, waypoints, revier]);

  return (
    <div className="wetter-app stack" style={{ gap: 20 }}>
      {/* ── Eingaben ── */}
      <div className="wetter-grid">
        <div className="stack" style={{ gap: 12 }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="caption">Revier</span>
            <select
              data-testid="revier-select"
              className="wetter-select"
              value={revierId}
              onChange={(e) => {
                setRevierId(e.target.value);
                reset();
              }}
            >
              {REVIERE.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <div data-testid="wetter-map" className="wetter-map-frame">
            <WetterMap
              revier={revier}
              waypoints={waypoints}
              onAddWaypoint={addWaypoint}
              overlay={overlay}
            />
          </div>
          <p className="caption">
            Klick auf die Karte oder einen Hafen-Punkt setzt einen Wegpunkt. Gold = bekannte Häfen.
          </p>

          {/* Playback: Zeitreise über die geplante Route */}
          {timeline && timeline.times.length > 1 && (
            <div className="card stack" style={{ gap: 8 }} data-testid="playback-panel">
              <div className="row-between">
                <span className="section-label">Wetter-Zeitreise</span>
                <span className="caption" data-testid="playback-time">
                  {fmtEta(timeline.times[Math.min(playIdx, timeline.times.length - 1)])}
                </span>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button
                  type="button"
                  data-testid="playback-toggle"
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
                  data-testid="playback-slider"
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
                3-h-Schritte von Abfahrt bis Ankunft: Windpfeile (Farbe = Stärke), ⚡ Gewitter,
                ☁ Bedeckung, ⛵ ungefähre Bootsposition.
              </p>
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {/* Wegpunkt-Liste inkl. optionaler Liegezeit */}
          <div className="card stack" style={{ gap: 8 }}>
            <span className="section-label">Route</span>
            {waypoints.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                Noch keine Wegpunkte — mindestens 2 setzen.
              </p>
            ) : (
              <ol className="wetter-wp-list">
                {waypoints.map((w, i) => (
                  <li key={w.id} data-testid="waypoint-item" className="stack" style={{ gap: 4 }}>
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
                    {/* Liegezeit ("Weiterfahrt ab") an Zwischenstopps */}
                    {i > 0 && i < waypoints.length - 1 && (
                      <label className="row" style={{ gap: 6, paddingLeft: 28, flexWrap: "wrap" }}>
                        <span className="caption">Weiterfahrt ab</span>
                        <input
                          type="datetime-local"
                          className="wetter-select"
                          style={{ minHeight: 34, fontSize: 12, maxWidth: 210 }}
                          value={w.depart_at ? toLocalInput(new Date(w.depart_at)) : ""}
                          onChange={(e) => setWaypointDepart(w.id, e.target.value)}
                          aria-label={`Weiterfahrt ab Wegpunkt ${i + 1}`}
                        />
                      </label>
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

          {/* Abfahrt + Modus */}
          <div className="card stack" style={{ gap: 12 }}>
            <label className="stack" style={{ gap: 6 }}>
              <span className="caption">
                Abfahrt (bis 7 Tage voraus · Vergangenheit = Archiv-Check)
              </span>
              <input
                type="datetime-local"
                className="wetter-select"
                value={startTime}
                max={maxStart}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <div className="row" style={{ gap: 8 }} role="radiogroup" aria-label="Fahrmodus">
              <button
                type="button"
                className={`pill ${mode === "sail" ? "active" : ""}`}
                aria-pressed={mode === "sail"}
                onClick={() => setMode("sail")}
              >
                Segeln
              </button>
              <button
                type="button"
                className={`pill ${mode === "motor" ? "active" : ""}`}
                aria-pressed={mode === "motor"}
                onClick={() => setMode("motor")}
              >
                Motor
              </button>
            </div>
            {/* Wettermodell — transparent wählbar, mit Begründung */}
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
            </label>
          </div>

          {/* Bootsprofil */}
          <details className="card wetter-details">
            <summary className="section-label" style={{ cursor: "pointer" }}>
              Boot anpassen (optional)
            </summary>
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
              <div className="wetter-specs-grid">
                <label className="stack" style={{ gap: 4 }}>
                  <span className="caption">Wasserlinie (m)</span>
                  <input
                    data-testid="boat-lwl"
                    type="number"
                    min={4}
                    max={40}
                    step={0.1}
                    className="wetter-select"
                    placeholder="z.B. 10"
                    value={specs.length_waterline_m ?? ""}
                    onChange={(e) =>
                      setSpecs((s) => ({
                        ...s,
                        length_waterline_m: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                </label>
                <label className="stack" style={{ gap: 4 }}>
                  <span className="caption">Verdrängung (t)</span>
                  <input
                    data-testid="boat-disp"
                    type="number"
                    min={0.5}
                    max={100}
                    step={0.1}
                    className="wetter-select"
                    placeholder="z.B. 8"
                    value={specs.displacement_t ?? ""}
                    onChange={(e) =>
                      setSpecs((s) => ({
                        ...s,
                        displacement_t: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                </label>
                <label className="stack" style={{ gap: 4 }}>
                  <span className="caption">Motor (PS)</span>
                  <input
                    data-testid="boat-hp"
                    type="number"
                    min={2}
                    max={500}
                    step={1}
                    className="wetter-select"
                    placeholder="z.B. 40"
                    value={specs.engine_hp ?? ""}
                    onChange={(e) =>
                      setSpecs((s) => ({
                        ...s,
                        engine_hp: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                </label>
                <label className="stack" style={{ gap: 4 }}>
                  <span className="caption">Marschfahrt (kn, überschreibt)</span>
                  <input
                    data-testid="boat-cruise"
                    type="number"
                    min={2}
                    max={30}
                    step={0.1}
                    className="wetter-select"
                    placeholder="autom."
                    value={specs.cruise_speed_motor_kn ?? ""}
                    onChange={(e) =>
                      setSpecs((s) => ({
                        ...s,
                        cruise_speed_motor_kn: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                </label>
              </div>
              <p className="caption" data-testid="boat-derived">
                → Rumpfgeschwindigkeit {boat.hull_speed_kn} kn · Marschfahrt{" "}
                {boat.cruise_speed_motor_kn} kn
              </p>
            </div>
          </details>

          {/* Risiko-Schieberegler */}
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
          </div>

          <button
            data-testid="calc-button"
            type="button"
            className="btn btn-teal btn-block"
            disabled={waypoints.length < 2 || loading}
            onClick={() => void calculate()}
          >
            {loading ? "Berechne …" : "Route berechnen"}
            {!loading && <Icon name="arrow-right" size={16} />}
          </button>

          {/* Abfahrts-Empfehlung */}
          <div className="card stack" style={{ gap: 10 }}>
            <span className="section-label">Beste Abfahrt finden</span>
            <p className="caption">
              Charter-Fenster angeben — wir rechnen alle Abfahrten (3-h-Raster) von der Abfahrtszeit
              oben bis zum spätesten Start durch und empfehlen den Slot, der Unwetter umgeht.
            </p>
            <label className="stack" style={{ gap: 4 }}>
              <span className="caption">spätester Start</span>
              <input
                data-testid="departure-to"
                type="datetime-local"
                className="wetter-select"
                value={scanTo}
                max={maxStart}
                onChange={(e) => setScanTo(e.target.value)}
              />
            </label>
            <button
              data-testid="departure-scan-button"
              type="button"
              className="btn btn-outline-teal btn-block"
              disabled={waypoints.length < 2 || scanLoading}
              onClick={scanWindow}
            >
              {scanLoading ? "Prüfe Slots …" : "Abfahrt empfehlen"}
            </button>
            {scan && (
              <div className="stack" style={{ gap: 6 }} data-testid="departure-result">
                {scan.all_windy && (
                  <div className="wetter-warnband stack" style={{ fontSize: 12, gap: 6 }}>
                    <span>
                      Im ganzen Fenster gibt es Warnungen — unten der am wenigsten kritische
                      Slot.
                    </span>
                    {nearbyHarbours.length > 0 && (
                      <span data-testid="harbour-tips">
                        Oder Ziel umplanen — geschützt liegen z.B.:{" "}
                        {nearbyHarbours.map((h) => h.name).join(" · ")} (auf der Karte anklicken).
                      </span>
                    )}
                  </div>
                )}
                <ol className="wetter-slot-list">
                  {scan.slots.map((s) => {
                    const isRec = scan.recommended?.departure === s.departure;
                    return (
                      <li key={s.departure}>
                        <button
                          type="button"
                          data-testid={isRec ? "departure-recommended" : "departure-slot"}
                          className={`wetter-slot ${s.avoid ? "avoid" : ""} ${isRec ? "recommended" : ""}`}
                          onClick={() => adoptSlot(s)}
                          title={s.warnings.join(" · ") || "keine Warnungen"}
                        >
                          <span className="row" style={{ gap: 6 }}>
                            <Icon name={s.avoid ? "shield" : "check"} size={14} />
                            {fmtEta(s.departure)}
                          </span>
                          <span className="caption">
                            {s.avoid
                              ? s.warnings[0]
                              : `${s.max_gust_kn} kn Böen · ${s.duration_h} h${isRec ? " · empfohlen" : ""}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <p className="caption">Klick auf einen Slot übernimmt ihn als Abfahrt.</p>
              </div>
            )}
          </div>
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

      {error && (
        <div className="wetter-error" role="alert">
          <Icon name="info-circle" size={18} /> {error}
        </div>
      )}

      {plan && !loading && (
        <div data-testid="result-panel" className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <span className="tag phase-planung">Planung</span>
            {source === "open-meteo-archive" && (
              <span className="tag badge-verworfen" data-testid="archive-badge">
                Archivdaten · Validierung
              </span>
            )}
            <strong>{plan.total_nm} sm</strong>
            <span className="muted">Ankunft {fmtEta(plan.eta)}</span>
          </div>

          {plan.warnings.length > 0 && (
            <div className="wetter-warnband stack" style={{ gap: 6 }}>
              {plan.warnings.map((w, i) => (
                <div key={i} data-testid="warning-item" className="row" style={{ gap: 8 }}>
                  <Icon name="shield" size={16} /> {w}
                </div>
              ))}
            </div>
          )}

          <div className="grid-features">
            {plan.legs.map((leg) => (
              <LegCard key={leg.leg} leg={leg} />
            ))}
          </div>

          {/* Feedback-Schleife: speist die Nachkalibrierung */}
          <div className="card stack" style={{ gap: 10 }} data-testid="feedback-card">
            <span className="section-label">Dein Feedback</span>
            {fbState === "done" ? (
              <p data-testid="feedback-thanks" className="muted" style={{ fontSize: 13 }}>
                Danke! Dein Feedback fließt in die Kalibrierung der Warnungen ein.
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
                      aria-label={`${n} von 5 Sternen`}
                      aria-pressed={fbRating != null && n <= fbRating}
                      onClick={() => setFbRating(fbRating === n ? null : n)}
                    >
                      <Icon
                        name="star"
                        size={18}
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
                {/* Optionale Kontaktdaten für Rückfragen */}
                <div className="wetter-specs-grid">
                  <label className="stack" style={{ gap: 4 }}>
                    <span className="caption">Name (optional)</span>
                    <input
                      data-testid="feedback-name"
                      type="text"
                      maxLength={120}
                      className="wetter-select"
                      placeholder="z.B. Kai"
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
                      placeholder="du@beispiel.de"
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
        </div>
      )}

      {!plan && !loading && !error && (
        <div className="empty">
          <p>
            Route auf der Karte setzen, Abfahrt wählen, berechnen — du bekommst Wind, Welle,
            Warnungen und Ankunftszeit für jeden Abschnitt.
          </p>
        </div>
      )}

      <p data-testid="attribution" className="caption center-note" style={{ flexWrap: "wrap" }}>
        <Icon name="cloud" size={14} /> Wetterdaten: Open-Meteo (CC-BY 4.0) ·{" "}
        {WEATHER_MODELS[model].label} · Vorhersage bis 7 Tage, stündlich aktualisiert (Server-Cache
        1 h — jede Berechnung nutzt frische Daten) · Karte: © OpenStreetMap, © OpenSeaMap ·
        Entscheidungshilfe — ersetzt keine Seemannschaft und keine amtlichen Warnungen.
      </p>
    </div>
  );
}

function LegCard({ leg }: { leg: RouteLeg }) {
  const warn = leg.warnings.length > 0;
  return (
    <div
      data-testid="leg-card"
      className={`card stack ${warn ? "wetter-leg-warn" : ""}`}
      style={{ gap: 10 }}
    >
      <div className="row-between">
        <h3 style={{ fontSize: 14, fontFamily: "var(--font-sans)", fontWeight: 500 }}>
          Leg {leg.leg}: {leg.from} → {leg.to}
        </h3>
        <span className={`tag ${leg.mode === "sail" ? "phase-auf_dem_toern" : "phase-vor_buchung"}`}>
          {leg.mode === "sail" ? "Segel" : "Motor"}
        </span>
      </div>
      {leg.layover_h != null && (
        <p className="caption">⚓ Liegezeit {leg.layover_h} h · Weiterfahrt {fmtEta(leg.depart)}</p>
      )}
      <div className="wetter-leg-facts">
        <span>{leg.distance_nm} sm</span>
        <span>Kurs {leg.course_deg}°</span>
        <span
          className="row"
          style={{ gap: 4 }}
          title={`Wind aus ${compassPoint(leg.wind_from_deg)} (${leg.wind_from_deg}°) — Pfeil zeigt, wohin der Wind weht`}
        >
          {/* Pfeil = Flow-Richtung (wohin der Wind weht), Rotation getestet in format.test.ts */}
          <Icon
            name="send"
            size={12}
            style={{ transform: `rotate(${windArrowRotationDeg(leg.wind_from_deg)}deg)` }}
          />
          {leg.wind_kn} kn aus {compassPoint(leg.wind_from_deg)} ({leg.wind_from_deg}°)
        </span>
        {leg.wave_m != null && <span>Welle {leg.wave_m} m</span>}
        <span>{leg.speed_kn} kn Fahrt</span>
        {leg.duration_h != null && <span>{leg.duration_h} h</span>}
      </div>
      <div className="row-between" style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
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
