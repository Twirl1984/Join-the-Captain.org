import type { Metadata } from "next";
import { getBoard } from "@/lib/data";
import { getUser } from "@/lib/session";
import { Icon } from "@/components/Icon";
import { Countdown } from "@/components/community/Countdown";
import { WishInput } from "@/components/community/WishInput";
import { FeatureCard } from "@/components/community/FeatureCard";

export const metadata: Metadata = {
  title: "Community — Feature-Board",
  description:
    "Wünsch dir ein Feature für deinen Törn. Die KI strukturiert und prüft, " +
    "die Crew votet. Transparent vom Wunsch bis zum Ergebnis.",
  alternates: { canonical: "/community" },
};

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: "bulb", label: "Wunsch posten" },
  { icon: "robot", label: "KI prüft" },
  { icon: "thumb-up", label: "Community votet" },
  { icon: "flag", label: "Ergebnis" },
] as const;

export default async function CommunityPage() {
  const user = await getUser();
  const { runde, cards } = await getBoard(user?.id ?? null);
  const aktiveVorschlaege = cards.filter((c) => c.status === "voting" || c.status === "build").length;

  return (
    <div className="container section stack" style={{ gap: 24 }}>
      {/* Header */}
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="section-label">Join the Captain · Community</span>
          <h1>Feature-Board</h1>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Countdown endet={runde?.voting_endet_am ?? null} />
          <a
            className="btn btn-outline-teal"
            href="https://discord.gg/join-the-captain"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="discord" size={18} /> Zur Community
          </a>
        </div>
      </div>

      {/* Mini-Stepper */}
      <div className="card stepper" style={{ padding: 12 }}>
        {STEPS.map((s, i) => (
          <div key={s.label} className="row" style={{ gap: 8 }}>
            <span className="step">
              <Icon name={s.icon} size={20} className="ic" />
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="divider" />}
          </div>
        ))}
      </div>

      {/* Wunsch-Input */}
      <WishInput />

      {/* Abschnitts-Label */}
      <div className="row-between">
        <strong>
          Aktuelle Runde · {aktiveVorschlaege} Vorschl{aktiveVorschlaege === 1 ? "ag" : "äge"}
        </strong>
        <span className="caption">sortiert nach Votes</span>
      </div>

      {/* Karten-Grid */}
      {cards.length === 0 ? (
        <div className="empty stack" style={{ alignItems: "center", gap: 12 }}>
          <Icon name="inbox" size={32} style={{ color: "var(--grau-200)" }} />
          <p>Noch keine Wünsche eingereicht.</p>
          <p className="caption">Mach den Anfang — oben im Feld.</p>
        </div>
      ) : (
        <div className="grid-features">
          {cards.map((card) => (
            <FeatureCard key={card.id} card={card} />
          ))}
        </div>
      )}

      {/* Crewguard-Footer */}
      <p className="caption center-note">
        <Icon name="shield-check" size={14} style={{ color: "var(--teal)" }} />
        Der KI-Crewguard hält den Ton an Bord freundlich.
      </p>
    </div>
  );
}
