"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ShiftSession } from "@/types/shift-session";

export async function getOpenSession(): Promise<
  { session: ShiftSession | null } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const open = await prisma.shiftSession.findFirst({
    where: { userId: session.user.id, status: "OPEN" },
  });

  if (!open) {
    return { session: null };
  }

  return {
    session: {
      id: open.id,
      userId: open.userId,
      startOdometer: open.startOdometer,
      startedAt: open.startedAt.toISOString(),
      endOdometer: open.endOdometer,
      endedAt: open.endedAt?.toISOString() ?? null,
      status: open.status as unknown as ShiftSession["status"],
      createdAt: open.createdAt.toISOString(),
      updatedAt: open.updatedAt.toISOString(),
    },
  };
}

export async function getCompletedSession(): Promise<
  { session: ShiftSession | null } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const completed = await prisma.shiftSession.findFirst({
    where: { userId: session.user.id, status: "COMPLETED" },
    orderBy: { endedAt: "desc" },
  });

  if (!completed) {
    return { session: null };
  }

  return {
    session: {
      id: completed.id,
      userId: completed.userId,
      startOdometer: completed.startOdometer,
      startedAt: completed.startedAt.toISOString(),
      endOdometer: completed.endOdometer,
      endedAt: completed.endedAt?.toISOString() ?? null,
      status: completed.status as unknown as ShiftSession["status"],
      createdAt: completed.createdAt.toISOString(),
      updatedAt: completed.updatedAt.toISOString(),
    },
  };
}
