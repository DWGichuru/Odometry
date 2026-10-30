import { NextRequest } from 'next/server';
import { confirmEmailVerification } from '@/actions/verify-email';
import { badRequest, handleApiRequest, readJsonObject } from '@/lib/api-auth';

interface ConfirmVerificationRequest {
  token: string;
}

interface ConfirmVerificationResponse {
  message: string;
}

async function handleConfirmVerification(req: NextRequest): Promise<ConfirmVerificationResponse> {
  const body = await readJsonObject(req);
  const { token } = body as unknown as ConfirmVerificationRequest;

  if (typeof token !== 'string' || !token.trim()) {
    throw badRequest('Verification token is required');
  }

  const result = await confirmEmailVerification(token.trim());

  if (!result.success) {
    throw badRequest(result.error || 'Failed to verify email');
  }

  return {
    message: 'Email verified successfully',
  };
}

export async function POST(req: NextRequest) {
  return handleApiRequest(() => handleConfirmVerification(req));
}
