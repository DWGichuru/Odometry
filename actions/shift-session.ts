"use server";

import { auth } from "@/auth";
import * as service from "@/lib/services/shift-session";
import type { EndSessionData } from "@/lib/services/shift-session";
import { toActionResult } from "@/lib/services/result";
import type { ShiftSession } from "@/types/shift-session";

const SIGNED_OUT = { error: "You must be signed in." };

export async function startShiftSession(
  startOdometer: number,
): Promise<{ success: true; data: ShiftSession } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return SIGNED_OUT;
  return toActionResult(await service.startShiftSession(session.user.id, startOdometer));
}

export async function endShiftSession(
  endOdometer: number,
): Promise<{ success: true; data: EndSessionData } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return SIGNED_OUT;
  return toActionResult(await service.endShiftSession(session.user.id, endOdometer));
}

export async function discardShiftSession(
  sessionId: string,
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return SIGNED_OUT;
  return toActionResult(await service.discardShiftSession(session.user.id, sessionId));
}

export async function cancelShiftSession(): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return SIGNED_OUT;
  return toActionResult(await service.cancelShiftSession(session.user.id));
}
