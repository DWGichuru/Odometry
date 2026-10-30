import { NextRequest } from "next/server";
import { handleApiRequest, readJsonObject, requireAuth, unwrap } from "@/lib/api-auth";
import { requireNumber } from "@/lib/api-input";
import { startShiftSession } from "@/lib/services/shift-session";

/** Body: `{ startOdometer }` in km. The server stamps `startedAt`; the client clock is never used. */
export async function POST(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const startOdometer = requireNumber(await readJsonObject(req), "startOdometer");
    return unwrap(await startShiftSession(userId, startOdometer)).data;
  }, 201);
}
