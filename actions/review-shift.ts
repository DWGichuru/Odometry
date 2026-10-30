"use server";

import { auth } from "@/auth";
import { createShiftFromSession as createFromSession } from "@/lib/services/shift-session";
import { toActionResult } from "@/lib/services/result";
import type { ExtractedShiftFields } from "@/lib/extract-parser";

export async function createShiftFromSession(
  sessionId: string,
  extractedFields: ExtractedShiftFields,
): Promise<{ success: true; shiftId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }
  return toActionResult(await createFromSession(session.user.id, sessionId, extractedFields));
}
