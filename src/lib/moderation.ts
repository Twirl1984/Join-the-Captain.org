import { callJsonTool, MODEL_HAIKU } from "./anthropic";
import { query } from "./db";

export type ModVerdict = "ok" | "flag" | "block";

export interface ModResult {
  verdict: ModVerdict;
  grund: string;
}

// Moderation-Hook. block = freundlich ablehnen, flag = durchlassen + Log,
// ok = durchlassen. Nie auto-bannen.
//
// Fällt bei API-Fehlern bewusst auf "ok" zurück (fail-open), damit eine
// Einreichung nicht wegen Modell-Ausfall verloren geht. Grenzfälle landen
// ohnehin im flag-Pfad und damit im mod_log.
export async function moderateText(text: string): Promise<ModResult> {
  if (!text.trim()) {
    return { verdict: "block", grund: "Leerer Text." };
  }
  try {
    const result = await callJsonTool<ModResult>({
      model: MODEL_HAIKU,
      system:
        "Du bist der Crewguard von Join the Captain, einer Segel-Community. " +
        "Du prüfst Feature-Wünsche auf Ton und Inhalt. Du-Form, ruhig, fair. " +
        "block nur bei klar verletzendem, hasserfülltem, illegalem oder Spam-Inhalt. " +
        "flag bei Graubereich (derbe Sprache, unklar). ok sonst. " +
        "Sei großzügig: Segler-Slang und Frust sind in Ordnung.",
      user: `Bewerte diesen Feature-Wunsch:\n\n"""${text}"""`,
      toolName: "moderation_verdict",
      toolDescription: "Gib das Moderations-Urteil zurück.",
      schema: {
        type: "object",
        properties: {
          verdict: { type: "string", enum: ["ok", "flag", "block"] },
          grund: { type: "string", description: "Kurze Begründung, Du-Form." },
        },
        required: ["verdict", "grund"],
      },
      maxTokens: 256,
    });
    return result;
  } catch (err) {
    console.error("[moderation] Fehler, fail-open:", err);
    return { verdict: "ok", grund: "Moderation übersprungen (Fehler)." };
  }
}

export async function logModeration(
  featureId: string | null,
  result: ModResult,
  textProbe: string,
): Promise<void> {
  await query(
    `INSERT INTO mod_log (feature_id, verdict, text_probe, grund)
     VALUES ($1, $2, $3, $4)`,
    [featureId, result.verdict, textProbe.slice(0, 500), result.grund],
  );
}
