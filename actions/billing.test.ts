import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findUnique: vi.fn(), update: vi.fn() },
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
  customerExists: vi.fn(),
  createCustomer: vi.fn(),
}));

import { auth } from "@/auth";
import { createCheckoutSession, createCustomer, customerExists } from "@/lib/stripe";
import { checkoutAction } from "@/actions/billing";

function mockAuth(userId: string | null) {
  vi.mocked(auth).mockResolvedValue(
    userId
      ? ({ user: { id: userId, email: "driver@example.com", name: "Driver" } } as never)
      : null,
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

  it("allows checkout for a trialing user with a valid stored customer id", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: null,
      status: "trialing",
    });
    vi.mocked(customerExists).mockResolvedValue(true);
    vi.mocked(createCheckoutSession).mockResolvedValue({
      url: "https://checkout.stripe.com/session_1",
    } as never);

    await expect(checkoutAction()).rejects.toThrow(
      "REDIRECT:https://checkout.stripe.com/session_1",
    );
    expect(createCustomer).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(createCheckoutSession).toHaveBeenCalledWith({ customerId: "cus_1" });
  });

  it("allows checkout again once the prior subscription is canceled", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "canceled",
    });
    vi.mocked(customerExists).mockResolvedValue(true);
    vi.mocked(createCheckoutSession).mockResolvedValue({
      url: "https://checkout.stripe.com/session_2",
    } as never);

    await expect(checkoutAction()).rejects.toThrow(
      "REDIRECT:https://checkout.stripe.com/session_2",
    );
    expect(createCheckoutSession).toHaveBeenCalled();
  });

  it("recreates and persists the Stripe customer when the stored id no longer exists", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_stale",
      stripeSubscriptionId: null,
      status: "trialing",
    });
    vi.mocked(customerExists).mockResolvedValue(false);
    vi.mocked(createCustomer).mockResolvedValue({ id: "cus_new" } as never);
    vi.mocked(createCheckoutSession).mockResolvedValue({
      url: "https://checkout.stripe.com/session_3",
    } as never);

    await expect(checkoutAction()).rejects.toThrow(
      "REDIRECT:https://checkout.stripe.com/session_3",
    );

    expect(customerExists).toHaveBeenCalledWith("cus_stale");
    expect(createCustomer).toHaveBeenCalledWith({
      email: "driver@example.com",
      name: "Driver",
    });
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { stripeCustomerId: "cus_new" },
    });
    expect(createCheckoutSession).toHaveBeenCalledWith({ customerId: "cus_new" });
  });

  it("creates a Stripe customer when one was never stored", async () => {
    mockAuth("user-1");
    vi.mocked(mockPrisma.subscription.findUnique).mockResolvedValue({
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      status: "trialing",
    });
    vi.mocked(createCustomer).mockResolvedValue({ id: "cus_new" } as never);
    vi.mocked(createCheckoutSession).mockResolvedValue({
      url: "https://checkout.stripe.com/session_4",
    } as never);

    await expect(checkoutAction()).rejects.toThrow(
      "REDIRECT:https://checkout.stripe.com/session_4",
    );

    expect(customerExists).not.toHaveBeenCalled();
    expect(createCustomer).toHaveBeenCalledWith({
      email: "driver@example.com",
      name: "Driver",
    });
    expect(createCheckoutSession).toHaveBeenCalledWith({ customerId: "cus_new" });
  });
});
