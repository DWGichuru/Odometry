"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/subscription";
import type { ExtractedShiftFields } from "@/lib/extract-parser";
import { EntrySource } from "@/types/shift";
import { alertOnFailure } from "@/lib/alert";

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

export async function createShiftFromSession(
  sessionId: string,
  extractedFields: ExtractedShiftFields,
): Promise<
  { success: true; shiftId: string } | { error: string }
> {
  const access = await checkAccess();
  if ("error" in access) return access;
  const { userId } = access;

  const s = await prisma.shiftSession.findUnique({
    where: { id: sessionId },
  });

  if (!s || s.userId !== userId) {
    return { error: "Session not found." };
  }

  if (s.status !== "COMPLETED") {
    return { error: "Session is not completed." };
  }

  if (s.endOdometer === null || s.endedAt === null) {
    return { error: "Session is missing end data." };
  }

  const distanceKm = Math.round((s.endOdometer - s.startOdometer) * 100) / 100;

  let shift;
  try {
    shift = await prisma.shift.create({
      data: {
        userId,
        date: extractedFields.date
          ? new Date(`${extractedFields.date}T00:00:00`)
          : new Date(),
        platform: extractedFields.platform ?? "UBER",
        startTime: s.startedAt,
        endTime: s.endedAt,
        amountEarned: extractedFields.amountEarned ?? 0,
        tripsCompleted: extractedFields.tripsCompleted ?? 0,
        startOdometer: s.startOdometer,
        endOdometer: s.endOdometer,
        distanceKm,
        entrySource: EntrySource.ODOMETER,
      },
    });
  } catch (err) {
    await alertOnFailure("Failed to create shift from session", err);
    throw err;
  }

  return { success: true, shiftId: shift.id };
}
