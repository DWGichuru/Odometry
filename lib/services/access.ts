import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/subscription";
import { fail, type ServiceFailure } from "@/lib/services/result";

export async function requireSubscription(userId: string): Promise<ServiceFailure | null> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, freeTrialEndsAt: true, isLifetimeFree: true },
  });

  if (!hasAccess(sub)) {
    return fail("SUBSCRIPTION_REQUIRED", "Your free trial has ended. Subscribe to continue.");
  }
  return null;
}
