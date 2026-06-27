"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, iconForKey } from "@/components/Icon";
import { JourneyTag } from "@/components/JourneyTag";
import { plausibleEvent } from "@/components/Plausible";
import type { FeatureCard as FeatureCardData } from "@/lib/types";

function eur(cent: number): string {
  return (cent / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function FeatureCard({ card }: { card: FeatureCardData }) {
  if (card.status === "affiliate") return <AffiliateCard card={card} />;
  if (card.status === "verworfen") return <VerworfenCard card={card} />;
  return <BuildCard card={card} />;
}

// ── TYP A — BUILD-Kandidat ──────────────────────────────────────────
function BuildCard({ card }: { card: FeatureCardData }) {
  const [votes, setVotes] = useState(card.votes);
  const [voted, setVoted] = useState(card.voted_by_user);
  const [voteBusy, setVoteBusy] = useState(false);

  const [pledging, setPledging] = useState(false);
  const [betrag, setBetrag] = useState("10");
  const [pledgeBusy, setPledgeBusy] = useState(false);
  const [pledgeDone, setPledgeDone] = useState(false);
  const [summe, setSumme] = useState(card.pledge_summe_cent);

  const ziel = card.pledge_ziel_cent || 0;
  const prozent = ziel > 0 ? Math.min(100, Math.round((summe / ziel) * 100)) : 0;

  async function toggleVote() {
    if (voteBusy) return;
    setVoteBusy(true);
    try {
      const res = await fetch(`/api/features/${card.id}/vote`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setVoted(data.voted);
        setVotes(data.votes);
        if (data.voted) plausibleEvent("Vote");
      }
    } finally {
      setVoteBusy(false);
    }
  }

  async function submitPledge() {
    const cent = Math.round(parseFloat(betrag.replace(",", ".")) * 100);
    if (!Number.isFinite(cent) || cent < 100 || pledgeBusy) return;
    setPledgeBusy(true);
    try {
      const res = await fetch(`/api/features/${card.id}/pledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betrag_cent: cent }),
      });
      if (res.ok) {
        plausibleEvent("Pledge", { betrag_eur: Math.round(cent / 100) });
        setPledgeDone(true);
        setPledging(false);
        // Optimistisch: Fortschritt zeigt erst nach Webhook-Bestätigung,
        // daher Summe nicht hochzählen – nur Dank quittieren.
      }
    } finally {
      setPledgeBusy(false);
    }
  }

  return (
    <article className="card card-hover stack" style={{ gap: 12 }}>
      <Link href={`/community/${card.id}`} className="stack" style={{ gap: 8 }}>
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <h3>{card.titel}</h3>
          <span className="badge badge-build">
            <Icon name="hammer" size={12} /> BUILD-KANDIDAT
          </span>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          <JourneyTag phase={card.journey_phase} />
          {card.size && (
            <span className="sizing-tag">
              <Icon name="ruler" size={12} />
              Größe {card.size}
              {card.dev_tage_min ? ` · ${card.dev_tage_min}–${card.dev_tage_max} Dev-Tage` : ""}
            </span>
          )}
        </div>
        {(card.nutzen || card.problem) && (
          <p style={{ color: "var(--dunkelgrau)" }}>{card.nutzen || card.problem}</p>
        )}
      </Link>

      {ziel > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="row-between caption">
            <span style={{ color: "var(--gold)" }}>
              Pledge: {eur(summe)} von {eur(ziel)}
            </span>
            <span>{card.unterstuetzer} Unterstützer</span>
          </div>
          <div className="progress" aria-label={`${prozent}% finanziert`}>
            <span style={{ width: `${prozent}%` }} />
          </div>
        </div>
      )}

      <div className="btn-row">
        <button
          className="btn btn-outline-teal"
          onClick={toggleVote}
          disabled={voteBusy}
          style={voted ? { color: "var(--grau-200)", borderColor: "var(--grau-200)" } : undefined}
        >
          <Icon name={voted ? "check" : "thumb-up"} size={18} />
          {voted ? `Voted · ${votes}` : `Vote · ${votes}`}
        </button>

        {pledgeDone ? (
          <button className="btn btn-gold" disabled>
            <Icon name="check" size={18} /> Danke für deinen Beitrag
          </button>
        ) : pledging ? (
          <div className="row" style={{ gap: 6 }}>
            <input
              className="amount-input"
              type="number"
              min={1}
              step={1}
              value={betrag}
              onChange={(e) => setBetrag(e.target.value)}
              aria-label="Betrag in Euro"
            />
            <button className="btn btn-gold" onClick={submitPledge} disabled={pledgeBusy}>
              {pledgeBusy ? "…" : "Beitragen"}
            </button>
          </div>
        ) : (
          <button className="btn btn-outline-gold" onClick={() => setPledging(true)}>
            <Icon name="heart" size={18} /> Beitragen
          </button>
        )}
      </div>
    </article>
  );
}

// ── TYP B — Affiliate-Empfehlung ────────────────────────────────────
function AffiliateCard({ card }: { card: FeatureCardData }) {
  const tool = card.tool;
  return (
    <article className="card card-hover stack" style={{ gap: 12 }}>
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <h3>{card.titel}</h3>
        <span className="badge badge-affiliate">
          <Icon name="external-link" size={12} /> GIBT&apos;S SCHON
        </span>
      </div>
      <JourneyTag phase={card.journey_phase} />
      <p style={{ color: "var(--dunkelgrau)" }}>
        {card.nutzen ||
          "Der Bot hat eine etablierte App gefunden, die das gut löst — kein Eigenbau nötig."}
      </p>

      {tool && (
        <div className="subcard">
          <span className="logo">
            <Icon name={iconForKey(tool.icon_key)} size={20} />
          </span>
          <div className="stack" style={{ gap: 2 }}>
            <strong style={{ fontSize: 14 }}>{tool.name}</strong>
            <span className="affiliate-note">Affiliate-Link · für dich ohne Mehrkosten</span>
          </div>
          {tool.veroeffentlicht ? (
            <Link href={`/tools/${tool.slug}`} className="btn btn-outline-teal" style={{ marginLeft: "auto" }}>
              Ansehen <Icon name="arrow-right" size={16} />
            </Link>
          ) : (
            <span className="caption" style={{ marginLeft: "auto" }}>In Prüfung</span>
          )}
        </div>
      )}
    </article>
  );
}

// ── TYP C — Verworfen (faded) ───────────────────────────────────────
function VerworfenCard({ card }: { card: FeatureCardData }) {
  return (
    <article className="card faded stack" style={{ gap: 8, color: "var(--grau-200)" }}>
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <h3 style={{ color: "var(--grau-200)" }}>{card.titel}</h3>
        <span className="badge badge-verworfen">VERWORFEN</span>
      </div>
      <JourneyTag phase={card.journey_phase} />
      <p>{card.sizing_begruendung || card.nutzen || card.problem}</p>
      <span className="caption">Abstimmung beendet · {card.votes} Votes</span>
    </article>
  );
}
