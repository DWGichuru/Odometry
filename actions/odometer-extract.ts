"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/subscription";
import { callOpenAIOdometerVision } from "@/lib/openai";
import {
  parseOdometerResponse,
  checkOdometerPlausibility,
} from "@/lib/odometer-parser";
import { milesToKm } from "@/lib/units";

async function checkAccess(): Promise<
  { error: string } | { userId: string; distanceUnit: "KM" | "MI" }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const [sub, user] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { status: true, freeTrialEndsAt: true, isLifetimeFree: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { distanceUnit: true },
    }),
  ]);

  if (!hasAccess(sub)) {
    return { error: "Your free trial has ended. Subscribe to continue." };
  }

  return { userId: session.user.id, distanceUnit: user?.distanceUnit ?? "MI" };
}

type ExtractResult =
  | {
      success: true;
      data: {
        reading: number;
        distanceUnit: "KM" | "MI";
        confidence: "high" | "low";
        warnings: string[];
        lastEndOdometer: number | null;
      };
    }
  | { error: string };

export async function extractOdometerFromPhoto(
  imageBase64: string,
): Promise<ExtractResult> {
  const access = await checkAccess();
  if ("error" in access) return access;
  const { userId, distanceUnit } = access;

  let rawResponse: string;
  try {
    rawResponse = await callOpenAIOdometerVision(imageBase64);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not read the odometer.";
    return { error: message };
  }

  const parsed = parseOdometerResponse(rawResponse);

  if (parsed.reading === null) {
    return { error: "Could not read the odometer. Try a clearer photo." };
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
    return { error: "Invalid odometer reading." };
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
