import { NextRequest } from 'next/server';
import { badRequest, handleApiRequest, readJsonObject } from '@/lib/api-auth';
import { confirmPasswordReset } from '@/actions/password-reset';

interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordResetConfirmResponse {
  message: string;
}

async function handlePasswordResetConfirm(req: NextRequest): Promise<PasswordResetConfirmResponse> {
  const body = await readJsonObject(req);
  const { token, newPassword, confirmPassword } = body as unknown as PasswordResetConfirmRequest;

  if (typeof token !== 'string' || !token.trim()) {
    throw badRequest('Reset token is required');
  }

  if (!newPassword) {
    throw badRequest('New password is required');
  }

  if (!confirmPassword) {
    throw badRequest('Password confirmation is required');
  }

  if (newPassword !== confirmPassword) {
    throw badRequest('Passwords do not match');
  }

  if (newPassword.length < 8) {
    throw badRequest('Password must be at least 8 characters');
  }

  const result = await confirmPasswordReset(token.trim(), newPassword);

  if (!result.success) {
    throw badRequest(result.error || 'Failed to reset password');
  }

  return {
    message: 'Your password has been reset successfully',
  };
}

export async function POST(req: NextRequest) {
  return handleApiRequest(() => handlePasswordResetConfirm(req));
}
