import { NextRequest } from "next/server";
import { handleApiRequest, requireAuth, unwrap } from "@/lib/api-auth";
import { generateTrendInsights, getInsightsStatus } from "@/lib/services/insights";

/** Latest insight and how many generations remain this month. */
export async function GET(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    return unwrap(await getInsightsStatus(userId)).data;
  });
}

/** Generates a new insight; 429 once the monthly cap is used. */
export async function POST(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    return unwrap(await generateTrendInsights(userId)).data;
  }, 201);
}
