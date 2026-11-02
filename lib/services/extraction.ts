import { prisma } from "@/lib/prisma";
import { callOpenAIVision, callOpenAIOdometerVision } from "@/lib/openai";
import { parseExtractionResponse } from "@/lib/extract-parser";
import type { ExtractedShiftFields } from "@/lib/extract-parser";
import { parseOdometerResponse, checkOdometerPlausibility } from "@/lib/odometer-parser";
import { milesToKm } from "@/lib/units";
import { alertOnFailure } from "@/lib/alert";
import { requireSubscription } from "@/lib/services/access";
import { fail, type ServiceFailure } from "@/lib/services/result";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SCREENSHOT_UNAVAILABLE = "Couldn't read that screenshot right now. Try again or enter it manually.";
const ODOMETER_UNAVAILABLE = "Couldn't read the odometer right now. Try again or type it in.";

export interface OdometerReading {
  reading: number;
  distanceUnit: "KM" | "MI";
  confidence: "high" | "low";
  warnings: string[];
  lastEndOdometer: number | null;
}

export async function readImageFile(file: unknown): Promise<{ base64: string } | ServiceFailure> {
  if (!file || !(file instanceof File)) {
    return fail("VALIDATION_ERROR", "No file provided.");
  }
  if (file.size === 0) {
    return fail("VALIDATION_ERROR", "File is empty.");
  }
  if (file.size > MAX_FILE_SIZE) {
    return fail("VALIDATION_ERROR", "File is too large. Maximum size is 10MB.");
  }
  if (file.type && !file.type.startsWith("image/")) {
    return fail("VALIDATION_ERROR", "File must be an image.");
  }

  try {
    return { base64: Buffer.from(await file.arrayBuffer()).toString("base64") };
  } catch {
    return fail("VALIDATION_ERROR", "Could not read the uploaded file.");
  }
}

export async function extractShiftFromScreenshot(
  userId: string,
  file: unknown,
  startOdometer: string,
): Promise<
  { success: true; data: ExtractedShiftFields & { startOdometer: string } } | ServiceFailure
> {
  const denied = await requireSubscription(userId);
  if (denied) return denied;

  const image = await readImageFile(file);
  if ("error" in image) return image;

  let rawResponse: string;
  try {
    rawResponse = await callOpenAIVision(image.base64);
  } catch (e) {
    await alertOnFailure("Screenshot extraction failed", e);
    return fail("UPSTREAM_ERROR", SCREENSHOT_UNAVAILABLE);
  }

  const fields = parseExtractionResponse(rawResponse);
  if (Object.values(fields).every((value) => value === null)) {
    return fail(
      "UNPROCESSABLE",
      "Couldn't read that screenshot. Try a clearer one or enter it manually.",
    );
  }

  return { success: true, data: { ...fields, startOdometer } };
}

export async function extractOdometerFromPhoto(
  userId: string,
  imageBase64: string,
): Promise<{ success: true; data: OdometerReading } | ServiceFailure> {
  const denied = await requireSubscription(userId);
  if (denied) return denied;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { distanceUnit: true },
  });
  const distanceUnit = user?.distanceUnit ?? "MI";

  let rawResponse: string;
  try {
    rawResponse = await callOpenAIOdometerVision(imageBase64);
  } catch (e) {
    await alertOnFailure("Odometer vision extraction failed", e);
    return fail("UPSTREAM_ERROR", ODOMETER_UNAVAILABLE);
  }

  const parsed = parseOdometerResponse(rawResponse);
  if (parsed.reading === null) {
    return fail("UNPROCESSABLE", "Could not read the odometer. Try a clearer photo.");
  }

  // Trust the photo's own detected unit (ground truth for that car); fall
  // back to the driver's stored preference only when detection failed.
  const sourceUnit = parsed.unit ?? (distanceUnit === "MI" ? "mi" : "km");
  const readingKm = sourceUnit === "mi" ? milesToKm(parsed.reading) : parsed.reading;

  const lastShift = await prisma.shift.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
    select: { endOdometer: true },
  });
  const lastEndOdometer = lastShift?.endOdometer ?? null;

  const plausibility = checkOdometerPlausibility(readingKm, lastEndOdometer);
  if (!plausibility.valid) {
    return fail("UNPROCESSABLE", "Invalid odometer reading.");
  }

  return {
    success: true,
    data: {
      reading: plausibility.reading,
      distanceUnit,
      confidence: plausibility.confidence,
      warnings: plausibility.warnings,
      lastEndOdometer,
    },
  };
}
