import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { sendVerificationEmail } from '@/actions/verify-email';
import { ApiError, badRequest, handleApiRequest, readJsonObject } from '@/lib/api-auth';
import { getCountryPreset } from '@/lib/countries';
import { alertOnFailure } from '@/lib/alert';

interface SignUpRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  country: string;
}

interface SignUpResponse {
  emailVerificationRequired: true;
  user: {
    id: string;
    name: string | null;
    email: string;
    currency: string;
    distanceUnit: string;
  };
}

async function handleSignUp(req: NextRequest): Promise<SignUpResponse> {
  const body = await readJsonObject(req);
  const { name, email, password, confirmPassword, country } = body as Partial<
    Record<keyof SignUpRequest, unknown>
  >;

  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('Name is required');
  }
  if (typeof email !== 'string' || !email.trim()) {
    throw badRequest('Email is required');
  }
  if (typeof password !== 'string' || !password) {
    throw badRequest('Password is required');
  }
  if (password.length < 8) {
    throw badRequest('Password must be at least 8 characters');
  }
  if (password !== confirmPassword) {
    throw badRequest('Passwords do not match');
  }

  const preset = getCountryPreset(typeof country === 'string' ? country : '');
  if (!preset) {
    throw badRequest('Please select a valid country');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if email already exists
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw new ApiError('An account with this email already exists', 409, 'EMAIL_ALREADY_EXISTS');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Calculate trial end date (30 days from now)
  const trialEnd = new Date();
  trialEnd.setMonth(trialEnd.getMonth() + 1);

  // Create user with credential and subscription
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      currency: preset.currency,
      distanceUnit: preset.distanceUnit,
      credential: {
        create: { hashedPassword },
      },
      subscription: {
        create: {
          freeTrialEndsAt: trialEnd,
          status: 'trialing',
        },
      },
    },
  });

  // Create Stripe customer (non-blocking)
  try {
    const customer = await getStripe().customers.create({
      email: normalizedEmail,
      name: name.trim(),
    });
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { stripeCustomerId: customer.id },
    });
  } catch (err) {
    await alertOnFailure('User registration on Stripe failed', err);
  }

  // Send verification email (non-blocking)
  try {
    await sendVerificationEmail(normalizedEmail);
  } catch (err) {
    await alertOnFailure('Failed to send verification email', err);
  }

  // No tokens here: like the web flow, the driver must verify their email and then sign in.
  return {
    emailVerificationRequired: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency,
      distanceUnit: user.distanceUnit,
    },
  };
}

export async function POST(req: NextRequest) {
  return handleApiRequest(() => handleSignUp(req), 201);
}
