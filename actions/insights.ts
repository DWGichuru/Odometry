"use server";

import { auth } from "@/auth";
import * as service from "@/lib/services/insights";
import type { InsightData, InsightsStatus } from "@/lib/services/insights";
import { toActionResult } from "@/lib/services/result";

export async function generateTrendInsights(): Promise<
  { success: true; data: InsightData } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }
  return toActionResult(await service.generateTrendInsights(session.user.id));
}

export async function getInsightsStatus(): Promise<
  { success: true; data: InsightsStatus } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }
  return toActionResult(await service.getInsightsStatus(session.user.id));
}
