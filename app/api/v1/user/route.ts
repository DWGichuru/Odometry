import { NextRequest } from 'next/server';
import { ApiError, badRequest, handleApiRequest, requireAuth, unwrap } from '@/lib/api-auth';
import { deleteAccount } from '@/lib/services/account';

// Google-only users have no password, so an empty body is allowed.
async function readPassword(req: NextRequest): Promise<string | undefined> {
  const text = await req.text();
  if (!text.trim()) return undefined;

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError('Request body must be valid JSON', 400, 'INVALID_JSON');
  }
  const password = (body as { password?: unknown } | null)?.password;
  if (password !== undefined && typeof password !== 'string') {
    throw badRequest('Password must be a string');
  }
  return password;
}

async function handleDeleteAccount(req: NextRequest): Promise<{ deleted: true }> {
  const userId = await requireAuth(req);
  unwrap(await deleteAccount(userId, await readPassword(req)));
  return { deleted: true };
}

export async function DELETE(req: NextRequest) {
  return handleApiRequest(() => handleDeleteAccount(req));
}
