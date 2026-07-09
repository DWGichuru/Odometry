"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";
import { redirect } from "next/navigation";

export async function checkoutAction(
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

  const stripeSession = await createCheckoutSession({
    customerId: sub?.stripeCustomerId ?? undefined,
    customerEmail: session.user.email ?? undefined,
  });

  if (!stripeSession.url) {
    throw new Error("Could not create checkout session.");
  }

  redirect(stripeSession.url);
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

  const portal = await createPortalSession(sub.stripeCustomerId);

  if (!portal.url) {
    throw new Error("Could not open billing portal.");
  }

  redirect(portal.url);
}
