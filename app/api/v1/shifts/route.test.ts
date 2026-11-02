import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    shift: { create: vi.fn(), findUnique: vi.fn() },
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

import { POST } from "@/app/api/v1/shifts/route";
import { Prisma } from "@/generated/prisma/client";

const SHIFT_ID = "6f1c2e0a-8b3d-4c5e-9f7a-1b2c3d4e5f60";
let rows: Map<string, { id: string; userId: string }>;

const validBody = {
  date: "2026-10-30",
  platform: "UBER",
  startTime: "17:00",
  endTime: "21:30",
  amountEarned: 120,
  tripsCompleted: 8,
  startOdometer: 1000,
  endOdometer: 1080,
};

function post(body: Record<string, unknown>) {
  const req = new NextRequest("http://localhost/api/v1/shifts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  rows = new Map();
  vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
    status: "active",
    freeTrialEndsAt: new Date(),
    isLifetimeFree: false,
  });
  vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({ distanceUnit: "KM" });
  vi.mocked(mockPrisma.shift.create).mockImplementation(
    async ({ data }: { data: { id: string; userId: string } }) => {
      rows.set(data.id, { id: data.id, userId: data.userId });
      return { id: data.id };
    },
  );
  vi.mocked(mockPrisma.shift.findUnique).mockImplementation(
    async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
  );
});

describe("POST /api/v1/shifts - input formats", () => {
  it("creates a shift from a valid body", async () => {
    const res = await post(validBody);

    expect(res.status).toBe(201);
    expect(mockPrisma.shift.create).toHaveBeenCalledOnce();
  });

  it.each([
    ["an unknown platform", { platform: "TAXI" }],
    ["a non-ISO date", { date: "10/30/2026" }],
    ["an impossible date", { date: "2026-02-30" }],
    ["a 12-hour start time", { startTime: "5pm" }],
  ])("returns 400 for %s", async (_label, overrides) => {
    const res = await post({ ...validBody, ...overrides });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(mockPrisma.shift.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/shifts - client id for safe retries", () => {
  it("returns the same shiftId for a repeated request and creates one row", async () => {
    const first = await post({ ...validBody, id: SHIFT_ID });
    const second = await post({ ...validBody, id: SHIFT_ID });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await first.json()).data).toEqual({ shiftId: SHIFT_ID });
    expect((await second.json()).data).toEqual({ shiftId: SHIFT_ID });
    expect(mockPrisma.shift.create).toHaveBeenCalledOnce();
    expect(rows.size).toBe(1);
  });

  it.each([["a non-UUID string", "shift-1"], ["a number", 42]])(
    "returns 400 for %s",
    async (_label, id) => {
      const res = await post({ ...validBody, id });

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: "VALIDATION_ERROR" });
      expect(mockPrisma.shift.create).not.toHaveBeenCalled();
    },
  );

  it("returns 409 when the id belongs to another driver", async () => {
    rows.set(SHIFT_ID, { id: SHIFT_ID, userId: "someone-else" });

    const res = await post({ ...validBody, id: SHIFT_ID });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ success: false, code: "CONFLICT" });
    expect(mockPrisma.shift.create).not.toHaveBeenCalled();
  });

  it("resolves a racing duplicate (P2002) to the shift the other request created", async () => {
    vi.mocked(mockPrisma.shift.create).mockImplementationOnce(async () => {
      rows.set(SHIFT_ID, { id: SHIFT_ID, userId: "user-1" });
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      });
    });

    const res = await post({ ...validBody, id: SHIFT_ID });

    expect(res.status).toBe(201);
    expect((await res.json()).data).toEqual({ shiftId: SHIFT_ID });
  });

  it("keeps generating its own id when none is sent", async () => {
    const res = await post(validBody);

    expect(res.status).toBe(201);
    expect(mockPrisma.shift.findUnique).not.toHaveBeenCalled();
  });
});
