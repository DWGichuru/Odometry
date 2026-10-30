import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSupportedCurrency } from '@/lib/currency';
import { ApiError, badRequest, requireAuth, handleApiRequest, readJsonObject } from '@/lib/api-auth';
import { alertOnFailure } from '@/lib/alert';

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  currency: string;
  distanceUnit: string;
}

interface UpdateProfileRequest {
  name?: unknown;
  currency?: unknown;
  distanceUnit?: unknown;
}

async function handleGetProfile(req: NextRequest): Promise<UserProfile> {
  const userId = await requireAuth(req);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      currency: true,
      distanceUnit: true,
    },
  });

  if (!user) {
    throw new ApiError('User not found', 404, 'NOT_FOUND');
  }

  return {
    ...user,
    emailVerified: user.emailVerified !== null,
  };
}

async function handleUpdateProfile(req: NextRequest): Promise<UserProfile> {
  const userId = await requireAuth(req);
  const body = await readJsonObject(req);
  const { name, currency, distanceUnit } = body as UpdateProfileRequest;

  if (name !== undefined && name !== null && typeof name !== 'string') {
    throw badRequest('Name must be a string');
  }
  if (currency !== undefined && (typeof currency !== 'string' || !isSupportedCurrency(currency))) {
    throw badRequest('Unsupported currency');
  }
  if (distanceUnit !== undefined && distanceUnit !== 'KM' && distanceUnit !== 'MI') {
    throw badRequest('Unsupported distance unit');
  }

  try {
    const updateData: { name?: string | null; currency?: string; distanceUnit?: 'KM' | 'MI' } = {};
    if (name !== undefined) updateData.name = name?.trim() || null;
    if (currency !== undefined) updateData.currency = currency;
    if (distanceUnit !== undefined) updateData.distanceUnit = distanceUnit;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        currency: true,
        distanceUnit: true,
      },
    });

    return {
      ...user,
      emailVerified: user.emailVerified !== null,
    };
  } catch (err) {
    await alertOnFailure('Failed to update profile', err);
    throw new Error('Failed to update profile');
  }
}

export async function GET(req: NextRequest) {
  return handleApiRequest(() => handleGetProfile(req));
}

export async function PATCH(req: NextRequest) {
  return handleApiRequest(() => handleUpdateProfile(req));
}
