import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

type SubStatus = "trialing" | "active" | "past_due" | "canceled";

const VALID_STATUSES = new Set<string>(["trialing", "active", "past_due", "canceled"]);

function mapStripeStatus(stripeStatus: string): SubStatus {
  if (VALID_STATUSES.has(stripeStatus)) return stripeStatus as SubStatus;
  return "past_due";
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): number | undefined {
  return sub.items?.data?.[0]?.current_period_end;
}

function toDate(ts: number | undefined): Date | undefined {
  return ts ? new Date(ts * 1000) : undefined;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const status = mapStripeStatus(subscription.status);
  const periodEnd = subscriptionPeriodEnd(subscription);

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { status, currentPeriodEnd: toDate(periodEnd) },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (customerId && subscriptionId) {
          const existingSubs = await stripe.subscriptions.list({
            customer: customerId,
            status: "all",
          });
          const duplicates = existingSubs.data.filter(
            (s) =>
              s.id !== subscriptionId &&
              ["active", "trialing", "past_due"].includes(s.status),
          );
          await Promise.all(duplicates.map((s) => stripe.subscriptions.cancel(s.id)));

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await prisma.subscription.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              stripeSubscriptionId: subscriptionId,
              status: mapStripeStatus(subscription.status),
              currentPeriodEnd: toDate(subscriptionPeriodEnd(subscription)),
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        await syncSubscription(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "canceled" },
        });
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const status: SubStatus =
          event.type === "invoice.paid" ? "active" : "past_due";
        const parent = invoice.parent as
          | { type: string; subscription?: string | { id: string } }
          | null;

        if (parent?.subscription) {
          const subscriptionId =
            typeof parent.subscription === "string"
              ? parent.subscription
              : parent.subscription.id;
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { status },
          });
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        break;
      }
    }
  } catch (e) {
    console.error("Stripe webhook error:", e);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
