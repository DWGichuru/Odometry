import { prisma } from "@/lib/prisma";
import {
  ActiveSubscriptionError,
  createCheckoutSession,
  createCustomer,
  createPortalSession,
  customerExists,
} from "@/lib/stripe";
import { alertOnFailure } from "@/lib/alert";
import { fail, type ServiceFailure } from "@/lib/services/result";

const BILLING_UNAVAILABLE = "Could not open billing. Try again.";

export interface BillingUser {
  id: string;
  email?: string | null;
  name?: string | null;
}

export async function createCheckoutUrl(
  user: BillingUser,
): Promise<{ success: true; data: { url: string } } | ServiceFailure> {
  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { stripeCustomerId: true, stripeSubscriptionId: true, status: true },
  });

  if (sub?.stripeSubscriptionId && sub.status !== "canceled") {
    return fail("CONFLICT", "You already have a subscription.");
  }

  let checkoutUrl: string | null;
  try {
    let customerId = sub?.stripeCustomerId ?? undefined;
    if (customerId && !(await customerExists(customerId))) {
      customerId = undefined;
    }

    if (!customerId) {
      const customer = await createCustomer({
        email: user.email ?? undefined,
        name: user.name ?? undefined,
      });
      customerId = customer.id;
      await prisma.subscription.update({
        where: { userId: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    checkoutUrl = (await createCheckoutSession({ customerId })).url;
  } catch (err) {
    if (err instanceof ActiveSubscriptionError) {
      return fail("CONFLICT", "You already have a subscription.");
    }
    await alertOnFailure("Stripe checkout session creation failed", err);
    return fail("UPSTREAM_ERROR", BILLING_UNAVAILABLE);
  }

  if (!checkoutUrl) {
    await alertOnFailure(
      "Stripe checkout session creation failed",
      new Error("Could not create checkout session."),
    );
    return fail("UPSTREAM_ERROR", BILLING_UNAVAILABLE);
  }

  return { success: true, data: { url: checkoutUrl } };
}

export async function createPortalUrl(
  userId: string,
): Promise<{ success: true; data: { url: string } } | ServiceFailure> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });

  if (!sub?.stripeCustomerId) {
    return fail("NOT_FOUND", "No billing account found. Please subscribe first.");
  }

  let portalUrl: string | null;
  try {
    portalUrl = (await createPortalSession(sub.stripeCustomerId)).url;
  } catch (err) {
    await alertOnFailure("Stripe portal session creation failed", err);
    return fail("UPSTREAM_ERROR", BILLING_UNAVAILABLE);
  }

  if (!portalUrl) {
    await alertOnFailure(
      "Stripe portal session creation failed",
      new Error("Could not open billing portal."),
    );
    return fail("UPSTREAM_ERROR", BILLING_UNAVAILABLE);
  }

  return { success: true, data: { url: portalUrl } };
}
