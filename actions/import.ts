"use server";

import { auth } from "@/auth";
import { extractShiftFromScreenshot as extract } from "@/lib/services/extraction";
import { toActionResult } from "@/lib/services/result";
import type { ExtractedShiftFields } from "@/lib/extract-parser";

export async function extractShiftFromScreenshot(
  formData: FormData,
): Promise<
  | { success: true; data: ExtractedShiftFields & { startOdometer: string } }
  | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const startOdometer = (formData.get("startOdometer") as string) ?? "";
  return toActionResult(await extract(session.user.id, formData.get("file"), startOdometer));
}
