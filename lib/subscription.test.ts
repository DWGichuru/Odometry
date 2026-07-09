import { describe, expect, it } from "vitest";
import { hasAccess } from "@/lib/subscription";

function sub(overrides: Partial<{
  status: string;
  freeTrialEndsAt: Date;
  isLifetimeFree: boolean;
}> = {}) {
  return {
    status: "trialing",
    freeTrialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isLifetimeFree: false,
    ...overrides,
  };
}

describe("hasAccess", () => {
  it("returns true for lifetime free users", () => {
    expect(hasAccess(sub({ isLifetimeFree: true, status: "canceled" }))).toBe(
      true,
    );
  });

  it("returns true for active subscriptions", () => {
    expect(
      hasAccess(
        sub({
          status: "active",
          freeTrialEndsAt: new Date(Date.now() - 1000),
        }),
      ),
    ).toBe(true);
  });

  it("returns true for trialing subscriptions", () => {
    expect(
      hasAccess(
        sub({
          status: "trialing",
          freeTrialEndsAt: new Date(Date.now() - 1000),
        }),
      ),
    ).toBe(true);
  });

  it("returns true when trial has not expired (even if status is not trialing)", () => {
    expect(
      hasAccess(
        sub({
          status: "canceled",
          freeTrialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }),
      ),
    ).toBe(true);
  });

  it("returns false when trial has expired and status is not active/trialing", () => {
    expect(
      hasAccess(
        sub({
          status: "canceled",
          freeTrialEndsAt: new Date(Date.now() - 1000),
        }),
      ),
    ).toBe(false);
  });

  it("returns false for null subscription", () => {
    expect(hasAccess(null)).toBe(false);
  });

  it("returns false for past_due status with expired trial", () => {
    expect(
      hasAccess(
        sub({
          status: "past_due",
          freeTrialEndsAt: new Date(Date.now() - 1000),
        }),
      ),
    ).toBe(false);
  });
});
