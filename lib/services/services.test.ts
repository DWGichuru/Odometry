import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    shiftSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    shift: { create: vi.fn() },
    insight: { count: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/alert", () => ({ alertOnFailure: vi.fn() }));
vi.mock("@/lib/openai", () => ({
  callOpenAIVision: vi.fn(),
  callOpenAIOdometerVision: vi.fn(),
}));

import {
  cancelShiftSession,
  createShiftFromSession,
  discardShiftSession,
  endShiftSession,
  startShiftSession,
} from "@/lib/services/shift-session";
import { generateTrendInsights } from "@/lib/services/insights";
import {
  extractOdometerFromPhoto,
  extractShiftFromScreenshot,
  readImageFile,
} from "@/lib/services/extraction";
import { callOpenAIOdometerVision, callOpenAIVision } from "@/lib/openai";

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

  it("CONFLICT when a completed session is still waiting to be saved or discarded", async () => {
    mockPrisma.shiftSession.findFirst.mockResolvedValue({ id: "s1", status: "COMPLETED" });
    expect(await startShiftSession("user-1", 100)).toEqual({
      code: "CONFLICT",
      error: "Save or discard your last shift first.",
    });
    expect(mockPrisma.shiftSession.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", status: { in: ["OPEN", "COMPLETED"] } },
    });
    expect(mockPrisma.shiftSession.create).not.toHaveBeenCalled();
  });

  it("takes the per-driver advisory lock before checking for an open session", async () => {
    mockPrisma.shiftSession.findFirst.mockResolvedValue(null);
    mockPrisma.shiftSession.create.mockResolvedValue({
      id: "s1",
      userId: "user-1",
      status: "OPEN",
      startOdometer: 100.13,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(await startShiftSession("user-1", 100.126)).toMatchObject({
      success: true,
      data: { id: "s1" },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const [sql, key] = mockPrisma.$executeRaw.mock.calls[0];
    expect(sql.join("?")).toContain("pg_advisory_xact_lock");
    expect(key).toBe("shift-session:user-1");
    expect(mockPrisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrisma.shiftSession.findFirst.mock.invocationCallOrder[0],
    );
    expect(mockPrisma.shiftSession.create.mock.calls[0][0].data).toMatchObject({
      userId: "user-1",
      startOdometer: 100.13,
    });
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

describe("extractShiftFromScreenshot", () => {
  const screenshot = () => new File([new Uint8Array([1, 2, 3])], "earnings.png", { type: "image/png" });

  it("UNPROCESSABLE when the model reads nothing from the image", async () => {
    vi.mocked(callOpenAIVision).mockResolvedValue(
      JSON.stringify({ date: null, platform: null, startTime: "lunch", tripsCompleted: null }),
    );
    expect(await extractShiftFromScreenshot("user-1", screenshot(), "")).toEqual({
      code: "UNPROCESSABLE",
      error: "Couldn't read that screenshot. Try a clearer one or enter it manually.",
    });
  });

  it("returns the fields when at least one was read", async () => {
    vi.mocked(callOpenAIVision).mockResolvedValue(JSON.stringify({ amountEarned: 42.5 }));
    expect(await extractShiftFromScreenshot("user-1", screenshot(), "100")).toMatchObject({
      success: true,
      data: { amountEarned: 42.5, date: null, startOdometer: "100" },
    });
  });

  it("UPSTREAM_ERROR with a fixed message when the vision call throws", async () => {
    vi.mocked(callOpenAIVision).mockRejectedValue(new Error("OpenAI API error 500: secret body"));
    const result = await extractShiftFromScreenshot("user-1", screenshot(), "");
    expect(result).toEqual({
      code: "UPSTREAM_ERROR",
      error: "Couldn't read that screenshot right now. Try again or enter it manually.",
    });
    expect(JSON.stringify(result)).not.toContain("secret body");
  });
});

describe("extractOdometerFromPhoto", () => {
  it("UPSTREAM_ERROR with a fixed message when the vision call throws", async () => {
    vi.mocked(callOpenAIOdometerVision).mockRejectedValue(new Error("OpenAI API error 500: secret body"));
    const result = await extractOdometerFromPhoto("user-1", "aGVsbG8=");
    expect(result).toEqual({
      code: "UPSTREAM_ERROR",
      error: "Couldn't read the odometer right now. Try again or type it in.",
    });
    expect(JSON.stringify(result)).not.toContain("secret body");
  });
});

describe("discardShiftSession", () => {
  it("cancels a completed session owned by the driver", async () => {
    mockPrisma.shiftSession.updateMany.mockResolvedValue({ count: 1 });
    expect(await discardShiftSession("user-1", "s1")).toEqual({ success: true });
    expect(mockPrisma.shiftSession.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", userId: "user-1", status: "COMPLETED" },
      data: { status: "CANCELLED" },
    });
  });

  it("CONFLICT when the session is no longer completed (already discarded)", async () => {
    mockPrisma.shiftSession.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.shiftSession.findUnique.mockResolvedValue({ userId: "user-1" });
    expect(await discardShiftSession("user-1", "s1")).toMatchObject({ code: "CONFLICT" });
  });

  it("NOT_FOUND for a missing session or another driver's", async () => {
    mockPrisma.shiftSession.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.shiftSession.findUnique.mockResolvedValue(null);
    expect(await discardShiftSession("user-1", "s1")).toMatchObject({ code: "NOT_FOUND" });

    mockPrisma.shiftSession.findUnique.mockResolvedValue({ userId: "someone-else" });
    expect(await discardShiftSession("user-1", "s1")).toEqual({
      code: "NOT_FOUND",
      error: "Session not found.",
    });
  });

  it("SUBSCRIPTION_REQUIRED before touching the session", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(EXPIRED);
    expect(await discardShiftSession("user-1", "s1")).toMatchObject({
      code: "SUBSCRIPTION_REQUIRED",
    });
    expect(mockPrisma.shiftSession.updateMany).not.toHaveBeenCalled();
  });
});
