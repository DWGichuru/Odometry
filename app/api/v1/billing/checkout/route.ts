import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiRequest, requireAuth, unwrap } from "@/lib/api-auth";
import { createCheckoutUrl } from "@/lib/services/billing";

/** Returns a Stripe Checkout URL for the client to open in a browser. */
export async function POST(req: NextRequest) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      throw new ApiError("User not found", 404, "NOT_FOUND");
    }
    return unwrap(await createCheckoutUrl(user)).data;
  });
}
