import { NextRequest } from "next/server";
import { handleApiRequest, requireAuth, unwrap } from "@/lib/api-auth";
import { createPortalUrl } from "@/lib/services/billing";

/** Returns a Stripe billing portal URL for the client to open in a browser. */
export async function POST(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    return unwrap(await createPortalUrl(userId)).data;
  });
}
