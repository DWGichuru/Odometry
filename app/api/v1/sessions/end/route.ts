import { NextRequest } from "next/server";
import { handleApiRequest, readJsonObject, requireAuth, unwrap } from "@/lib/api-auth";
import { requireNumber } from "@/lib/api-input";
import { endShiftSession } from "@/lib/services/shift-session";

/** Body: `{ endOdometer }` in km. Ends the driver's open session and leaves it COMPLETED for review. */
export async function POST(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const endOdometer = requireNumber(await readJsonObject(req), "endOdometer");
    return unwrap(await endShiftSession(userId, endOdometer)).data;
  });
}
