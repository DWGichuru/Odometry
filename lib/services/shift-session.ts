import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { alertOnFailure } from "@/lib/alert";
import { requireSubscription } from "@/lib/services/access";
import { fail, type ServiceFailure } from "@/lib/services/result";
import { isValidTimeZone, toFloatingTime } from "@/lib/shift-time";
import type { ExtractedShiftFields } from "@/lib/extract-parser";
import { EntrySource } from "@/types/shift";
import type { ShiftSession } from "@/types/shift-session";
import { SessionStatus } from "@/types/shift-session";

export interface EndSessionData {
  id: string;
  startOdometer: number;
  startedAt: string;
  endOdometer: number;
  endedAt: string;
  distanceKm: number;
}

interface SessionRow {
  id: string;
  userId: string;
  startOdometer: number;
  startedAt: Date;
  endOdometer: number | null;
  endedAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

function toShiftSession(row: SessionRow): ShiftSession {
  return {
    id: row.id,
    userId: row.userId,
    startOdometer: row.startOdometer,
    startedAt: row.startedAt.toISOString(),
    endOdometer: row.endOdometer,
    endedAt: row.endedAt?.toISOString() ?? null,
    status: row.status as SessionStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getOpenSession(userId: string): Promise<ShiftSession | null> {
  const open = await prisma.shiftSession.findFirst({
    where: { userId, status: "OPEN" },
  });
  return open ? toShiftSession(open) : null;
}

export async function getCompletedSession(userId: string): Promise<ShiftSession | null> {
  const completed = await prisma.shiftSession.findFirst({
    where: { userId, status: "COMPLETED" },
    orderBy: { endedAt: "desc" },
  });
  return completed ? toShiftSession(completed) : null;
}

export async function startShiftSession(
  userId: string,
  startOdometer: number,
): Promise<{ success: true; data: ShiftSession } | ServiceFailure> {
  const denied = await requireSubscription(userId);
  if (denied) return denied;

  if (typeof startOdometer !== "number" || Number.isNaN(startOdometer) || startOdometer < 0) {
    return fail("VALIDATION_ERROR", "Odometer reading must be 0 or more.");
  }

  const existing = await prisma.shiftSession.findFirst({
    where: { userId, status: { in: ["OPEN", "COMPLETED"] } },
  });
  if (existing?.status === "COMPLETED") {
    return fail("CONFLICT", "Save or discard your last shift first.");
  }
  if (existing) {
    return fail("CONFLICT", "You already have an open shift. End it before starting a new one.");
  }

  const rounded = Math.round(startOdometer * 100) / 100;
  const now = new Date();

  let session;
  try {
    session = await prisma.shiftSession.create({
      data: { userId, startOdometer: rounded, startedAt: now },
    });
  } catch (err) {
    await alertOnFailure("Failed to start shift session", err);
    throw err;
  }

  return { success: true, data: toShiftSession({ ...session, startedAt: now }) };
}

export async function endShiftSession(
  userId: string,
  endOdometer: number,
): Promise<{ success: true; data: EndSessionData } | ServiceFailure> {
  const denied = await requireSubscription(userId);
  if (denied) return denied;

  if (typeof endOdometer !== "number" || Number.isNaN(endOdometer)) {
    return fail("VALIDATION_ERROR", "Odometer reading must be a number.");
  }

  const session = await prisma.shiftSession.findFirst({
    where: { userId, status: "OPEN" },
  });
  if (!session) {
    return fail("NOT_FOUND", "No open shift found. Start a shift first.");
  }

  const rounded = Math.round(endOdometer * 100) / 100;
  if (rounded <= session.startOdometer) {
    return fail("VALIDATION_ERROR", "End odometer must be greater than the start reading.");
  }

  const distanceKm = Math.round((rounded - session.startOdometer) * 100) / 100;
  const now = new Date();

  try {
    await prisma.shiftSession.update({
      where: { id: session.id },
      data: { endOdometer: rounded, endedAt: now, status: "COMPLETED" },
    });
  } catch (err) {
    await alertOnFailure("Failed to end shift session", err);
    throw err;
  }

  return {
    success: true,
    data: {
      id: session.id,
      startOdometer: session.startOdometer,
      startedAt: session.startedAt.toISOString(),
      endOdometer: rounded,
      endedAt: now.toISOString(),
      distanceKm,
    },
  };
}

export async function cancelShiftSession(
  userId: string,
): Promise<{ success: true } | ServiceFailure> {
  const denied = await requireSubscription(userId);
  if (denied) return denied;

  const session = await prisma.shiftSession.findFirst({
    where: { userId, status: "OPEN" },
  });
  if (!session) {
    return fail("NOT_FOUND", "No open shift found to cancel.");
  }

  try {
    await prisma.shiftSession.update({
      where: { id: session.id },
      data: { status: "CANCELLED" },
    });
  } catch (err) {
    await alertOnFailure("Failed to cancel shift session", err);
    throw err;
  }

  return { success: true };
}

/** Drops a completed session without saving it; only a still-COMPLETED session can be discarded. */
export async function discardShiftSession(
  userId: string,
  sessionId: string,
): Promise<{ success: true } | ServiceFailure> {
  const denied = await requireSubscription(userId);
  if (denied) return denied;

  let discarded;
  try {
    discarded = await prisma.shiftSession.updateMany({
      where: { id: sessionId, userId, status: "COMPLETED" },
      data: { status: "CANCELLED" },
    });
  } catch (err) {
    await alertOnFailure("Failed to discard shift session", err);
    throw err;
  }
  if (discarded.count === 1) return { success: true };

  const s = await prisma.shiftSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!s || s.userId !== userId) {
    return fail("NOT_FOUND", "Session not found.");
  }
  return fail("CONFLICT", "Only a finished shift waiting for review can be discarded.");
}

export type SessionShiftFields = Pick<
  ExtractedShiftFields,
  "date" | "platform" | "amountEarned" | "tripsCompleted"
>;

export async function createShiftFromSession(
  userId: string,
  sessionId: string,
  fields: SessionShiftFields,
  timeZone: string,
): Promise<{ success: true; shiftId: string } | ServiceFailure> {
  const denied = await requireSubscription(userId);
  if (denied) return denied;

  if (!isValidTimeZone(timeZone)) {
    return fail("VALIDATION_ERROR", "A valid IANA time zone is required.");
  }

  const s = await prisma.shiftSession.findUnique({ where: { id: sessionId } });

  if (!s || s.userId !== userId) {
    return fail("NOT_FOUND", "Session not found.");
  }
  if (s.status !== "COMPLETED") {
    return fail("CONFLICT", "Session is not completed.");
  }
  if (s.endOdometer === null || s.endedAt === null) {
    return fail("CONFLICT", "Session is missing end data.");
  }

  const distanceKm = Math.round((s.endOdometer - s.startOdometer) * 100) / 100;
  // Every shift reader formats times in UTC, so session instants are stored as the
  // driver's wall-clock time like manual shifts.
  const startTime = toFloatingTime(s.startedAt, timeZone);
  const endTime = toFloatingTime(s.endedAt, timeZone);

  const data: Prisma.ShiftUncheckedCreateInput = {
    userId,
    date: fields.date
      ? new Date(`${fields.date}T00:00:00`)
      : new Date(`${startTime.toISOString().slice(0, 10)}T00:00:00`),
    platform: fields.platform ?? "UBER",
    startTime,
    endTime,
    amountEarned: fields.amountEarned ?? 0,
    tripsCompleted: fields.tripsCompleted ?? 0,
    startOdometer: s.startOdometer,
    endOdometer: s.endOdometer,
    distanceKm,
    entrySource: EntrySource.ODOMETER,
  };

  let shift;
  try {
    // The conditional delete is the real guard: a concurrent second save blocks on
    // the row lock, then deletes nothing and gets CONFLICT instead of a duplicate.
    shift = await prisma.$transaction(async (tx) => {
      const { count } = await tx.shiftSession.deleteMany({
        where: { id: sessionId, userId, status: "COMPLETED" },
      });
      if (count === 0) return null;
      return tx.shift.create({ data });
    });
  } catch (err) {
    await alertOnFailure("Failed to create shift from session", err);
    throw err;
  }

  if (!shift) {
    return fail("CONFLICT", "This shift has already been saved.");
  }
  return { success: true, shiftId: shift.id };
}
