import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockCallOpenAIChat } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
    shift: { findMany: vi.fn() },
    insight: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  },
  mockCallOpenAIChat: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/openai")>();
  return { ...actual, callOpenAIChat: mockCallOpenAIChat };
});

import { auth } from "@/auth";
import { generateTrendInsights, getInsightsStatus } from "@/actions/insights";

function mockAuth(userId: string | null) {
  vi.mocked(auth).mockResolvedValue(userId ? { user: { id: userId } } : null);
}

function mockActiveSubscription() {
  vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
    status: "active",
    freeTrialEndsAt: new Date(Date.now() + 86400000),
    isLifetimeFree: false,
  });
}

function makeShifts(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `shift-${i}`,
    date: new Date(`2026-06-${String(i + 1).padStart(2, "0")}`),
    platform: "UBER",
    startTime: new Date(`2026-06-${String(i + 1).padStart(2, "0")}T09:00:00Z`),
    endTime: new Date(`2026-06-${String(i + 1).padStart(2, "0")}T13:00:00Z`),
    amountEarned: 100,
    tripsCompleted: 8,
    startOdometer: 1000 + i * 100,
    endOdometer: 1080 + i * 100,
  }));
}

const VALID_RESPONSE = JSON.stringify({
  bestTimes: "You earn the most on Friday and Saturday evenings.",
  idealShiftLength: "Shifts around 4 hours earn the best per hour.",
  notWorking: "Tuesday mornings consistently earn less than the rest of the week.",
});

describe("generateTrendInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated calls", async () => {
    mockAuth(null);

    const result = await generateTrendInsights();

    expect(result).toEqual({ error: "You must be signed in." });
    expect(mockPrisma.insight.create).not.toHaveBeenCalled();
  });

  it("rejects when the user has no valid subscription", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
      status: "canceled",
      freeTrialEndsAt: new Date(Date.now() - 86400000),
      isLifetimeFree: false,
    });

    const result = await generateTrendInsights();

    expect(result).toEqual({
      error: "Your free trial has ended. Subscribe to continue.",
    });
  });

  it("rejects when the monthly cap is reached", async () => {
    mockAuth("user-1");
    mockActiveSubscription();
    mockPrisma.insight.count.mockResolvedValue(5);

    const result = await generateTrendInsights();

    expect(result).toEqual({
      error: "You've used all 5 insight requests this month. They reset next month.",
    });
    expect(mockPrisma.shift.findMany).not.toHaveBeenCalled();
    expect(mockCallOpenAIChat).not.toHaveBeenCalled();
  });

  it("rejects when the driver has too few shifts", async () => {
    mockAuth("user-1");
    mockActiveSubscription();
    mockPrisma.insight.count.mockResolvedValue(0);
    mockPrisma.shift.findMany.mockResolvedValue(makeShifts(3));

    const result = await generateTrendInsights();

    expect(result).toEqual({
      error: "Log a few more shifts before requesting insights.",
    });
    expect(mockCallOpenAIChat).not.toHaveBeenCalled();
  });

  it("generates and stores an insight on the happy path", async () => {
    mockAuth("user-1");
    mockActiveSubscription();
    mockPrisma.insight.count.mockResolvedValue(2);
    mockPrisma.shift.findMany.mockResolvedValue(makeShifts(5));
    mockCallOpenAIChat.mockResolvedValue(VALID_RESPONSE);

    const now = new Date("2026-07-22T12:00:00Z");
    vi.setSystemTime(now);
    mockPrisma.insight.create.mockResolvedValue({
      id: "insight-1",
      userId: "user-1",
      bestTimes: "You earn the most on Friday and Saturday evenings.",
      idealShiftLength: "Shifts around 4 hours earn the best per hour.",
      notWorking: "Tuesday mornings consistently earn less than the rest of the week.",
      createdAt: now,
    });

    const result = await generateTrendInsights();

    expect(result).toEqual({
      success: true,
      data: {
        bestTimes: "You earn the most on Friday and Saturday evenings.",
        idealShiftLength: "Shifts around 4 hours earn the best per hour.",
        notWorking: "Tuesday mornings consistently earn less than the rest of the week.",
        remaining: 2, // cap 5 - (2 already used + this one)
        createdAt: now.toISOString(),
      },
    });
    expect(mockPrisma.insight.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        bestTimes: "You earn the most on Friday and Saturday evenings.",
        idealShiftLength: "Shifts around 4 hours earn the best per hour.",
        notWorking: "Tuesday mornings consistently earn less than the rest of the week.",
      },
    });

    vi.useRealTimers();
  });

  it("returns a friendly error when the AI call fails", async () => {
    mockAuth("user-1");
    mockActiveSubscription();
    mockPrisma.insight.count.mockResolvedValue(0);
    mockPrisma.shift.findMany.mockResolvedValue(makeShifts(5));
    mockCallOpenAIChat.mockRejectedValue(new Error("OpenAI API error 500"));

    const result = await generateTrendInsights();

    expect(result).toEqual({
      error: "Could not generate insights right now. Try again later.",
    });
    expect(mockPrisma.insight.create).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the AI response fails to parse", async () => {
    mockAuth("user-1");
    mockActiveSubscription();
    mockPrisma.insight.count.mockResolvedValue(0);
    mockPrisma.shift.findMany.mockResolvedValue(makeShifts(5));
    mockCallOpenAIChat.mockResolvedValue("not valid json");

    const result = await generateTrendInsights();

    expect(result).toEqual({
      error: "Could not generate insights right now. Try again later.",
    });
    expect(mockPrisma.insight.create).not.toHaveBeenCalled();
  });
});

describe("getInsightsStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated calls", async () => {
    mockAuth(null);

    const result = await getInsightsStatus();

    expect(result).toEqual({ error: "You must be signed in." });
  });

  it("returns remaining=5 and latest=null when no insights exist yet", async () => {
    mockAuth("user-1");
    mockActiveSubscription();
    mockPrisma.insight.count.mockResolvedValue(0);
    mockPrisma.insight.findFirst.mockResolvedValue(null);

    const result = await getInsightsStatus();

    expect(result).toEqual({
      success: true,
      data: { remaining: 5, latest: null },
    });
  });

  it("returns the remaining quota and the most recent insight", async () => {
    mockAuth("user-1");
    mockActiveSubscription();
    mockPrisma.insight.count.mockResolvedValue(2);
    const createdAt = new Date("2026-07-20T10:00:00Z");
    mockPrisma.insight.findFirst.mockResolvedValue({
      id: "insight-1",
      userId: "user-1",
      bestTimes: "Best on weekends.",
      idealShiftLength: "4 hours.",
      notWorking: "Mondays underperform.",
      createdAt,
    });

    const result = await getInsightsStatus();

    expect(result).toEqual({
      success: true,
      data: {
        remaining: 3,
        latest: {
          bestTimes: "Best on weekends.",
          idealShiftLength: "4 hours.",
          notWorking: "Mondays underperform.",
          remaining: 3,
          createdAt: createdAt.toISOString(),
        },
      },
    });
  });

  it("floors remaining at 0 when the cap has been reached", async () => {
    mockAuth("user-1");
    mockActiveSubscription();
    mockPrisma.insight.count.mockResolvedValue(5);
    mockPrisma.insight.findFirst.mockResolvedValue(null);

    const result = await getInsightsStatus();

    expect(result).toEqual({
      success: true,
      data: { remaining: 0, latest: null },
    });
  });
});
