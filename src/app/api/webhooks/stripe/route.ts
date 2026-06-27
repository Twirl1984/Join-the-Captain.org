import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { ok, fehler } from "@/lib/http";
import type Stripe from "stripe";

// POST /api/webhooks/stripe — bestätigt Pledges.
// Fortschritt = Summe der bezahlten Pledges (wird in data.ts aggregiert).
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return fehler("Webhook nicht konfiguriert.", 503);

  const sig = req.headers.get("stripe-signature");
  if (!sig) return fehler("Signatur fehlt.", 400);

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("[stripe] Signaturprüfung fehlgeschlagen:", err);
    return fehler("Signatur ungültig.", 400);
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await query(
        `UPDATE pledge SET status = 'bezahlt'
         WHERE stripe_payment_intent_id = $1 AND status <> 'erstattet'`,
        [pi.id],
      );
      break;
    }
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const pi = event.data.object as Stripe.PaymentIntent;
      // Offen lassen/aufräumen; nur nicht-bezahlte zurücknehmen.
      await query(
        `DELETE FROM pledge
         WHERE stripe_payment_intent_id = $1 AND status = 'offen'`,
        [pi.id],
      );
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (charge.payment_intent) {
        await query(
          `UPDATE pledge SET status = 'erstattet'
           WHERE stripe_payment_intent_id = $1`,
          [String(charge.payment_intent)],
        );
      }
      break;
    }
    default:
      // Andere Events ignorieren.
      break;
  }

  return ok({ received: true });
}
