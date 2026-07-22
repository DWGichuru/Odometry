"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createCheckoutSession,
  createCustomer,
  createPortalSession,
  customerExists,
} from "@/lib/stripe";
import { redirect } from "next/navigation";
import { alertOnFailure } from "@/lib/alert";

export async function checkoutAction(
  _formData?: FormData,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true, stripeSubscriptionId: true, status: true },
  });

  const hasLiveSubscription = !!sub?.stripeSubscriptionId && sub.status !== "canceled"
  if (hasLiveSubscription) {
    redirect("/billing?checkout=already-subscribed")
  }

  let checkoutUrl: string | null;
  try {
    let customerId = sub?.stripeCustomerId ?? undefined;
    if (customerId && !(await customerExists(customerId))) {
      customerId = undefined;
    }

    if (!customerId) {
      const customer = await createCustomer({
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      });
      customerId = customer.id;
      await prisma.subscription.update({
        where: { userId: session.user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const stripeSession = await createCheckoutSession({ customerId });
    checkoutUrl = stripeSession.url;
  } catch (err) {
    await alertOnFailure("Stripe checkout session creation failed", err);
    throw err;
  }

  if (!checkoutUrl) {
    const err = new Error("Could not create checkout session.");
    await alertOnFailure("Stripe checkout session creation failed", err);
    throw err;
  }

  redirect(checkoutUrl);
}

export async function portalAction(
  _formData?: FormData,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!sub?.stripeCustomerId) {
    throw new Error("No billing account found. Please subscribe first.");
  }

  let portalUrl: string | null;
  try {
    const portal = await createPortalSession(sub.stripeCustomerId);
    portalUrl = portal.url;
  } catch (err) {
    await alertOnFailure("Stripe portal session creation failed", err);
    throw err;
  }

  if (!portalUrl) {
    const err = new Error("Could not open billing portal.");
    await alertOnFailure("Stripe portal session creation failed", err);
    throw err;
  }

  redirect(portalUrl);
}
