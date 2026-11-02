import { NextRequest } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiRequest, ApiError, badRequest, readJsonObject } from '@/lib/api-auth';
import { hasAccess } from '@/lib/subscription';
import { buildShift, isValid, validateShiftEntry } from '@/lib/shift-entry';
import type { ShiftFormData } from '@/lib/shift-entry';
import { convertOdometerFieldsToKm } from '@/lib/units';
import { EntrySource } from '@/types/shift';
import { alertOnFailure } from '@/lib/alert';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ShiftData {
  id?: unknown;
  date: string;
  platform: string;
  startTime: string;
  endTime: string;
  amountEarned: string | number;
  tripsCompleted: string | number;
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

async function handleListShifts(req: NextRequest): Promise<{ shifts: Shift[] }> {
  const userId = await requireAuth(req);

  // Check subscription access
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription || !hasAccess(subscription)) {
    throw new ApiError('Your subscription has expired', 403, 'SUBSCRIPTION_REQUIRED');
  }

  const shifts = await prisma.shift.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  });

  return {
    shifts: shifts.map((shift) => ({
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
    })),
  };
}

function parseClientShiftId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw badRequest('id must be a UUID');
  }
  return value.toLowerCase();
}

/** A retried create resolves to the shift the first attempt made; another driver's id conflicts. */
async function findRetriedShift(id: string, userId: string): Promise<{ shiftId: string } | null> {
  const existing = await prisma.shift.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) return null;
  if (existing.userId !== userId) {
    throw new ApiError('A shift with this id already exists', 409, 'CONFLICT');
  }
  return { shiftId: id };
}

async function handleCreateShift(req: NextRequest): Promise<{ shiftId: string }> {
  const userId = await requireAuth(req);
  const shiftData = (await readJsonObject(req)) as unknown as ShiftData;
  const clientId = parseClientShiftId(shiftData.id);

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
    date: String(shiftData.date ?? ''),
    platform: (shiftData.platform ?? '') as ShiftFormData['platform'],
    startTime: String(shiftData.startTime ?? ''),
    endTime: String(shiftData.endTime ?? ''),
    amountEarned: String(shiftData.amountEarned ?? ''),
    tripsCompleted: String(shiftData.tripsCompleted ?? ''),
    odoMode: (shiftData.odoMode ?? 'odometer') as ShiftFormData['odoMode'],
    ...convertOdometerFieldsToKm(
      {
        startOdometer: String(shiftData.startOdometer ?? ''),
        distance: String(shiftData.distance ?? ''),
        endOdometer: String(shiftData.endOdometer ?? ''),
      },
      distanceUnit,
    ),
  };

  // Validate
  const errors = validateShiftEntry(formData);
  if (!isValid(errors)) {
    throw badRequest(Object.values(errors).join(' '));
  }

  if (clientId) {
    const retried = await findRetriedShift(clientId, userId);
    if (retried) return retried;
  }

  // Build shift object
  const shift = buildShift(formData, userId, EntrySource.MANUAL);

  try {
    const created = await prisma.shift.create({
      data: {
        id: clientId ?? shift.id,
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

    return { shiftId: created.id };
  } catch (err) {
    // Two racing retries both pass the lookup above; the loser lands here.
    if (
      clientId &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const retried = await findRetriedShift(clientId, userId);
      if (retried) return retried;
    }
    await alertOnFailure('Failed to create shift', err);
    throw new Error('Failed to create shift');
  }
}

export async function GET(req: NextRequest) {
  return handleApiRequest(() => handleListShifts(req));
}

export async function POST(req: NextRequest) {
  return handleApiRequest(() => handleCreateShift(req), 201);
}
