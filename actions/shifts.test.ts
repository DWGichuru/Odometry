import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    shift: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { createShift } from "@/actions/shifts";

function mockAuth(userId: string | null) {
  vi.mocked(auth).mockResolvedValue(userId ? { user: { id: userId } } : null);
}

function mockLifetimeFreeUser(distanceUnit: "KM" | "MI") {
  vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
    status: "active",
    freeTrialEndsAt: new Date(),
    isLifetimeFree: true,
  });
  vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({ distanceUnit });
}

function baseFormData() {
  const fd = new FormData();
  fd.set("date", "2026-01-15");
  fd.set("platform", "UBER");
  fd.set("startTime", "09:00");
  fd.set("endTime", "12:00");
  fd.set("amountEarned", "80");
  fd.set("tripsCompleted", "5");
  fd.set("odoMode", "odometer");
  fd.set("startOdometer", "100");
  fd.set("distance", "");
  fd.set("endOdometer", "150");
  return fd;
}

describe("createShift - distance unit conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores odometer values as-is for a KM user", async () => {
    mockAuth("user-1");
    mockLifetimeFreeUser("KM");
    vi.mocked(mockPrisma.shift.create).mockResolvedValue({});

    await createShift(undefined, baseFormData());

    const call = vi.mocked(mockPrisma.shift.create).mock.calls[0][0];
    expect(call.data.startOdometer).toBe(100);
    expect(call.data.endOdometer).toBe(150);
    expect(call.data.distanceKm).toBe(50);
  });

  it("converts odometer values from miles to canonical km for a MI user", async () => {
    mockAuth("user-1");
    mockLifetimeFreeUser("MI");
    vi.mocked(mockPrisma.shift.create).mockResolvedValue({});

    await createShift(undefined, baseFormData());

    const call = vi.mocked(mockPrisma.shift.create).mock.calls[0][0];
    expect(call.data.startOdometer).toBeCloseTo(160.934, 2);
    expect(call.data.endOdometer).toBeCloseTo(241.401, 2);
    expect(call.data.distanceKm).toBeCloseTo(80.467, 2);
  });
});
