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
import type { FlachwasserStatus } from "@/lib/navigation/depth";
import { RECOMMENDED_SENSITIVITY } from "@/lib/weather/warnings";
import { compassPoint, windArrowRotationDeg } from "@/lib/weather/format";
import { boatPositionAt } from "@/lib/weather/playback";
import type { TimelinePoint } from "@/lib/weather/open-meteo";
import type { Waypoint, RoutePlan, RouteLeg } from "@/lib/weather/route-forecast";
import { useGeolocation } from "./useGeolocation";
import type { NavOverlay, NavRoutedLine, NavUiWaypoint } from "./NavMap";

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
  check?: FlachwasserStatus;
}

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

export function NavApp() {
  const [revierId, setRevierId] = useState(REVIER_GRUPPEN[0].reviere[0].id);
  const [suche, setSuche] = useState("");
  const [waypoints, setWaypoints] = useState<NavUiWaypoint[]>([]);
  const nextId = useRef(1);
  const [showDepth, setShowDepth] = useState(true);
  const [mode, setMode] = useState<"sail" | "motor">("sail");
  const [startTime, setStartTime] = useState(() => toLocalInput(new Date(Date.now() + 3600e3)));
  const [tiefgang, setTiefgang] = useState(1.8);
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
  const [depths, setDepths] = useState<DepthPoint[] | null>(null);
  const [depthLoading, setDepthLoading] = useState(false);
  // Playback (Wolken/Wind über die Zeit)
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [playIdx, setPlayIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const revier = useMemo(
    () => alleReviere().find((r) => r.id === revierId) ?? REVIER_GRUPPEN[0].reviere[0],
    [revierId],
  );
  const sucheHits = useMemo(() => (suche.trim() ? sucheReviere(suche).slice(0, 6) : []), [suche]);
  const maxStart = useMemo(() => toLocalInput(new Date(Date.now() + 7 * 24 * 3600e3)), []);

  // Effektive Wegpunkte: optional die eigene GPS-Position als Start.
  const effectiveWaypoints = useMemo((): Waypoint[] => {
    const clicked = waypoints.map(({ lat, lon, name }) => ({ lat, lon, name }));
    if (startAtGps && gps.fix) {
      return [{ lat: gps.fix.lat, lon: gps.fix.lon, name: "Meine Position" }, ...clicked];
    }
    return clicked;
  }, [waypoints, startAtGps, gps.fix]);

  const canCalc = effectiveWaypoints.length >= 2;

  const addWaypoint = (w: Waypoint) =>
    setWaypoints((prev) => [...prev, { ...w, id: `nwp-${nextId.current++}` }]);
  const removeWaypoint = (id: string) => setWaypoints((prev) => prev.filter((w) => w.id !== id));
  const reset = () => {
    setWaypoints([]);
    setPlan(null);
    setRouting(null);
    setDepths(null);
    setTimeline(null);
    setPlaying(false);
    setPlayIdx(0);
    setError(null);
  };

  async function calculate(opts: { silent?: boolean } = {}) {
    if (!canCalc) return;
    if (!opts.silent) {
      setLoading(true);
      setPlan(null);
      setRouting(null);
    }
    setError(null);
    try {
      // Ab eigener Position gilt: Abfahrt JETZT (echte Ankunftszeiten).
      const startIso =
        startAtGps && gps.fix ? new Date().toISOString() : new Date(startTime).toISOString();
      const res = await fetch("/api/navigation/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          revier: revier.id,
          waypoints: effectiveWaypoints,
          startTime: startIso,
          mode,
          sensitivity: RECOMMENDED_SENSITIVITY,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        plan?: RoutePlan;
        routing?: RoutingInfo;
        error?: string;
      };
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
      setDepths(null);
      void loadTimeline(data.routing, startIso, data.plan);
    } catch {
      setError("Netzwerkfehler — bitte später erneut versuchen.");
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }

  // Zeitreise-Overlay: Wolken + Wind an den GEROUTETEN Punkten (max 20,
  // sonst wird die Open-Meteo-Multi-Location-Anfrage unnötig groß).
  async function loadTimeline(r: RoutingInfo, startIso: string, p: RoutePlan) {
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
          sensitivity: RECOMMENDED_SENSITIVITY,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<Timeline>;
      if (res.ok && data.times?.length && data.points?.length) setTimeline(data as Timeline);
    } catch {
      // Overlay ist Bonus — der Plan steht auch ohne.
    }
  }

  // Flachwasser-Check: Tiefe an den gerouteten Punkten gegen den Tiefgang.
  async function checkDepths() {
    if (!routing) return;
    setDepthLoading(true);
    setDepths(null);
    try {
      const pts = thin(routing.points, 12);
      const results = await Promise.all(
        pts.map(async (p) => {
          const res = await fetch(
            `/api/navigation/depth?lat=${p.lat}&lon=${p.lon}&tiefgang=${tiefgang}`,
          );
          const d = (await res.json().catch(() => ({}))) as {
            depth_m?: number | null;
            check?: FlachwasserStatus;
          };
          return {
            lat: p.lat,
            lon: p.lon,
            depth_m: res.ok ? (d.depth_m ?? null) : null,
            check: res.ok ? d.check : undefined,
          };
        }),
      );
      setDepths(results);
    } catch {
      setError("Tiefendaten gerade nicht verfügbar — bitte später erneut versuchen.");
    } finally {
      setDepthLoading(false);
    }
  }

  // Auto-Update: mit GPS-Start alle 60 s still neu rechnen → echte Live-ETA.
  useEffect(() => {
    if (!autoUpdate || !startAtGps || !plan) return;
    const iv = setInterval(() => void calculate({ silent: true }), 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUpdate, startAtGps, plan != null]);

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
  const kritischeTiefen = depths?.filter((d) => d.check === "gefahr" || d.check === "knapp") ?? [];

  return (
    <div className="wetter-app stack" style={{ gap: 20 }}>
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

          <div data-testid="nav-map" className="wetter-map-frame">
            <NavMap
              revier={revier}
              waypoints={waypoints}
              onAddWaypoint={addWaypoint}
              routed={routed}
              overlay={overlay}
              showDepth={showDepth}
              gps={gps.fix}
              followGps={followGps}
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
                ⚡ Gewitter · ⛵ ungefähre Bootsposition zu diesem Zeitpunkt.
              </p>
            </div>
          )}
        </div>

        {/* ── rechte Spalte: GPS, Route, Abfahrt ── */}
        <div className="stack" style={{ gap: 16 }}>
          {/* GPS */}
          <div className="card stack" style={{ gap: 10 }}>
            <span className="section-label">GPS — eigene Position</span>
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
            <label className="stack" style={{ gap: 4 }}>
              <span className="caption">Tiefgang (m) — für den Flachwasser-Check</span>
              <input
                data-testid="nav-tiefgang"
                type="number"
                min={0.2}
                max={20}
                step={0.1}
                className="wetter-select"
                value={tiefgang}
                onChange={(e) => setTiefgang(Number(e.target.value) || 1.8)}
              />
            </label>
          </div>

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
        <div className="wetter-error" role="alert" data-testid="nav-error">
          <Icon name="info-circle" size={18} /> {error}
        </div>
      )}

      {plan && routing && !loading && (
        <div data-testid="nav-result" className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <span className="tag phase-planung">Navigation</span>
            <strong>{plan.total_nm} sm</strong>
            <span className="muted" data-testid="nav-eta">
              Ankunft {fmtEta(plan.eta)}
            </span>
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
                {depthLoading ? "Prüfe …" : `Gegen ${tiefgang} m Tiefgang prüfen`}
              </button>
            </div>
            {depths && (
              <div className="stack" style={{ gap: 6 }} data-testid="nav-depth-result">
                {kritischeTiefen.length > 0 ? (
                  <div className="wetter-warnband stack" style={{ gap: 4 }}>
                    {kritischeTiefen.map((d, i) => (
                      <span key={i} data-testid="nav-depth-warning">
                        {d.check === "gefahr" ? "⚠ GEFAHR" : "△ knapp"}:{" "}
                        {d.depth_m != null ? `${d.depth_m} m Tiefe` : "Tiefe unbekannt"} bei{" "}
                        {d.lat.toFixed(3)}, {d.lon.toFixed(3)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="caption">
                    ✓ Keine kritischen Stellen an den geprüften Punkten (
                    {depths.filter((d) => d.depth_m != null).length} von {depths.length} mit
                    Tiefendaten).
                  </p>
                )}
                <p className="caption">
                  Geprüft an {depths.length} Routenpunkten · EMODnet/GEBCO (Planungsdaten, keine
                  amtliche Seekarte) — enge Passagen zusätzlich in der amtlichen Karte prüfen.
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

      <p data-testid="nav-attribution" className="caption center-note" style={{ flexWrap: "wrap" }}>
        <Icon name="cloud" size={14} /> Wetter: Open-Meteo (CC-BY 4.0) · Tiefen: EMODnet
        Bathymetry (CC-BY 4.0) & GEBCO · Karte: © OpenStreetMap, © OpenSeaMap ·
        Küstenlinien-Routing: OSM (~1 km, Planungsqualität) · Entscheidungshilfe — ersetzt
        keine amtlichen Seekarten, keine Seemannschaft und keine amtlichen Warnungen.
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
        <span className={`tag ${leg.mode === "sail" ? "phase-auf_dem_toern" : "phase-vor_buchung"}`}>
          {leg.mode === "sail" ? "Segel" : "Motor"}
        </span>
      </div>
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
            Strom {leg.current_kn} kn → {leg.sog_kn} kn üG
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
