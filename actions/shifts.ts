"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildShift, isValid, validateShiftEntry } from "@/lib/shift-entry";
import type { ShiftFormData } from "@/lib/shift-entry";

export async function createShift(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
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
    startOdometer: (formData.get("startOdometer") as string) ?? "",
    distance: (formData.get("distance") as string) ?? "",
    endOdometer: (formData.get("endOdometer") as string) ?? "",
  };

  const errors = validateShiftEntry(data);
  if (!isValid(errors)) {
    return { error: Object.values(errors).join(" ") };
  }

  const shift = buildShift(data, session.user.id);

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

  return { success: true };
}

export async function updateShift(
  shiftId: string,
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const existing = await prisma.shift.findUnique({
    where: { id: shiftId },
  });

  if (!existing || existing.userId !== session.user.id) {
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
    startOdometer: (formData.get("startOdometer") as string) ?? "",
    distance: (formData.get("distance") as string) ?? "",
    endOdometer: (formData.get("endOdometer") as string) ?? "",
  };

  const errors = validateShiftEntry(data);
  if (!isValid(errors)) {
    return { error: Object.values(errors).join(" ") };
  }

  const shift = buildShift(data, session.user.id);

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

  return { success: true };
}

export async function deleteShift(
  shiftId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const existing = await prisma.shift.findUnique({
    where: { id: shiftId },
  });

  if (!existing || existing.userId !== session.user.id) {
    return { error: "Shift not found." };
  }

  await prisma.shift.delete({ where: { id: shiftId } });

  return { success: true };
}
