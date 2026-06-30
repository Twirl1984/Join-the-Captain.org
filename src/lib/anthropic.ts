import Anthropic from "@anthropic-ai/sdk";

// Modelle laut Brief. Haiku für Struktur/Scout/Moderation, Sonnet fürs Sizing.
export const MODEL_HAIKU = process.env.MODEL_HAIKU || "claude-haiku-4-5-20251001";
export const MODEL_SONNET = process.env.MODEL_SONNET || "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY fehlt.");
  }
  if (!client) {
    // Konservative Defaults gegen Hänger/Kosten: SDK-Default-Timeout (10 min)
    // ist zu lang. Per .env überschreibbar.
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: Number(process.env.ANTHROPIC_TIMEOUT_MS ?? 120000),
      maxRetries: Number(process.env.ANTHROPIC_MAX_RETRIES ?? 2),
    });
  }
  return client;
}

// Ruft das Modell auf und erzwingt JSON-Ausgabe per Tool-Call.
// Der Tool-Use-Pfad ist robuster als JSON aus Freitext zu parsen.
export async function callJsonTool<T>(opts: {
  model: string;
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: Anthropic.Tool.InputSchema;
  maxTokens?: number;
}): Promise<T> {
  const anthropic = getAnthropic();
  const res = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: opts.schema,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [{ role: "user", content: opts.user }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Modell lieferte keinen Tool-Use-Block.");
  }
  return block.input as T;
}

// Web-gestützte Recherche über das serverseitige web_search-Tool von Anthropic.
// Anthropic führt die Suchen selbst aus und liefert eine fertige Antwort zurück.
//
// Warum nicht callJsonTool kombinieren? tool_choice:{type:"tool"} würde das
// Modell auf das JSON-Tool zwingen und web_search blockieren. Daher zweistufig:
// erst hier frei recherchieren lassen (Freitext + echte Quell-URLs), dann das
// Ergebnis mit callJsonTool in sauberes JSON gießen.
//
// Das SDK 0.32 typisiert web_search noch nicht — wir reichen das Tool per Cast
// durch; die Messages-API kennt es zur Laufzeit.
export interface WebRechercheErgebnis {
  text: string;
  quellen: string[]; // tatsächlich besuchte URLs (aus den Suchergebnissen)
  suchen: number; // Anzahl tatsächlich ausgeführter Web-Suchen (für Kosten-Budget)
}

export async function webRecherche(opts: {
  model: string;
  system: string;
  user: string;
  maxUses?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<WebRechercheErgebnis> {
  const anthropic = getAnthropic();
  const res = await anthropic.messages.create(
    {
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.system,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          // Harte Obergrenze an Suchen pro Anfrage (Kostenbremse).
          max_uses: opts.maxUses ?? 3,
        },
      ] as unknown as Anthropic.Tool[],
      messages: [{ role: "user", content: opts.user }],
    },
    // Pro-Aufruf-Timeout begrenzt die Suchdauer einer einzelnen Anfrage.
    { timeout: opts.timeoutMs ?? 90000 },
  );

  // Freitext-Blöcke einsammeln …
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  // … echte Quell-URLs aus den Suchergebnis-Blöcken ziehen …
  const quellen = sammleUrls(res.content);

  // … und die Zahl der tatsächlich ausgeführten Suchen (für das Budget).
  const usage = res.usage as unknown as {
    server_tool_use?: { web_search_requests?: number };
  };
  const suchen = usage?.server_tool_use?.web_search_requests ?? 0;

  return { text, quellen, suchen };
}

// Geht den Antwortbaum durch und sammelt alle vorkommenden URLs (Suchergebnisse
// und Zitations-Blöcke). Defensiv, weil das SDK die Block-Formen noch nicht typt.
function sammleUrls(node: unknown, acc = new Set<string>()): string[] {
  if (!node || typeof node !== "object") return [...acc];
  if (Array.isArray(node)) {
    for (const n of node) sammleUrls(n, acc);
    return [...acc];
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.url === "string" && /^https?:\/\//.test(obj.url)) {
    acc.add(obj.url);
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") sammleUrls(v, acc);
  }
  return [...acc];
}
