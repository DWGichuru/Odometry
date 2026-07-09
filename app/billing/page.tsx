import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PlanCard } from "@/components/billing/PlanCard";
import { StatusCard, StatusRow } from "@/components/billing/StatusCard";
import { StatusBadge } from "@/components/billing/StatusBadge";
import { NoticeBanner, LockIcon, ArrowIcon } from "@/components/billing/NoticeBanner";
import { checkoutAction, portalAction } from "@/actions/billing";
import Link from "next/link";

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function BillingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 p-4">
        <div className="pt-2 pb-4">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Billing</h1>
          <p className="mt-1 text-[14px] text-muted">Manage your Shift Recorder plan.</p>
        </div>

        <PlanCard />

        <NoticeBanner variant="info" title="Sign in to subscribe" icon={<ArrowIcon />}>
          Start with 1 month free, then $3.99/mo. Create an account to begin.
        </NoticeBanner>

        <Link
          href="/sign-in"
          className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-accent text-accent-ink text-[15px] font-bold border border-transparent transition-[filter] duration-150 ease-out hover:brightness-105"
        >
          Sign in to subscribe
        </Link>

        <p className="mt-2.5 text-center text-xs text-faint">
          New here? Creating an account starts your free trial.
        </p>
      </div>
    );
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: {
      status: true,
      freeTrialEndsAt: true,
      isLifetimeFree: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
      currentPeriodEnd: true,
    },
  });

  const now = new Date();
  const trialEnd = sub?.freeTrialEndsAt ? new Date(sub.freeTrialEndsAt) : null;
  const trialDaysRemaining = trialEnd ? Math.max(0, daysBetween(now, trialEnd)) : 0;
  const isTrialing = sub?.status === "trialing";
  const isTrialEnding = isTrialing && trialDaysRemaining <= 7;
  const isActive = sub?.status === "active";
  const isPastDue = sub?.status === "past_due";
  const isCanceled = sub?.status === "canceled";
  const isLifetime = sub?.isLifetimeFree;
  const hasNoAccess = !sub || (!isLifetime && !isTrialing && !isActive);

  return (
    <div className="mx-auto w-full max-w-lg flex-1 p-4">
      <div className="pt-2 pb-4">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">Billing</h1>
        <p className="mt-1 text-[14px] text-muted">Manage your Shift Recorder plan.</p>
      </div>

      <PlanCard />

      {isLifetime && (
        <>
          <StatusCard>
            <StatusRow label="Status">
              <StatusBadge variant="active" label="Lifetime Free" />
            </StatusRow>
            <StatusRow label="Plan">Free forever</StatusRow>
          </StatusCard>
        </>
      )}

      {isTrialEnding && (
        <NoticeBanner variant="warn" title={`Trial ends in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""}`}>
          Subscribe now to keep logging shifts without interruption.
        </NoticeBanner>
      )}

      {isTrialing && !isLifetime && (
        <>
          {!isTrialEnding && (
            <StatusCard>
              <StatusRow label="Status">
                <StatusBadge variant="trialing" label="Free trial" />
              </StatusRow>
              <StatusRow label="Trial ends">{trialEnd ? formatDate(trialEnd) : "—"}</StatusRow>
              <StatusRow label="Days remaining">{trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""}</StatusRow>
              <StatusRow label="Price after trial">$3.99 / mo</StatusRow>
            </StatusCard>
          )}

          {isTrialEnding && (
            <StatusCard>
              <StatusRow label="Status">
                <StatusBadge variant="trialing" label="Free trial" />
              </StatusRow>
              <StatusRow label="Trial ends">{trialEnd ? formatDate(trialEnd) : "—"}</StatusRow>
              <StatusRow label="Days remaining">{trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""}</StatusRow>
            </StatusCard>
          )}

          <form action={checkoutAction}>
            <button type="submit" className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-accent text-accent-ink text-[15px] font-bold border border-transparent transition-[filter] duration-150 ease-out hover:brightness-105 cursor-pointer">
              Subscribe to Pro - $3.99/mo
            </button>
          </form>

          {!isTrialEnding && (
            <p className="mt-2.5 text-center text-xs text-faint">
              Cancel anytime. You keep free access until your trial ends.
            </p>
          )}
        </>
      )}

      {isActive && !isLifetime && (
        <>
          <StatusCard>
            <StatusRow label="Status">
              <StatusBadge variant="active" label="Active" />
            </StatusRow>
            <StatusRow label="Plan">Pro - $3.99 / mo</StatusRow>
            {sub?.currentPeriodEnd && (
              <StatusRow label="Renews">{formatDate(sub.currentPeriodEnd)}</StatusRow>
            )}
          </StatusCard>

          <form action={portalAction}>
            <button type="submit" className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-surface text-text-secondary text-[15px] font-bold border border-border transition-[filter] duration-150 ease-out hover:brightness-105 cursor-pointer">
              Manage subscription
            </button>
          </form>

          <p className="mt-2.5 text-center text-xs text-faint">
            Update payment, view invoices, or cancel in the Stripe portal.
          </p>
        </>
      )}

      {isPastDue && (
        <>
          <NoticeBanner variant="danger" title="Payment failed">
            We couldn&apos;t charge your card. Update your payment method to restore access.
          </NoticeBanner>

          <StatusCard>
            <StatusRow label="Status">
              <StatusBadge variant="past_due" label="Past due" />
            </StatusRow>
            <StatusRow label="Plan">Pro - $3.99 / mo</StatusRow>
            {sub?.currentPeriodEnd && (
              <StatusRow label="Last attempt">{formatDate(sub.currentPeriodEnd)}</StatusRow>
            )}
          </StatusCard>

          <form action={portalAction}>
            <button type="submit" className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-accent text-accent-ink text-[15px] font-bold border border-transparent transition-[filter] duration-150 ease-out hover:brightness-105 cursor-pointer">
              Update payment method
            </button>
          </form>
        </>
      )}

      {isCanceled && !isLifetime && (
        <>
          <NoticeBanner variant="info" title="Subscription canceled">
            {sub?.currentPeriodEnd
              ? `You have Pro access until ${formatDate(sub.currentPeriodEnd)}. Resubscribe anytime.`
              : "Resubscribe anytime."}
          </NoticeBanner>

          <StatusCard>
            <StatusRow label="Status">
              <StatusBadge variant="canceled" label="Canceled" />
            </StatusRow>
            {sub?.currentPeriodEnd && (
              <StatusRow label="Access until">{formatDate(sub.currentPeriodEnd)}</StatusRow>
            )}
          </StatusCard>

          <form action={checkoutAction}>
            <button type="submit" className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-accent text-accent-ink text-[15px] font-bold border border-transparent transition-[filter] duration-150 ease-out hover:brightness-105 cursor-pointer">
              Resubscribe - $3.99/mo
            </button>
          </form>
        </>
      )}

      {hasNoAccess && !isCanceled && !isLifetime && (
        <>
          <NoticeBanner variant="danger" title="Your free trial has ended" icon={<LockIcon />}>
            Subscribe to Pro to unlock the dashboard and keep logging shifts.
          </NoticeBanner>

          <form action={checkoutAction}>
            <button type="submit" className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-accent text-accent-ink text-[15px] font-bold border border-transparent transition-[filter] duration-150 ease-out hover:brightness-105 cursor-pointer">
              Subscribe to Pro - $3.99/mo
            </button>
          </form>

          <p className="mt-2.5 text-center text-xs text-faint">Billed monthly. Cancel anytime.</p>
        </>
      )}
    </div>
  );
}
