"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/subscription";
import { buildShift, isValid, validateShiftEntry } from "@/lib/shift-entry";
import type { ShiftFormData } from "@/lib/shift-entry";
import { convertOdometerFieldsToKm } from "@/lib/units";
import { EntrySource } from "@/types/shift";
import { alertOnFailure } from "@/lib/alert";

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

export async function createShift(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
  entrySource: EntrySource = EntrySource.MANUAL,
): Promise<{ error?: string; success?: boolean }> {
  const access = await checkAccess();
  if ("error" in access) return access;
  const { userId, distanceUnit } = access;

  const data: ShiftFormData = {
    date: (formData.get("date") as string) ?? "",
    platform: (formData.get("platform") as ShiftFormData["platform"]) ?? "",
    startTime: (formData.get("startTime") as string) ?? "",
    endTime: (formData.get("endTime") as string) ?? "",
    amountEarned: (formData.get("amountEarned") as string) ?? "",
    tripsCompleted: (formData.get("tripsCompleted") as string) ?? "",
    odoMode:
      (formData.get("odoMode") as ShiftFormData["odoMode"]) ?? "odometer",
    ...convertOdometerFieldsToKm(
      {
        startOdometer: (formData.get("startOdometer") as string) ?? "",
        distance: (formData.get("distance") as string) ?? "",
        endOdometer: (formData.get("endOdometer") as string) ?? "",
      },
      distanceUnit,
    ),
  };

  const errors = validateShiftEntry(data);
  if (!isValid(errors)) {
    return { error: Object.values(errors).join(" ") };
  }

  const shift = buildShift(data, userId, entrySource);

  try {
    await prisma.shift.create({
      data: {
        id: shift.id,
        userId: shift.userId,
        date: new Date(`${shift.date}T00:00:00`),
        platform: shift.platform,
        startTime: new Date(shift.startTime),
        endTime: new Date(shift.endTime),
        amountEarned: shift.amountEarned,
        tripsCompleted: shift.tripsCompleted,
        startOdometer: shift.startOdometer,
        endOdometer: shift.endOdometer,
        distanceKm: shift.distanceKm,
        entrySource: shift.entrySource,
      },
    });
  } catch (err) {
    await alertOnFailure("Failed to create shift", err);
    throw err;
  }

  return { success: true };
}

export async function updateShift(
  shiftId: string,
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const access = await checkAccess();
  if ("error" in access) return access;
  const { userId, distanceUnit } = access;

  const existing = await prisma.shift.findUnique({
    where: { id: shiftId },
  });

  if (!existing || existing.userId !== userId) {
    return { error: "Shift not found." };
  }

  const data: ShiftFormData = {
    date: (formData.get("date") as string) ?? "",
    platform: (formData.get("platform") as ShiftFormData["platform"]) ?? "",
    startTime: (formData.get("startTime") as string) ?? "",
    endTime: (formData.get("endTime") as string) ?? "",
    amountEarned: (formData.get("amountEarned") as string) ?? "",
    tripsCompleted: (formData.get("tripsCompleted") as string) ?? "",
    odoMode:
      (formData.get("odoMode") as ShiftFormData["odoMode"]) ?? "odometer",
    ...convertOdometerFieldsToKm(
      {
        startOdometer: (formData.get("startOdometer") as string) ?? "",
        distance: (formData.get("distance") as string) ?? "",
        endOdometer: (formData.get("endOdometer") as string) ?? "",
      },
      distanceUnit,
    ),
  };

  const errors = validateShiftEntry(data);
  if (!isValid(errors)) {
    return { error: Object.values(errors).join(" ") };
  }

  const shift = buildShift(data, userId);

  try {
    await prisma.shift.update({
      where: { id: shiftId },
      data: {
        date: new Date(`${shift.date}T00:00:00`),
        platform: shift.platform,
        startTime: new Date(shift.startTime),
        endTime: new Date(shift.endTime),
        amountEarned: shift.amountEarned,
        tripsCompleted: shift.tripsCompleted,
        startOdometer: shift.startOdometer,
        endOdometer: shift.endOdometer,
        distanceKm: shift.distanceKm,
      },
    });
  } catch (err) {
    await alertOnFailure("Failed to update shift", err);
    throw err;
  }

  return { success: true };
}

export async function deleteShift(
  shiftId: string,
): Promise<{ error?: string; success?: boolean }> {
  const access = await checkAccess();
  if ("error" in access) return access;
  const { userId } = access;

  const existing = await prisma.shift.findUnique({
    where: { id: shiftId },
  });

  if (!existing || existing.userId !== userId) {
    return { error: "Shift not found." };
  }

  try {
    await prisma.shift.delete({ where: { id: shiftId } });
  } catch (err) {
    await alertOnFailure("Failed to delete shift", err);
    throw err;
  }

  return { success: true };
}
