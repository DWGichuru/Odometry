import Stripe from "stripe";
import { getBaseUrl } from "@/lib/base-url";

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
  customerId: string;
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
) {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_PRICE_ID is not configured");
  }

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

  const baseUrl = getBaseUrl();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/billing?checkout=success`,
    cancel_url: `${baseUrl}/billing?checkout=canceled`,
    customer: params.customerId,
    allow_promotion_codes: true,
  });
}

export async function customerExists(customerId: string): Promise<boolean> {
  const stripe = getStripe();
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return !customer.deleted;
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") {
      return false;
    }
    throw err;
  }
}

export async function createCustomer(params: { email?: string; name?: string }) {
  const stripe = getStripe();
  return stripe.customers.create({ email: params.email, name: params.name });
}

/** Deleting a customer also cancels all of its subscriptions immediately. */
export async function deleteCustomer(customerId: string): Promise<void> {
  const stripe = getStripe();
  try {
    await stripe.customers.del(customerId);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError && err.code === "resource_missing") {
      return;
    }
    throw err;
  }
}

export async function createPortalSession(customerId: string) {
  const stripe = getStripe();

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getBaseUrl()}/billing`,
  });
}
