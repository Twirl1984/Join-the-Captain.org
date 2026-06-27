"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

// Live-Countdown bis Voting-Ende. Rein clientseitig, kein Hydration-Mismatch
// dank initialem Render erst nach Mount.
export function Countdown({ endet }: { endet: string | null }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (!endet) {
      setText("Runde offen");
      return;
    }
    const ziel = new Date(endet).getTime();
    function tick() {
      const diff = ziel - Date.now();
      if (diff <= 0) {
        setText("Voting beendet");
        return;
      }
      const tage = Math.floor(diff / 86_400_000);
      const std = Math.floor((diff % 86_400_000) / 3_600_000);
      if (tage > 0) setText(`Voting endet in ${tage} Tag${tage === 1 ? "" : "en"}`);
      else setText(`Voting endet in ${std} Std`);
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [endet]);

  return (
    <span className="status-pill">
      <Icon name="clock" size={14} className="ic" />
      {text || "…"}
    </span>
  );
}
