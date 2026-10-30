import { NextRequest } from "next/server";
import { handleApiRequest, requireAuth } from "@/lib/api-auth";
import { getCompletedSession, getOpenSession } from "@/lib/services/shift-session";

/** The in-progress shift, plus the latest completed one still waiting for review. */
export async function GET(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const [open, completed] = await Promise.all([
      getOpenSession(userId),
      getCompletedSession(userId),
    ]);
    return { open, completed };
  });
}
