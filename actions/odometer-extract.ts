"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/subscription";
import { callOpenAIOdometerVision } from "@/lib/openai";
import {
  parseOdometerResponse,
  checkOdometerPlausibility,
} from "@/lib/odometer-parser";
import type { OdometerReading, PlausibilityResult } from "@/lib/odometer-parser";

async function checkAccess(): Promise<{ error: string } | { userId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, freeTrialEndsAt: true, isLifetimeFree: true },
  });

  if (!hasAccess(sub)) {
    return { error: "Your free trial has ended. Subscribe to continue." };
  }

  return { userId: session.user.id };
}

type ExtractResult =
  | {
      success: true;
      data: {
        reading: number;
        unit: "km" | "mi" | null;
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
  const { userId } = access;

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

  const lastShift = await prisma.shift.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
    select: { endOdometer: true },
  });

  const lastEndOdometer = lastShift?.endOdometer ?? null;

  const plausibility = checkOdometerPlausibility(parsed.reading, lastEndOdometer);

  if (!plausibility.valid) {
    return { error: "Invalid odometer reading." };
  }

  return {
    success: true,
    data: {
      reading: plausibility.reading,
      unit: parsed.unit,
      confidence: plausibility.confidence,
      warnings: plausibility.warnings,
      lastEndOdometer,
    },
  };
}
