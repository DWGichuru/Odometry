"use server";

import { auth } from "@/auth";
import { extractOdometerFromPhoto as extract } from "@/lib/services/extraction";
import type { OdometerReading } from "@/lib/services/extraction";
import { toActionResult } from "@/lib/services/result";

export async function extractOdometerFromPhoto(
  imageBase64: string,
): Promise<{ success: true; data: OdometerReading } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }
  return toActionResult(await extract(session.user.id, imageBase64));
}
