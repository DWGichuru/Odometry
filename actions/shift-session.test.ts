import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
    shiftSession: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
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
import { startShiftSession, endShiftSession, cancelShiftSession } from "@/actions/shift-session";
import { SessionStatus } from "@/types/shift-session";

function mockAuth(userId: string | null) {
  vi.mocked(auth).mockResolvedValue(
    userId ? { user: { id: userId } } : null,
  );
}

function mockSubscription(valid: boolean) {
  vi.mocked(hasAccess).mockReturnValue(valid);
}

function mockNoOpenSession() {
  vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue(null);
}

function mockExistingOpenSession() {
  vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue({
    id: "existing-session",
    userId: "user-1",
    startOdometer: 45000,
    startedAt: new Date(),
    status: "OPEN",
  });
}

describe("startShiftSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "active",
      freeTrialEndsAt: new Date(Date.now() + 86400000),
      isLifetimeFree: false,
    });
  });

  it("creates a session for a valid odometer reading", async () => {
    mockAuth("user-1");
    mockSubscription(true);
    mockNoOpenSession();

    const now = new Date("2025-07-08T09:00:00Z");
    vi.setSystemTime(now);
    const prismaResult = {
      id: "session-1",
      userId: "user-1",
      startOdometer: 45128,
      startedAt: now,
      endOdometer: null,
      endedAt: null,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    };
    vi.mocked(mockPrisma.shiftSession.create).mockResolvedValue(prismaResult);

    const result = await startShiftSession(45128);

    expect(result).toEqual({
      success: true,
      data: {
        id: "session-1",
        userId: "user-1",
        startOdometer: 45128,
        startedAt: now.toISOString(),
        endOdometer: null,
        endedAt: null,
        status: SessionStatus.OPEN,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
    expect(mockPrisma.shiftSession.create).toHaveBeenCalledWith({
      data: { userId: "user-1", startOdometer: 45128, startedAt: now },
    });

    vi.useRealTimers();
  });

  it("rounds odometer to 2 decimal places", async () => {
    mockAuth("user-1");
    mockSubscription(true);
    mockNoOpenSession();

    const now = new Date("2025-07-08T09:00:00Z");
    vi.setSystemTime(now);
    vi.mocked(mockPrisma.shiftSession.create).mockResolvedValue({
      id: "s",
      userId: "u",
      startOdometer: 45128.46,
      startedAt: now,
      endOdometer: null,
      endedAt: null,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    });

    await startShiftSession(45128.456);

    expect(mockPrisma.shiftSession.create).toHaveBeenCalledWith({
      data: { userId: "user-1", startOdometer: 45128.46, startedAt: now },
    });

    vi.useRealTimers();
  });

  it("accepts zero as a valid odometer reading", async () => {
    mockAuth("user-1");
    mockSubscription(true);
    mockNoOpenSession();

    const now = new Date();
    vi.mocked(mockPrisma.shiftSession.create).mockResolvedValue({
      id: "s",
      userId: "u",
      startOdometer: 0,
      startedAt: now,
      endOdometer: null,
      endedAt: null,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    });

    const result = await startShiftSession(0);

    expect(result.success).toBe(true);
  });

  it("rejects a negative odometer reading", async () => {
    mockAuth("user-1");
    mockSubscription(true);

    const result = await startShiftSession(-1);

    expect(result).toEqual({ error: "Odometer reading must be 0 or more." });
    expect(mockPrisma.shiftSession.create).not.toHaveBeenCalled();
  });

  it("rejects NaN as an odometer reading", async () => {
    mockAuth("user-1");
    mockSubscription(true);

    const result = await startShiftSession(NaN);

    expect(result).toEqual({ error: "Odometer reading must be 0 or more." });
    expect(mockPrisma.shiftSession.create).not.toHaveBeenCalled();
  });

  it("rejects when the user already has an OPEN session", async () => {
    mockAuth("user-1");
    mockSubscription(true);
    mockExistingOpenSession();

    const result = await startShiftSession(46000);

    expect(result).toEqual({
      error: "You already have an open shift. End it before starting a new one.",
    });
    expect(mockPrisma.shiftSession.create).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated calls", async () => {
    mockAuth(null);

    const result = await startShiftSession(45000);

    expect(result).toEqual({ error: "You must be signed in." });
    expect(mockPrisma.shiftSession.create).not.toHaveBeenCalled();
  });

  it("rejects when the user has no valid subscription", async () => {
    mockAuth("user-1");
    mockSubscription(false);

    const result = await startShiftSession(45000);

    expect(result).toEqual({
      error: "Your free trial has ended. Subscribe to continue.",
    });
    expect(mockPrisma.shiftSession.create).not.toHaveBeenCalled();
  });
});

describe("endShiftSession", () => {
  const startTime = new Date("2025-07-08T09:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "active",
      freeTrialEndsAt: new Date(Date.now() + 86400000),
      isLifetimeFree: false,
    });
  });

  it("ends an OPEN session with a valid end odometer and returns computed distance", async () => {
    mockAuth("user-1");
    mockSubscription(true);

    vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue({
      id: "session-open",
      userId: "user-1",
      startOdometer: 45000,
      startedAt: startTime,
      status: "OPEN",
    });

    const endTime = new Date("2025-07-08T17:00:00Z");
    vi.setSystemTime(endTime);

    const result = await endShiftSession(45128);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");

    expect(result.data.startOdometer).toBe(45000);
    expect(result.data.startedAt).toBe(startTime.toISOString());
    expect(result.data.endOdometer).toBe(45128);
    expect(result.data.endedAt).toBe(endTime.toISOString());
    expect(result.data.distanceKm).toBe(128);

    expect(mockPrisma.shiftSession.update).toHaveBeenCalledWith({
      where: { id: "session-open" },
      data: {
        endOdometer: 45128,
        endedAt: endTime,
        status: "COMPLETED",
      },
    });

    vi.useRealTimers();
  });

  it("rejects when end odometer is equal to start", async () => {
    mockAuth("user-1");
    mockSubscription(true);

    vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue({
      id: "session-open",
      userId: "user-1",
      startOdometer: 45000,
      startedAt: startTime,
      status: "OPEN",
    });

    const result = await endShiftSession(45000);

    expect(result).toEqual({
      error: "End odometer must be greater than the start reading.",
    });
    expect(mockPrisma.shiftSession.update).not.toHaveBeenCalled();
  });

  it("rejects when end odometer is less than start", async () => {
    mockAuth("user-1");
    mockSubscription(true);

    vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue({
      id: "session-open",
      userId: "user-1",
      startOdometer: 45000,
      startedAt: startTime,
      status: "OPEN",
    });

    const result = await endShiftSession(44999);

    expect(result).toEqual({
      error: "End odometer must be greater than the start reading.",
    });
    expect(mockPrisma.shiftSession.update).not.toHaveBeenCalled();
  });

  it("rejects when no OPEN session exists", async () => {
    mockAuth("user-1");
    mockSubscription(true);
    vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue(null);

    const result = await endShiftSession(46000);

    expect(result).toEqual({
      error: "No open shift found. Start a shift first.",
    });
    expect(mockPrisma.shiftSession.update).not.toHaveBeenCalled();
  });

  it("rounds end odometer and distance to 2 decimal places", async () => {
    mockAuth("user-1");
    mockSubscription(true);

    vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue({
      id: "session-open",
      userId: "user-1",
      startOdometer: 45000.123,
      startedAt: startTime,
      status: "OPEN",
    });

    const result = await endShiftSession(45128.789);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");

    expect(result.data.endOdometer).toBe(45128.79);
    expect(result.data.distanceKm).toBe(128.67);

    vi.useRealTimers();
  });

  it("rejects unauthenticated calls", async () => {
    mockAuth(null);

    const result = await endShiftSession(46000);

    expect(result).toEqual({ error: "You must be signed in." });
    expect(mockPrisma.shiftSession.update).not.toHaveBeenCalled();
  });
});

describe("cancelShiftSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: "active",
      freeTrialEndsAt: new Date(Date.now() + 86400000),
      isLifetimeFree: false,
    });
  });

  it("cancels an OPEN session", async () => {
    mockAuth("user-1");
    mockSubscription(true);

    vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue({
      id: "session-open",
      userId: "user-1",
      startOdometer: 45000,
      startedAt: new Date(),
      status: "OPEN",
    });

    const result = await cancelShiftSession();

    expect(result).toEqual({ success: true });
    expect(mockPrisma.shiftSession.update).toHaveBeenCalledWith({
      where: { id: "session-open" },
      data: { status: "CANCELLED" },
    });
  });

  it("rejects when no OPEN session exists", async () => {
    mockAuth("user-1");
    mockSubscription(true);
    vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue(null);

    const result = await cancelShiftSession();

    expect(result).toEqual({
      error: "No open shift found to cancel.",
    });
    expect(mockPrisma.shiftSession.update).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated calls", async () => {
    mockAuth(null);

    const result = await cancelShiftSession();

    expect(result).toEqual({ error: "You must be signed in." });
    expect(mockPrisma.shiftSession.update).not.toHaveBeenCalled();
  });
});
