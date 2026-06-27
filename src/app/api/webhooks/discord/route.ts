import { NextRequest } from "next/server";
import { ok, fehler } from "@/lib/http";

// POST /api/webhooks/discord — STUB.
// Der Discord-Bot selbst ist NICHT Teil dieser Aufgabe (siehe Brief).
// Hier nur der Endpoint: Signatur/Secret prüfen, Payload annehmen, loggen.
// TODO: Bot-Logik (Wunsch posten, Voting spiegeln) später anbinden.
export async function POST(req: NextRequest) {
  const secret = process.env.DISCORD_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get("x-discord-secret");
    if (provided !== secret) return fehler("Nicht autorisiert.", 401);
  }

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    // Discord PING o.ä. ohne Body ist ok.
  }

  console.log("[discord-webhook] empfangen (Stub):", payload);
  return ok({ received: true, stub: true });
}
