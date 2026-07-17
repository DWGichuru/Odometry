import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return _stripe;
}

interface CreateCheckoutSessionParams {
  customerId?: string;
  customerEmail?: string;
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
) {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_PRICE_ID is not configured");
  }

  if (params.customerId) {
    const existing = await stripe.subscriptions.list({
      customer: params.customerId,
      status: "all"
    })
    const hasLive = existing.data.some(s =>
      ["active", "trialing", "past_due", "unpaid"].includes(s.status)
    )
    if (hasLive) {
      throw new Error("Customer already has an active subscription.")
    }
  }

  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/billing?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/billing?checkout=canceled`,
    customer: params.customerId,
    allow_promotion_codes: true,
  });
}

export async function createPortalSession(customerId: string) {
  const stripe = getStripe();

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/billing`,
  });
}
