import { NextRequest } from "next/server";
import { handleApiRequest, readJsonObject, requireAuth, unwrap } from "@/lib/api-auth";
import { parseSessionShiftFields } from "@/lib/api-input";
import { createShiftFromSession } from "@/lib/services/shift-session";

/**
 * Saves a COMPLETED session as a Shift. Times and odometer come from the session;
 * the body supplies the reviewed `{ date?, platform?, amountEarned?, tripsCompleted? }`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const { id } = await params;
    const fields = parseSessionShiftFields(await readJsonObject(req));
    const { shiftId } = unwrap(await createShiftFromSession(userId, id, fields));
    return { shiftId };
  }, 201);
}
