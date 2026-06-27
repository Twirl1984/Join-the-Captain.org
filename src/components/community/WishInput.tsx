"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { plausibleEvent } from "@/components/Plausible";

// Wunsch-Einreichung. Postet an /api/features (Moderation + Pipeline laufen
// serverseitig), danach Board neu laden.
export function WishInput() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);

  async function submit() {
    if (text.trim().length < 8 || busy) return;
    setBusy(true);
    setMeldung(null);
    try {
      const res = await fetch("/api/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMeldung({ art: "fehler", text: data.error || "Das hat nicht geklappt." });
      } else {
        plausibleEvent("Wunsch eingereicht");
        setText("");
        setMeldung({
          art: "ok",
          text: data.hinweis || "Danke. Dein Wunsch ist an Bord und wird geprüft.",
        });
        router.refresh();
      }
    } catch {
      setMeldung({ art: "fehler", text: "Verbindung gestört. Versuch es gleich noch mal." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack" style={{ gap: 10 }}>
      <strong style={{ color: "var(--navy-deep)" }}>Wunsch einreichen</strong>
      <textarea
        className="wish-input"
        placeholder="Was wünschst du dir für deinen Törn?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={2000}
        disabled={busy}
      />
      <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
        <span className="caption">
          Der Bot strukturiert deinen Wunsch und prüft, ob es dafür schon eine App gibt.
        </span>
        <button className="btn btn-teal" onClick={submit} disabled={busy || text.trim().length < 8}>
          <Icon name="send" size={18} />
          {busy ? "Wird geprüft…" : "Wunsch einreichen"}
        </button>
      </div>
      {meldung && (
        <p
          className="caption"
          style={{
            color: meldung.art === "ok" ? "var(--phase-toern-text)" : "var(--phase-danach-text)",
          }}
        >
          {meldung.text}
        </p>
      )}
    </div>
  );
}
