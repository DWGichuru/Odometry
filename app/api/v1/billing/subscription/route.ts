import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiRequest, requireAuth } from "@/lib/api-auth";
import { hasAccess } from "@/lib/subscription";

export async function GET(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) {
      throw new ApiError("Subscription not found", 404, "NOT_FOUND");
    }

    return {
      hasAccess: hasAccess(sub),
      status: sub.status,
      freeTrialEndsAt: sub.freeTrialEndsAt.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      isLifetimeFree: sub.isLifetimeFree,
    };
  });
}
