import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
    shiftSession: { findUnique: vi.fn() },
    shift: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/subscription", () => ({
  hasAccess: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { hasAccess } from "@/lib/subscription";
import { createShiftFromSession } from "@/actions/review-shift";
import { EntrySource } from "@/types/shift";

function mockAuth(userId: string | null) {
  vi.mocked(auth).mockResolvedValue(
    userId ? { user: { id: userId } } : null,
  );
}

const baseExtracted = {
  date: "2025-07-11",
  platform: "UBER" as const,
  startTime: null,
  endTime: null,
  amountEarned: 198.4,
  tripsCompleted: 21,
  endOdometer: null,
};

describe("createShiftFromSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAccess).mockReturnValue(true);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "active",
      freeTrialEndsAt: new Date(Date.now() + 86400000),
      isLifetimeFree: false,
    });
  });

  it("creates a shift from completed session data", async () => {
    mockAuth("user-1");

    vi.mocked(mockPrisma.shiftSession.findUnique).mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      startOdometer: 48231,
      startedAt: new Date("2025-07-11T09:41:00Z"),
      endOdometer: 48519,
      endedAt: new Date("2025-07-11T16:07:00Z"),
      status: "COMPLETED",
    });

    vi.mocked(mockPrisma.shift.create).mockResolvedValue({
      id: "shift-1",
    } as never);

    const result = await createShiftFromSession("session-1", baseExtracted);

    expect(result).toEqual({ success: true, shiftId: "shift-1" });
    expect(mockPrisma.shift.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        date: new Date("2025-07-11T00:00:00"),
        platform: "UBER",
        startTime: new Date("2025-07-11T09:41:00Z"),
        endTime: new Date("2025-07-11T16:07:00Z"),
        amountEarned: 198.4,
        tripsCompleted: 21,
        startOdometer: 48231,
        endOdometer: 48519,
        distanceKm: 288,
        entrySource: EntrySource.ODOMETER,
      },
    });
  });

  it("falls back to defaults for missing extracted fields", async () => {
    mockAuth("user-1");

    vi.mocked(mockPrisma.shiftSession.findUnique).mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      startOdometer: 48231,
      startedAt: new Date("2025-07-11T09:41:00Z"),
      endOdometer: 48519,
      endedAt: new Date("2025-07-11T16:07:00Z"),
      status: "COMPLETED",
    });

    vi.mocked(mockPrisma.shift.create).mockResolvedValue({
      id: "shift-2",
    } as never);

    await createShiftFromSession("session-1", {
      ...baseExtracted,
      date: null,
      platform: null,
      amountEarned: null,
      tripsCompleted: null,
    });

    expect(mockPrisma.shift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: "UBER",
          amountEarned: 0,
          tripsCompleted: 0,
        }),
      }),
    );
  });

  it("rejects unauthenticated calls", async () => {
    mockAuth(null);

    const result = await createShiftFromSession("session-1", baseExtracted);

    expect(result).toEqual({ error: "You must be signed in." });
    expect(mockPrisma.shift.create).not.toHaveBeenCalled();
  });

  it("rejects when subscription has expired", async () => {
    mockAuth("user-1");
    vi.mocked(hasAccess).mockReturnValue(false);

    const result = await createShiftFromSession("session-1", baseExtracted);

    expect(result).toEqual({
      error: "Your free trial has ended. Subscribe to continue.",
    });
    expect(mockPrisma.shift.create).not.toHaveBeenCalled();
  });

  it("rejects when session belongs to another user", async () => {
    mockAuth("user-2");

    vi.mocked(mockPrisma.shiftSession.findUnique).mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      startOdometer: 48231,
      startedAt: new Date(),
      endOdometer: 48519,
      endedAt: new Date(),
      status: "COMPLETED",
    });

    const result = await createShiftFromSession("session-1", baseExtracted);

    expect(result).toEqual({ error: "Session not found." });
    expect(mockPrisma.shift.create).not.toHaveBeenCalled();
  });

  it("rejects when session is not COMPLETED", async () => {
    mockAuth("user-1");

    vi.mocked(mockPrisma.shiftSession.findUnique).mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      startOdometer: 48231,
      startedAt: new Date(),
      endOdometer: null,
      endedAt: null,
      status: "OPEN",
    });

    const result = await createShiftFromSession("session-1", baseExtracted);

    expect(result).toEqual({ error: "Session is not completed." });
    expect(mockPrisma.shift.create).not.toHaveBeenCalled();
  });
});
