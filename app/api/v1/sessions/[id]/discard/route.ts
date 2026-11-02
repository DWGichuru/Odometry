import { NextRequest } from "next/server";
import { handleApiRequest, requireAuth, unwrap } from "@/lib/api-auth";
import { discardShiftSession } from "@/lib/services/shift-session";

/** Discards a COMPLETED session the driver doesn't want to save, so a new shift can start. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const { id } = await params;
    unwrap(await discardShiftSession(userId, id));
    return { discarded: true };
  });
}
