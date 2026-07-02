"use client";

// Wetter-Routen-Planer — Client-Shell: Revier, Karte, Wegpunkte, Abfahrt,
// Segel/Motor, Risiko-Schieberegler → POST /api/weather/route → Ergebnis-Panel.
// data-testid-Attribute sind der E2E-Vertrag (e2e/wetter.spec.ts).

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { REVIERE } from "@/lib/weather/reviere";
import { RECOMMENDED_SENSITIVITY } from "@/lib/weather/warnings";
import { compassPoint, windArrowRotationDeg } from "@/lib/weather/format";
import type { Waypoint, RoutePlan, RouteLeg } from "@/lib/weather/route-forecast";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RoutePlan | null>(null);

  const revier = useMemo(() => REVIERE.find((r) => r.id === revierId) ?? REVIERE[0], [revierId]);
  const maxStart = useMemo(() => toLocalInput(new Date(Date.now() + 7 * 24 * 3600e3)), []);

  const addWaypoint = (w: Waypoint) =>
    setWaypoints((prev) => [...prev, { ...w, id: `wp-${nextId.current++}` }]);
  const removeWaypoint = (id: string) => setWaypoints((prev) => prev.filter((w) => w.id !== id));
  const reset = () => {
    setWaypoints([]);
    setPlan(null);
    setError(null);
  };

  async function calculate() {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/weather/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          waypoints: waypoints.map(({ lat, lon, name }) => ({ lat, lon, name })),
          startTime: new Date(startTime).toISOString(),
          mode,
          sensitivity,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { plan?: RoutePlan; error?: string };
      if (!res.ok || !data.plan) {
        setError(
          res.status === 502
            ? "Wetterdaten gerade nicht verfügbar — bitte später erneut versuchen."
            : data.error || "Berechnung fehlgeschlagen — bitte Eingaben prüfen.",
        );
        return;
      }
      setPlan(data.plan);
    } catch {
      setError("Netzwerkfehler — bitte später erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

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
            <WetterMap revier={revier} waypoints={waypoints} onAddWaypoint={addWaypoint} />
          </div>
          <p className="caption">
            Klick auf die Karte oder einen Hafen-Punkt setzt einen Wegpunkt. Gold = bekannte Häfen.
          </p>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {/* Wegpunkt-Liste */}
          <div className="card stack" style={{ gap: 8 }}>
            <span className="section-label">Route</span>
            {waypoints.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                Noch keine Wegpunkte — mindestens 2 setzen.
              </p>
            ) : (
              <ol className="wetter-wp-list">
                {waypoints.map((w, i) => (
                  <li key={w.id} data-testid="waypoint-item" className="row-between">
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
              <span className="caption">Abfahrt (max. 7 Tage voraus)</span>
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
          </div>

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
              im Sturm — schwere Stürme (≥&nbsp;9&nbsp;Bft) warnen deshalb immer, unabhängig vom Regler.
            </p>
          </div>

          <button
            data-testid="calc-button"
            type="button"
            className="btn btn-teal btn-block"
            disabled={waypoints.length < 2 || loading}
            onClick={calculate}
          >
            {loading ? "Berechne …" : "Route berechnen"}
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
        <div className="wetter-error" role="alert">
          <Icon name="info-circle" size={18} /> {error}
        </div>
      )}

      {plan && !loading && (
        <div data-testid="result-panel" className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <span className="tag phase-planung">Planung</span>
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

      <p data-testid="attribution" className="caption center-note">
        <Icon name="cloud" size={14} /> Wetterdaten: Open-Meteo (CC-BY 4.0) · Karte: ©
        OpenStreetMap, © OpenSeaMap · Entscheidungshilfe — ersetzt keine Seemannschaft und keine
        amtlichen Warnungen.
      </p>
    </div>
  );
}

function LegCard({ leg }: { leg: RouteLeg }) {
  const warn = leg.warnings.length > 0;
  return (
    <div data-testid="leg-card" className={`card stack ${warn ? "wetter-leg-warn" : ""}`} style={{ gap: 10 }}>
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
