import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockCallOpenAIOdometerVision } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    shift: { findFirst: vi.fn() },
  },
  mockCallOpenAIOdometerVision: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/openai", () => ({
  callOpenAIOdometerVision: mockCallOpenAIOdometerVision,
}));

import { auth } from "@/auth";
import { extractOdometerFromPhoto } from "@/actions/odometer-extract";

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
  vi.mocked(mockPrisma.shift.findFirst).mockResolvedValue(null);
}

describe("extractOdometerFromPhoto - unit conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts a photo-detected mi reading to canonical km, ignoring the user's KM preference", async () => {
    mockAuth("user-1");
    mockLifetimeFreeUser("KM");
    mockCallOpenAIOdometerVision.mockResolvedValue(
      JSON.stringify({ reading: 100000, unit: "mi" }),
    );

    const result = await extractOdometerFromPhoto("base64data");

    expect("success" in result).toBe(true);
    if ("success" in result) {
      expect(result.data.reading).toBeCloseTo(160934, 0);
      expect(result.data.distanceUnit).toBe("KM");
    }
  });

  it("falls back to the user's stored preference when the photo unit is undetected", async () => {
    mockAuth("user-1");
    mockLifetimeFreeUser("MI");
    mockCallOpenAIOdometerVision.mockResolvedValue(
      JSON.stringify({ reading: 50000, unit: null }),
    );

    const result = await extractOdometerFromPhoto("base64data");

    expect("success" in result).toBe(true);
    if ("success" in result) {
      // MI fallback -> converted to km
      expect(result.data.reading).toBeCloseTo(80467, 0);
    }
  });

  it("passes a km-detected reading through unchanged", async () => {
    mockAuth("user-1");
    mockLifetimeFreeUser("MI");
    mockCallOpenAIOdometerVision.mockResolvedValue(
      JSON.stringify({ reading: 48231, unit: "km" }),
    );

    const result = await extractOdometerFromPhoto("base64data");

    expect("success" in result).toBe(true);
    if ("success" in result) {
      expect(result.data.reading).toBe(48231);
    }
  });
});
