interface SubscriptionAccess {
  status: string;
  freeTrialEndsAt: Date;
  isLifetimeFree: boolean;
}

export function hasAccess(sub: SubscriptionAccess | null): boolean {
  if (!sub) return false;
  if (sub.isLifetimeFree) return true;
  if (sub.status === "active") return true;
  if (sub.status === "trialing") return true;
  if (sub.freeTrialEndsAt > new Date()) return true;
  return false;
}
