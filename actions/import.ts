"use server";

import { auth } from "@/auth";
import { callOpenAIVision } from "@/lib/openai";
import { parseExtractionResponse } from "@/lib/extract-parser";
import type { ExtractedShiftFields } from "@/lib/extract-parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { error: "No file provided." };
  }

  if (file.size === 0) {
    return { error: "File is empty." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "File is too large. Maximum size is 10MB." };
  }

  if (file.type && !file.type.startsWith("image/")) {
    return { error: "File must be an image." };
  }

  const startOdometer = (formData.get("startOdometer") as string) ?? "";

  let imageBase64: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    imageBase64 = buffer.toString("base64");
  } catch {
    return { error: "Could not read the uploaded file." };
  }

  let rawResponse: string;
  try {
    rawResponse = await callOpenAIVision(imageBase64);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "AI extraction failed.";
    return { error: message };
  }

  const fields = parseExtractionResponse(rawResponse);

  return {
    success: true,
    data: { ...fields, startOdometer },
  };
}
