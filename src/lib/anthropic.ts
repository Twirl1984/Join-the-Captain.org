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
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
