import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDel, MockStripeError } = vi.hoisted(() => {
  class MockStripeError extends Error {
    constructor(public code: string) {
      super(code);
    }
  }
  return { mockDel: vi.fn(), MockStripeError };
});

vi.mock("stripe", () => {
  const Stripe = vi.fn(function () {
    return { customers: { del: mockDel } };
  });
  return { default: Object.assign(Stripe, { errors: { StripeError: MockStripeError } }) };
});

import { deleteCustomer } from "@/lib/stripe";

beforeEach(() => vi.clearAllMocks());

describe("deleteCustomer", () => {
  it("deletes the customer", async () => {
    mockDel.mockResolvedValue({ deleted: true });
    await deleteCustomer("cus_1");
    expect(mockDel).toHaveBeenCalledWith("cus_1");
  });

  it("treats an already-missing customer as deleted", async () => {
    mockDel.mockRejectedValue(new MockStripeError("resource_missing"));
    await expect(deleteCustomer("cus_1")).resolves.toBeUndefined();
  });

  it("rethrows any other Stripe error", async () => {
    mockDel.mockRejectedValue(new MockStripeError("api_error"));
    await expect(deleteCustomer("cus_1")).rejects.toThrow("api_error");
  });
});
