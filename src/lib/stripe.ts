import Stripe from "stripe";

// Pledge = freiwillige UNTERSTÜTZUNG ohne Lieferversprechen.
// Wording strikt: "Unterstütze", "beitragen", "Feature-Pledge".
// Niemals "investieren", "Anteil", "Rendite".

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY fehlt.");
  }
  if (!stripe) {
    // Ohne apiVersion nutzt das SDK seine gepinnte Standard-Version.
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

export function stripeKonfiguriert(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
