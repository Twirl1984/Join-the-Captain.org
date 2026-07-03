// rate-limit.ts — kleiner In-Memory-Rate-Limiter (Fixed Window je Schlüssel).
//
// Schutz der rechen-/upstream-lastigen /api/navigation-Routen gegen Missbrauch
// (Review-Finding #10). Bewusst simpel und PRO INSTANZ (kein Redis): bei einem
// Single-VPS-Deploy genau richtig; hinter mehreren Replikas ist das Limit
// entsprechend x-fach — für einen Abuse-Deckel akzeptabel.
//
// clock ist injizierbar -> deterministische Tests.

export interface LimiterOpts {
  /** Max. Anfragen je Schlüssel im Fenster. */
  limit: number;
  windowMs: number;
  clock?: () => number;
}

export interface Limiter {
  /** true = Anfrage erlaubt (und gezählt), false = Limit erreicht. */
  allow(key: string): boolean;
  size(): number;
}

export function createLimiter(opts: LimiterOpts): Limiter {
  const clock = opts.clock ?? Date.now;
  const hits = new Map<string, { windowStart: number; count: number }>();
  let lastSweep = -Infinity;

  // Aufräumen höchstens einmal je Fenster (sonst O(n) pro Insert unter Last).
  function sweep(now: number): void {
    if (hits.size < 1024 || now - lastSweep < opts.windowMs) return;
    lastSweep = now;
    for (const [k, v] of hits) {
      if (now - v.windowStart >= opts.windowMs) hits.delete(k);
    }
  }

  return {
    allow(key: string): boolean {
      const now = clock();
      const cur = hits.get(key);
      if (!cur || now - cur.windowStart >= opts.windowMs) {
        sweep(now);
        hits.set(key, { windowStart: now, count: 1 });
        return true;
      }
      if (cur.count >= opts.limit) return false;
      cur.count++;
      return true;
    },
    size(): number {
      return hits.size;
    },
  };
}

/** Client-Schlüssel aus Proxy-Headern (VPS steht hinter nginx/Traefik). */
export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "local";
}
