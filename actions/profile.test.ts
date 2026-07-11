import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { update: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { getProfilePreferences, updateProfilePreferences } from "@/actions/profile";

function mockAuth(userId: string | null) {
  vi.mocked(auth).mockResolvedValue(userId ? { user: { id: userId } } : null);
}

describe("getProfilePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires sign-in", async () => {
    mockAuth(null);
    const result = await getProfilePreferences();
    expect(result).toEqual({ error: "You must be signed in." });
  });

  it("returns the stored preferences", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
      currency: "EUR",
      distanceUnit: "KM",
    });

    const result = await getProfilePreferences();
    expect(result).toEqual({ currency: "EUR", distanceUnit: "KM" });
  });

  it("falls back to USD/MI when the user row is missing", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null);

    const result = await getProfilePreferences();
    expect(result).toEqual({ currency: "USD", distanceUnit: "MI" });
  });
});

describe("updateProfilePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires sign-in", async () => {
    mockAuth(null);
    const result = await updateProfilePreferences("USD", "MI");
    expect(result).toEqual({ error: "You must be signed in." });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an unsupported currency", async () => {
    mockAuth("user-1");
    const result = await updateProfilePreferences("JPY", "MI");
    expect(result).toEqual({ error: "Unsupported currency." });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an unsupported distance unit", async () => {
    mockAuth("user-1");
    const result = await updateProfilePreferences("USD", "YARDS");
    expect(result).toEqual({ error: "Unsupported distance unit." });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("updates both fields on valid input", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.user.update).mockResolvedValue({});

    const result = await updateProfilePreferences("EUR", "KM");

    expect(result).toEqual({ success: true });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { currency: "EUR", distanceUnit: "KM" },
    });
  });
});
