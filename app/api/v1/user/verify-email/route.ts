import { NextRequest } from 'next/server';
import { sendVerificationEmail } from '@/actions/verify-email';
import { ApiError, badRequest, handleApiRequest, readJsonObject } from '@/lib/api-auth';

async function handleSendVerification(req: NextRequest): Promise<{ message: string }> {
  const { email } = await readJsonObject(req);
  if (typeof email !== 'string' || !email.trim()) {
    throw badRequest('Email is required');
  }

  const result = await sendVerificationEmail(email.trim().toLowerCase());

  if (result === 'skipped-cooldown') {
    throw new ApiError('Please wait a minute before requesting another email', 429, 'RATE_LIMITED');
  }
  if (result === 'failed') {
    throw new ApiError('Could not send the verification email. Try again later.', 502, 'UPSTREAM_ERROR');
  }

  // Same reply whether the account exists or is already verified, so this can't probe emails.
  return { message: 'If this account needs verification, a link has been sent' };
}

export async function POST(req: NextRequest) {
  return handleApiRequest(() => handleSendVerification(req));
}
