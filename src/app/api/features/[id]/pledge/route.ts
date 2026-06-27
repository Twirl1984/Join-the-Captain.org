import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getOrCreateUser } from "@/lib/session";
import { getStripe, stripeKonfiguriert } from "@/lib/stripe";
import { ok, fehler } from "@/lib/http";
import type { FeatureRequest } from "@/lib/types";

// POST /api/features/:id/pledge — Feature-Pledge (freiwillige Unterstützung).
// Erzeugt einen Stripe PaymentIntent. Bestätigung läuft über den Webhook.
// Beträge in Cent. KEINE Investment-Sprache.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getOrCreateUser();

  let body: { betrag_cent?: number };
  try {
    body = await req.json();
  } catch {
    return fehler("Ungültiger Body.");
  }

  const betrag = Math.round(Number(body.betrag_cent));
  if (!Number.isFinite(betrag) || betrag < 100) {
    return fehler("Bitte mindestens 1 € beitragen.");
  }
  if (betrag > 100000) {
    return fehler("Magst du den Beitrag etwas kleiner halten? Danke dir.");
  }

  const feature = await queryOne<FeatureRequest>(
    "SELECT * FROM feature_request WHERE id = $1",
    [id],
  );
  if (!feature) return fehler("Feature nicht gefunden.", 404);
  if (!["voting", "build"].includes(feature.status)) {
    return fehler("Für dieses Feature kannst du gerade nicht beitragen.");
  }

  // Ohne Stripe-Konfiguration: Pledge als 'offen' vormerken (lokaler Test
  // ohne Keys). Sobald Stripe da ist, läuft der echte Flow.
  if (!stripeKonfiguriert()) {
    const pledge = await queryOne(
      `INSERT INTO pledge (feature_id, user_id, betrag_cent, status)
       VALUES ($1, $2, $3, 'offen') RETURNING *`,
      [id, user.id, betrag],
    );
    return ok({
      pledge,
      hinweis: "Stripe ist lokal nicht konfiguriert – Pledge als offen vermerkt.",
    });
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create({
    amount: betrag,
    currency: "eur",
    // Klartext-Beschreibung, Pledge-Sprache.
    description: `Feature-Pledge: ${feature.titel}`,
    metadata: {
      feature_id: id,
      user_id: user.id,
      art: "feature_pledge",
    },
  });

  await query(
    `INSERT INTO pledge (feature_id, user_id, betrag_cent, status, stripe_payment_intent_id)
     VALUES ($1, $2, $3, 'offen', $4)`,
    [id, user.id, betrag, intent.id],
  );

  return ok({
    client_secret: intent.client_secret,
    payment_intent_id: intent.id,
    betrag_cent: betrag,
  });
}
