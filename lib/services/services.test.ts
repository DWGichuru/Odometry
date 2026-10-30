import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
    shiftSession: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    insight: { count: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/alert", () => ({ alertOnFailure: vi.fn() }));

import {
  cancelShiftSession,
  createShiftFromSession,
  endShiftSession,
  startShiftSession,
} from "@/lib/services/shift-session";
import { generateTrendInsights } from "@/lib/services/insights";
import { readImageFile } from "@/lib/services/extraction";

const ACTIVE = { status: "active", freeTrialEndsAt: new Date(0), isLifetimeFree: false };
const EXPIRED = { status: "canceled", freeTrialEndsAt: new Date(0), isLifetimeFree: false };
const NO_FIELDS = { date: null, platform: null, amountEarned: null, tripsCompleted: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.subscription.findUnique.mockResolvedValue(ACTIVE);
});

describe("service error codes", () => {
  it("SUBSCRIPTION_REQUIRED when the trial has ended, before touching sessions", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(EXPIRED);
    expect(await startShiftSession("user-1", 100)).toMatchObject({ code: "SUBSCRIPTION_REQUIRED" });
    expect(mockPrisma.shiftSession.findFirst).not.toHaveBeenCalled();
  });

  it("CONFLICT when a session is already open", async () => {
    mockPrisma.shiftSession.findFirst.mockResolvedValue({ id: "s1" });
    expect(await startShiftSession("user-1", 100)).toMatchObject({ code: "CONFLICT" });
  });

  it("VALIDATION_ERROR for a negative start reading", async () => {
    expect(await startShiftSession("user-1", -1)).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("NOT_FOUND when ending or cancelling with no open session", async () => {
    mockPrisma.shiftSession.findFirst.mockResolvedValue(null);
    expect(await endShiftSession("user-1", 200)).toMatchObject({ code: "NOT_FOUND" });
    expect(await cancelShiftSession("user-1")).toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns the session id when ending, so the client can save the shift", async () => {
    mockPrisma.shiftSession.findFirst.mockResolvedValue({
      id: "s1",
      startOdometer: 100,
      startedAt: new Date("2026-10-29T09:00:00Z"),
    });
    const result = await endShiftSession("user-1", 150);
    expect(result).toMatchObject({ success: true, data: { id: "s1", distanceKm: 50 } });
  });

  it("NOT_FOUND for another driver's session, without revealing it exists", async () => {
    mockPrisma.shiftSession.findUnique.mockResolvedValue({ id: "s1", userId: "someone-else" });
    expect(await createShiftFromSession("user-1", "s1", NO_FIELDS)).toEqual({
      code: "NOT_FOUND",
      error: "Session not found.",
    });
  });

  it("CONFLICT when saving a session that is still open", async () => {
    mockPrisma.shiftSession.findUnique.mockResolvedValue({ id: "s1", userId: "user-1", status: "OPEN" });
    expect(await createShiftFromSession("user-1", "s1", NO_FIELDS)).toMatchObject({ code: "CONFLICT" });
  });

  it("RATE_LIMITED once the monthly insight cap is used", async () => {
    mockPrisma.insight.count.mockResolvedValue(5);
    expect(await generateTrendInsights("user-1")).toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("readImageFile", () => {
  it("returns base64 for an image", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "odo.jpg", { type: "image/jpeg" });
    expect(await readImageFile(file)).toEqual({ base64: "AQID" });
  });

  it.each([
    ["no file", null, "No file provided."],
    ["a string field", "abc", "No file provided."],
    ["an empty file", new File([], "x.jpg", { type: "image/jpeg" }), "File is empty."],
    ["a non-image", new File(["x"], "x.pdf", { type: "application/pdf" }), "File must be an image."],
  ])("rejects %s", async (_label, file, error) => {
    expect(await readImageFile(file)).toEqual({ code: "VALIDATION_ERROR", error });
  });
});
