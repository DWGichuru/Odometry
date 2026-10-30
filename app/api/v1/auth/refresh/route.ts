import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateTokens, verifyRefreshToken, type Tokens } from '@/lib/jwt';
import { ApiError, badRequest, handleApiRequest, readJsonObject } from '@/lib/api-auth';

async function handleRefresh(req: NextRequest): Promise<Tokens> {
  const { refreshToken } = await readJsonObject(req);
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw badRequest('Refresh token is required');
  }

  const userId = await verifyRefreshToken(refreshToken);
  // Re-check the account so a deleted user can't keep minting tokens.
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    : null;
  if (!user) {
    throw new ApiError('Invalid or expired refresh token', 401, 'INVALID_TOKEN');
  }

  return generateTokens(user.id);
}

export async function POST(req: NextRequest) {
  return handleApiRequest(() => handleRefresh(req));
}
