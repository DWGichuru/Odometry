import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/stripe", () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}));

import { auth } from "@/auth";
import { createCheckoutSession } from "@/lib/stripe";
import { checkoutAction } from "@/actions/billing";

function mockAuth(userId: string | null) {
  vi.mocked(auth).mockResolvedValue(
    userId ? ({ user: { id: userId } } as never) : null,
  );
}

describe("checkoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to sign-in when unauthenticated", async () => {
    mockAuth(null);

    await expect(checkoutAction()).rejects.toThrow("REDIRECT:/sign-in");
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("blocks checkout when the user already has a live subscription", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "trialing",
    });

    await expect(checkoutAction()).rejects.toThrow(
      "REDIRECT:/billing?checkout=already-subscribed",
    );
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("blocks checkout when the live subscription is active", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
    });

    await expect(checkoutAction()).rejects.toThrow(
      "REDIRECT:/billing?checkout=already-subscribed",
    );
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("allows checkout for a trialing user who has never subscribed", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: null,
      status: "trialing",
    });
    vi.mocked(createCheckoutSession).mockResolvedValue({
      url: "https://checkout.stripe.com/session_1",
    } as never);

    await expect(checkoutAction()).rejects.toThrow(
      "REDIRECT:https://checkout.stripe.com/session_1",
    );
    expect(createCheckoutSession).toHaveBeenCalledWith({
      customerId: "cus_1",
      customerEmail: undefined,
    });
  });

  it("allows checkout again once the prior subscription is canceled", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "canceled",
    });
    vi.mocked(createCheckoutSession).mockResolvedValue({
      url: "https://checkout.stripe.com/session_2",
    } as never);

    await expect(checkoutAction()).rejects.toThrow(
      "REDIRECT:https://checkout.stripe.com/session_2",
    );
    expect(createCheckoutSession).toHaveBeenCalled();
  });
});
