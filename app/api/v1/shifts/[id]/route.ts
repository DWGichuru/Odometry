import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiRequest, ApiError, badRequest, readJsonObject } from '@/lib/api-auth';
import { hasAccess } from '@/lib/subscription';
import { buildShift, isValid, validateShiftEntry } from '@/lib/shift-entry';
import type { ShiftFormData } from '@/lib/shift-entry';
import { convertOdometerFieldsToKm } from '@/lib/units';
import { alertOnFailure } from '@/lib/alert';

interface ShiftData {
  date?: string;
  platform?: string;
  startTime?: string;
  endTime?: string;
  amountEarned?: string | number;
  tripsCompleted?: string | number;
  odoMode?: 'odometer' | 'distance';
  startOdometer?: string | number;
  distance?: string | number;
  endOdometer?: string | number;
}

interface Shift {
  id: string;
  userId: string;
  date: string;
  platform: string;
  startTime: string;
  endTime: string;
  amountEarned: number;
  tripsCompleted: number;
  startOdometer: number;
  endOdometer: number;
  distanceKm: number;
  entrySource: string;
  createdAt: string;
  updatedAt: string;
}

async function handleGetShift(id: string, userId: string): Promise<Shift> {
  const shift = await prisma.shift.findUnique({
    where: { id },
  });

  if (!shift || shift.userId !== userId) {
    throw new ApiError('Shift not found', 404, 'SHIFT_NOT_FOUND');
  }

  return {
    id: shift.id,
    userId: shift.userId,
    date: shift.date.toISOString().split('T')[0],
    platform: shift.platform,
    startTime: shift.startTime.toISOString(),
    endTime: shift.endTime.toISOString(),
    amountEarned: shift.amountEarned,
    tripsCompleted: shift.tripsCompleted,
    startOdometer: shift.startOdometer,
    endOdometer: shift.endOdometer,
    distanceKm: shift.distanceKm,
    entrySource: shift.entrySource,
    createdAt: shift.createdAt.toISOString(),
    updatedAt: shift.updatedAt.toISOString(),
  };
}

async function handleUpdateShift(id: string, userId: string, body: ShiftData): Promise<Shift> {
  // Verify shift exists and belongs to user
  const existing = await prisma.shift.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== userId) {
    throw new ApiError('Shift not found', 404, 'SHIFT_NOT_FOUND');
  }

  // Check subscription access
  const [subscription, user] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { distanceUnit: true },
    }),
  ]);

  if (!subscription || !hasAccess(subscription)) {
    throw new ApiError('Your subscription has expired', 403, 'SUBSCRIPTION_REQUIRED');
  }

  const distanceUnit = user?.distanceUnit ?? 'MI';

  // Build form data for validation
  const formData: ShiftFormData = {
    date: String(body.date ?? existing.date.toISOString().split('T')[0]),
    platform: (body.platform ?? existing.platform) as ShiftFormData['platform'],
    startTime: String(body.startTime ?? existing.startTime.toISOString()),
    endTime: String(body.endTime ?? existing.endTime.toISOString()),
    amountEarned: String(body.amountEarned ?? existing.amountEarned),
    tripsCompleted: String(body.tripsCompleted ?? existing.tripsCompleted),
    odoMode: (body.odoMode ?? 'odometer') as ShiftFormData['odoMode'],
    ...convertOdometerFieldsToKm(
      {
        startOdometer: String(body.startOdometer ?? existing.startOdometer),
        distance: String(body.distance ?? ''),
        endOdometer: String(body.endOdometer ?? existing.endOdometer),
      },
      distanceUnit,
    ),
  };

  // Validate
  const errors = validateShiftEntry(formData);
  if (!isValid(errors)) {
    throw badRequest(Object.values(errors).join(' '));
  }

  // Build shift object
  const shift = buildShift(formData, userId);

  try {
    const updated = await prisma.shift.update({
      where: { id },
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

    return {
      id: updated.id,
      userId: updated.userId,
      date: updated.date.toISOString().split('T')[0],
      platform: updated.platform,
      startTime: updated.startTime.toISOString(),
      endTime: updated.endTime.toISOString(),
      amountEarned: updated.amountEarned,
      tripsCompleted: updated.tripsCompleted,
      startOdometer: updated.startOdometer,
      endOdometer: updated.endOdometer,
      distanceKm: updated.distanceKm,
      entrySource: updated.entrySource,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  } catch (err) {
    await alertOnFailure('Failed to update shift', err);
    throw new Error('Failed to update shift');
  }
}

async function handleDeleteShift(id: string, userId: string): Promise<{ message: string }> {
  // Verify shift exists and belongs to user
  const existing = await prisma.shift.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== userId) {
    throw new ApiError('Shift not found', 404, 'SHIFT_NOT_FOUND');
  }

  // Check subscription access
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription || !hasAccess(subscription)) {
    throw new ApiError('Your subscription has expired', 403, 'SUBSCRIPTION_REQUIRED');
  }

  try {
    await prisma.shift.delete({ where: { id } });
    return { message: 'Shift deleted successfully' };
  } catch (err) {
    await alertOnFailure('Failed to delete shift', err);
    throw new Error('Failed to delete shift');
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const { id } = await params;
    return handleGetShift(id, userId);
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const { id } = await params;
    const body = await readJsonObject(req);
    return handleUpdateShift(id, userId, body as unknown as ShiftData);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRequest(async () => {
    const userId = await requireAuth(req);
    const { id } = await params;
    return handleDeleteShift(id, userId);
  });
}
