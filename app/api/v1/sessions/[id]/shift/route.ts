import { NextRequest } from "next/server";
import { handleApiRequest, readJsonObject, requireAuth, unwrap } from "@/lib/api-auth";
import { parseSessionShiftFields, requireTimeZone } from "@/lib/api-input";
import { createShiftFromSession } from "@/lib/services/shift-session";

/**
 * Saves a COMPLETED session as a Shift. Times and odometer come from the session;
 * the body supplies the reviewed `{ date?, platform?, amountEarned?, tripsCompleted? }`
 * plus the device's `timeZone`, used to store the session times as wall-clock time.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const { id } = await params;
    const body = await readJsonObject(req);
    const fields = parseSessionShiftFields(body);
    const { shiftId } = unwrap(await createShiftFromSession(userId, id, fields, requireTimeZone(body)));
    return { shiftId };
  }, 201);
}
