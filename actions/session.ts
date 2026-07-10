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
