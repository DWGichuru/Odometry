import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateTokens } from '@/lib/jwt';
import { ApiError, badRequest, handleApiRequest, readJsonObject } from '@/lib/api-auth';
import { hasAccess } from '@/lib/subscription';

interface SignInRequest {
  email: string;
  password: string;
}

interface SubscriptionInfo {
  hasAccess: boolean;
  freeTrialEndsAt: string;
  status: string;
  currentPeriodEnd: string | null;
  isLifetimeFree: boolean;
}

interface SignInResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean;
    currency: string;
    distanceUnit: string;
  };
  subscription: SubscriptionInfo;
}

async function handleSignIn(req: NextRequest): Promise<SignInResponse> {
  const body = await readJsonObject(req);
  const { email, password } = body as unknown as SignInRequest;

  if (typeof email !== 'string' || !email.trim()) {
    throw badRequest('Email is required');
  }
  if (typeof password !== 'string' || !password) {
    throw badRequest('Password is required');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      credential: true,
      subscription: true,
    },
  });

  const invalid = new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

  // OAuth-only users have no Credential row, so they cannot use password sign-in.
  if (!user?.credential) {
    throw invalid;
  }

  const passwordMatch = await bcrypt.compare(password, user.credential.hashedPassword);
  if (!passwordMatch) {
    throw invalid;
  }

  if (!user.emailVerified) {
    throw new ApiError('Please verify your email before signing in', 403, 'EMAIL_NOT_VERIFIED');
  }

  if (!user.subscription) {
    throw new Error(`User ${user.id} has no Subscription row`);
  }

  const { accessToken, refreshToken } = await generateTokens(user.id);

  const subscriptionAccess = hasAccess(user.subscription);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified !== null,
      currency: user.currency,
      distanceUnit: user.distanceUnit,
    },
    subscription: {
      hasAccess: subscriptionAccess,
      freeTrialEndsAt: user.subscription.freeTrialEndsAt.toISOString(),
      status: user.subscription.status,
      currentPeriodEnd: user.subscription.currentPeriodEnd?.toISOString() ?? null,
      isLifetimeFree: user.subscription.isLifetimeFree,
    },
  };
}

export async function POST(req: NextRequest) {
  return handleApiRequest(() => handleSignIn(req));
}
