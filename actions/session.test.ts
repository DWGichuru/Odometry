import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    shiftSession: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { getOpenSession } from "@/actions/session";
import { SessionStatus } from "@/types/shift-session";

function mockAuth(userId: string | null) {
  vi.mocked(auth).mockResolvedValue(
    userId ? { user: { id: userId } } : null,
  );
}

describe("getOpenSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the session when an OPEN session exists", async () => {
    mockAuth("user-1");

    const now = new Date();
    vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue({
      id: "session-open",
      userId: "user-1",
      startOdometer: 45128,
      startedAt: now,
      endOdometer: null,
      endedAt: null,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    });

    const result = await getOpenSession();

    expect(result).toEqual({
      session: {
        id: "session-open",
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
    expect(mockPrisma.shiftSession.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "OPEN" },
    });
  });

  it("returns null session when no OPEN session exists", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.shiftSession.findFirst).mockResolvedValue(null);

    const result = await getOpenSession();

    expect(result).toEqual({ session: null });
  });

  it("returns error when unauthenticated", async () => {
    mockAuth(null);

    const result = await getOpenSession();

    expect(result).toEqual({ error: "You must be signed in." });
    expect(mockPrisma.shiftSession.findFirst).not.toHaveBeenCalled();
  });
});
