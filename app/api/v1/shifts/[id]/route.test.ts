import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    shift: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("@/lib/alert", () => ({
  alertOnFailure: vi.fn(),
}));

import { PATCH } from "@/app/api/v1/shifts/[id]/route";
import { KM_PER_MILE } from "@/lib/units";

const existing = {
  id: "shift-1",
  userId: "user-1",
  date: new Date("2026-10-30T00:00:00.000Z"),
  platform: "UBER",
  startTime: new Date("2026-10-30T17:00:42.123Z"),
  endTime: new Date("2026-10-30T21:30:00.000Z"),
  amountEarned: 120,
  tripsCompleted: 8,
  startOdometer: 1000,
  endOdometer: 1080.5,
  distanceKm: 80.5,
  entrySource: "ODOMETER",
  createdAt: new Date("2026-10-30T22:00:00.000Z"),
  updatedAt: new Date("2026-10-30T22:00:00.000Z"),
};

function patch(body: Record<string, unknown>) {
  const req = new NextRequest("http://localhost/api/v1/shifts/shift-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: "shift-1" }) });
}

function updateData() {
  return vi.mocked(mockPrisma.shift.update).mock.calls[0][0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mockPrisma.shift.findUnique).mockResolvedValue(existing);
  vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
    status: "active",
    freeTrialEndsAt: new Date(),
    isLifetimeFree: true,
  });
  vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({ distanceUnit: "MI" });
  vi.mocked(mockPrisma.shift.update).mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ ...existing, ...data }),
  );
});

describe("PATCH /api/v1/shifts/{id} - partial body", () => {
  it("leaves times and odometer unchanged for a MI amount-only update", async () => {
    const res = await patch({ amountEarned: 50 });

    expect(res.status).toBe(200);
    const data = updateData();
    expect(data.amountEarned).toBe(50);
    expect(data.startTime).toBe(existing.startTime);
    expect(data.endTime).toBe(existing.endTime);
    expect(data.startOdometer).toBe(1000);
    expect(data.endOdometer).toBe(1080.5);
    expect(data.distanceKm).toBe(80.5);
  });

  it("keeps the stored start time when only endTime is sent", async () => {
    const res = await patch({ endTime: "23:00" });

    expect(res.status).toBe(200);
    const data = updateData();
    expect(data.startTime.toISOString()).toBe("2026-10-30T17:00:00.000Z");
    expect(data.endTime.toISOString()).toBe("2026-10-30T23:00:00.000Z");
  });
});

describe("PATCH /api/v1/shifts/{id} - full body", () => {
  it("rebuilds every field and converts MI odometer values", async () => {
    const res = await patch({
      date: "2026-10-29",
      platform: "LYFT",
      startTime: "08:00",
      endTime: "12:15",
      amountEarned: 99.5,
      tripsCompleted: 6,
      odoMode: "odometer",
      startOdometer: 600,
      endOdometer: 650,
    });

    expect(res.status).toBe(200);
    const data = updateData();
    expect(data.platform).toBe("LYFT");
    expect(data.startTime.toISOString()).toBe("2026-10-29T08:00:00.000Z");
    expect(data.endTime.toISOString()).toBe("2026-10-29T12:15:00.000Z");
    expect(data.amountEarned).toBe(99.5);
    expect(data.tripsCompleted).toBe(6);
    expect(data.startOdometer).toBeCloseTo(600 * KM_PER_MILE, 2);
    expect(data.endOdometer).toBeCloseTo(650 * KM_PER_MILE, 6);
    expect(data.distanceKm).toBeCloseTo(50 * KM_PER_MILE, 2);
  });
});

describe("PATCH /api/v1/shifts/{id} - guards", () => {
  it("returns 404 for another user's shift", async () => {
    vi.mocked(mockPrisma.shift.findUnique).mockResolvedValue({
      ...existing,
      userId: "someone-else",
    });

    const res = await patch({ amountEarned: 50 });

    expect(res.status).toBe(404);
    expect(mockPrisma.shift.update).not.toHaveBeenCalled();
  });
});
