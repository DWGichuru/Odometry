import { NextRequest } from 'next/server';
import { badRequest, handleApiRequest, readJsonObject } from '@/lib/api-auth';
import { requestPasswordReset } from '@/actions/password-reset';

interface PasswordResetRequest {
  email: string;
}

interface PasswordResetResponse {
  message: string;
}

async function handlePasswordResetRequest(req: NextRequest): Promise<PasswordResetResponse> {
  const body = await readJsonObject(req);
  const { email } = body as unknown as PasswordResetRequest;

  if (typeof email !== 'string' || !email.trim()) {
    throw badRequest('Email is required');
  }

  const result = await requestPasswordReset(email.trim().toLowerCase());

  if (!result.success) {
    throw badRequest('Failed to send password reset email');
  }

  return {
    message: 'If an account exists with this email, a password reset link will be sent',
  };
}

export async function POST(req: NextRequest) {
  return handleApiRequest(() => handlePasswordResetRequest(req));
}
