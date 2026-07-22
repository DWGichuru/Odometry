"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/subscription";
import type { ShiftSession } from "@/types/shift-session";
import { SessionStatus } from "@/types/shift-session";
import { alertOnFailure } from "@/lib/alert";

type EndSessionData = {
  startOdometer: number;
  startedAt: string;
  endOdometer: number;
  endedAt: string;
  distanceKm: number;
};

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

export async function startShiftSession(
  startOdometer: number,
): Promise<{ success: true; data: ShiftSession } | { error: string }> {
  const access = await checkAccess();
  if ("error" in access) return access;
  const { userId } = access;

  if (
    typeof startOdometer !== "number" ||
    Number.isNaN(startOdometer) ||
    startOdometer < 0
  ) {
    return { error: "Odometer reading must be 0 or more." };
  }

  const existing = await prisma.shiftSession.findFirst({
    where: { userId, status: "OPEN" },
  });

  if (existing) {
    return { error: "You already have an open shift. End it before starting a new one." };
  }

  const rounded = Math.round(startOdometer * 100) / 100;
  const now = new Date();

  let session;
  try {
    session = await prisma.shiftSession.create({
      data: {
        userId,
        startOdometer: rounded,
        startedAt: now,
      },
    });
  } catch (err) {
    await alertOnFailure("Failed to start shift session", err);
    throw err;
  }

  return {
    success: true,
    data: {
      id: session.id,
      userId: session.userId,
      startOdometer: session.startOdometer,
      startedAt: now.toISOString(),
      endOdometer: session.endOdometer,
      endedAt: session.endedAt?.toISOString() ?? null,
      status: session.status as unknown as SessionStatus,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  };
}

export async function endShiftSession(
  endOdometer: number,
): Promise<{ success: true; data: EndSessionData } | { error: string }> {
  const access = await checkAccess();
  if ("error" in access) return access;
  const { userId } = access;

  if (
    typeof endOdometer !== "number" ||
    Number.isNaN(endOdometer)
  ) {
    return { error: "Odometer reading must be a number." };
  }

  const session = await prisma.shiftSession.findFirst({
    where: { userId, status: "OPEN" },
  });

  if (!session) {
    return { error: "No open shift found. Start a shift first." };
  }

  const rounded = Math.round(endOdometer * 100) / 100;

  if (rounded <= session.startOdometer) {
    return { error: "End odometer must be greater than the start reading." };
  }

  const distanceKm = Math.round((rounded - session.startOdometer) * 100) / 100;
  const now = new Date();

  try {
    await prisma.shiftSession.update({
      where: { id: session.id },
      data: {
        endOdometer: rounded,
        endedAt: now,
        status: "COMPLETED",
      },
    });
  } catch (err) {
    await alertOnFailure("Failed to end shift session", err);
    throw err;
  }

  return {
    success: true,
    data: {
      startOdometer: session.startOdometer,
      startedAt: session.startedAt.toISOString(),
      endOdometer: rounded,
      endedAt: now.toISOString(),
      distanceKm,
    },
  };
}

export async function cancelShiftSession(): Promise<
  { success: true } | { error: string }
> {
  const access = await checkAccess();
  if ("error" in access) return access;
  const { userId } = access;

  const session = await prisma.shiftSession.findFirst({
    where: { userId, status: "OPEN" },
  });

  if (!session) {
    return { error: "No open shift found to cancel." };
  }

  try {
    await prisma.shiftSession.update({
      where: { id: session.id },
      data: { status: "CANCELLED" },
    });
  } catch (err) {
    await alertOnFailure("Failed to cancel shift session", err);
    throw err;
  }

  return { success: true };
}
