import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
    shiftSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    shift: { create: vi.fn() },
    insight: { count: vi.fn() },
    $transaction: vi.fn(),
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
const TZ = "America/Los_Angeles";

const COMPLETED_SESSION = {
  id: "s1",
  userId: "user-1",
  status: "COMPLETED",
  startOdometer: 100,
  startedAt: new Date("2026-10-30T17:00:00Z"),
  endOdometer: 150,
  endedAt: new Date("2026-10-30T21:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.subscription.findUnique.mockResolvedValue(ACTIVE);
  mockPrisma.$transaction.mockImplementation((run: (tx: typeof mockPrisma) => unknown) => run(mockPrisma));
});

describe("createShiftFromSession", () => {
  beforeEach(() => {
    mockPrisma.shiftSession.findUnique.mockResolvedValue(COMPLETED_SESSION);
  });

  it("deletes the session and creates exactly one shift", async () => {
    mockPrisma.shiftSession.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.shift.create.mockResolvedValue({ id: "shift-1" });

    expect(await createShiftFromSession("user-1", "s1", NO_FIELDS, TZ)).toEqual({
      success: true,
      shiftId: "shift-1",
    });
    expect(mockPrisma.shiftSession.deleteMany).toHaveBeenCalledWith({
      where: { id: "s1", userId: "user-1", status: "COMPLETED" },
    });
    expect(mockPrisma.shift.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.shift.create.mock.calls[0][0].data).toMatchObject({
      startTime: new Date("2026-10-30T10:00:00Z"),
      endTime: new Date("2026-10-30T14:00:00Z"),
      distanceKm: 50,
      entrySource: "ODOMETER",
    });
  });

  it("defaults the date to the local start day, not the UTC day", async () => {
    mockPrisma.shiftSession.findUnique.mockResolvedValue({
      ...COMPLETED_SESSION,
      startedAt: new Date("2026-10-31T01:00:00Z"), // 6:00 PM PDT on Oct 30
      endedAt: new Date("2026-10-31T05:00:00Z"),
    });
    mockPrisma.shiftSession.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.shift.create.mockResolvedValue({ id: "shift-1" });

    await createShiftFromSession("user-1", "s1", NO_FIELDS, TZ);
    const { data } = mockPrisma.shift.create.mock.calls[0][0];
    expect(data.date).toEqual(new Date("2026-10-30T00:00:00"));
    expect(data.startTime).toEqual(new Date("2026-10-30T18:00:00Z"));
    expect(data.endTime).toEqual(new Date("2026-10-30T22:00:00Z"));
  });

  it("VALIDATION_ERROR for an invalid time zone, without saving", async () => {
    expect(await createShiftFromSession("user-1", "s1", NO_FIELDS, "Mars/Olympus")).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(mockPrisma.shiftSession.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.shift.create).not.toHaveBeenCalled();
  });

  it("alerts and rethrows when the shift create fails", async () => {
    const { alertOnFailure } = await import("@/lib/alert");
    mockPrisma.shiftSession.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.shift.create.mockRejectedValue(new Error("db down"));

    await expect(createShiftFromSession("user-1", "s1", NO_FIELDS, TZ)).rejects.toThrow("db down");
    expect(alertOnFailure).toHaveBeenCalledWith("Failed to create shift from session", expect.any(Error));
  });
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
    expect(await createShiftFromSession("user-1", "s1", NO_FIELDS, TZ)).toEqual({
      code: "NOT_FOUND",
      error: "Session not found.",
    });
  });

  it("CONFLICT when saving a session that is still open", async () => {
    mockPrisma.shiftSession.findUnique.mockResolvedValue({ id: "s1", userId: "user-1", status: "OPEN" });
    expect(await createShiftFromSession("user-1", "s1", NO_FIELDS, TZ)).toMatchObject({ code: "CONFLICT" });
  });

  it("CONFLICT when the session was already saved, without creating a second shift", async () => {
    mockPrisma.shiftSession.findUnique.mockResolvedValue(COMPLETED_SESSION);
    mockPrisma.shiftSession.deleteMany.mockResolvedValue({ count: 0 });
    expect(await createShiftFromSession("user-1", "s1", NO_FIELDS, TZ)).toMatchObject({ code: "CONFLICT" });
    expect(mockPrisma.shift.create).not.toHaveBeenCalled();
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
