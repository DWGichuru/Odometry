import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockDeleteCustomer, mockCompare } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), delete: vi.fn() },
    verificationToken: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  mockDeleteCustomer: vi.fn(),
  mockCompare: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/stripe", () => ({ deleteCustomer: mockDeleteCustomer }));
vi.mock("@/lib/alert", () => ({ alertOnFailure: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { compare: mockCompare } }));

import { deleteAccount } from "@/lib/services/account";

const CREDENTIALS_USER = {
  email: "driver@example.com",
  credential: { hashedPassword: "hash" },
  subscription: { stripeCustomerId: "cus_1" },
};
const GOOGLE_USER = {
  email: "driver@example.com",
  credential: null,
  subscription: { stripeCustomerId: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue(CREDENTIALS_USER);
  mockPrisma.user.delete.mockReturnValue("delete-user");
  mockPrisma.verificationToken.deleteMany.mockReturnValue("delete-tokens");
  mockPrisma.$transaction.mockResolvedValue([]);
  mockCompare.mockResolvedValue(true);
  mockDeleteCustomer.mockResolvedValue(undefined);
});

describe("deleteAccount", () => {
  it("deletes the Stripe customer, then the user and its verification tokens", async () => {
    expect(await deleteAccount("user-1", "secret")).toEqual({ success: true });

    expect(mockCompare).toHaveBeenCalledWith("secret", "hash");
    expect(mockDeleteCustomer).toHaveBeenCalledWith("cus_1");
    expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "driver@example.com" },
    });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(["delete-tokens", "delete-user"]);
    expect(mockDeleteCustomer.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrisma.$transaction.mock.invocationCallOrder[0],
    );
  });

  it("skips Stripe when the user never had a customer", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...CREDENTIALS_USER,
      subscription: { stripeCustomerId: null },
    });

    expect(await deleteAccount("user-1", "secret")).toEqual({ success: true });
    expect(mockDeleteCustomer).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("does not need a password for a Google-only user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(GOOGLE_USER);

    expect(await deleteAccount("user-1")).toEqual({ success: true });
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("requires a password for a credentials user", async () => {
    expect(await deleteAccount("user-1")).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mockDeleteCustomer).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a wrong password without touching Stripe or the database", async () => {
    mockCompare.mockResolvedValue(false);

    expect(await deleteAccount("user-1", "wrong")).toMatchObject({ code: "UNPROCESSABLE" });
    expect(mockDeleteCustomer).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("keeps the user when Stripe fails", async () => {
    mockDeleteCustomer.mockRejectedValue(new Error("stripe down"));

    expect(await deleteAccount("user-1", "secret")).toMatchObject({ code: "UPSTREAM_ERROR" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the user is already gone", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    expect(await deleteAccount("user-1", "secret")).toMatchObject({ code: "NOT_FOUND" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
