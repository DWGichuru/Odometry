import { NextRequest } from "next/server";
import { handleApiRequest, requireAuth, unwrap } from "@/lib/api-auth";
import { cancelShiftSession } from "@/lib/services/shift-session";

export async function POST(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    unwrap(await cancelShiftSession(userId));
    return { cancelled: true };
  });
}
