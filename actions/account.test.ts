import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDeleteAccount } = vi.hoisted(() => ({ mockDeleteAccount: vi.fn() }));

vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/services/account", () => ({ deleteAccount: mockDeleteAccount }));

import { auth, signOut } from "@/auth";
import { deleteAccount } from "@/actions/account";

function mockAuth(userId: string | null) {
  vi.mocked(auth).mockResolvedValue(userId ? { user: { id: userId } } : null);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth("user-1");
  mockDeleteAccount.mockResolvedValue({ success: true });
});

describe("deleteAccount action", () => {
  it("requires sign-in", async () => {
    mockAuth(null);

    expect(await deleteAccount("secret")).toEqual({ error: "You must be signed in." });
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the session user and signs out", async () => {
    await deleteAccount("secret");

    expect(mockDeleteAccount).toHaveBeenCalledWith("user-1", "secret");
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });

  it("passes no password for a Google-only user", async () => {
    await deleteAccount();

    expect(mockDeleteAccount).toHaveBeenCalledWith("user-1", undefined);
  });

  it("returns the service error and stays signed in on failure", async () => {
    mockDeleteAccount.mockResolvedValue({ code: "UNPROCESSABLE", error: "Incorrect password." });

    expect(await deleteAccount("wrong")).toEqual({ error: "Incorrect password." });
    expect(signOut).not.toHaveBeenCalled();
  });
});
