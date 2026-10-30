"use server";

import { auth } from "@/auth";
import * as service from "@/lib/services/shift-session";
import type { ShiftSession } from "@/types/shift-session";

export async function getOpenSession(): Promise<
  { session: ShiftSession | null } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }
  return { session: await service.getOpenSession(session.user.id) };
}

export async function getCompletedSession(): Promise<
  { session: ShiftSession | null } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }
  return { session: await service.getCompletedSession(session.user.id) };
}
