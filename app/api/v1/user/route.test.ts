import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockDeleteAccount, mockRequireAuth } = vi.hoisted(() => ({
  mockDeleteAccount: vi.fn(),
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/services/account", () => ({ deleteAccount: mockDeleteAccount }));
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: mockRequireAuth,
}));

import { DELETE } from "@/app/api/v1/user/route";
import { ApiError } from "@/lib/api-auth";

function del(body?: string) {
  return DELETE(new NextRequest("http://localhost/api/v1/user", { method: "DELETE", body }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue("user-1");
  mockDeleteAccount.mockResolvedValue({ success: true });
});

describe("DELETE /api/v1/user", () => {
  it("deletes the authenticated user with the given password", async () => {
    const res = await del(JSON.stringify({ password: "secret" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { deleted: true } });
    expect(mockDeleteAccount).toHaveBeenCalledWith("user-1", "secret");
  });

  it("accepts an empty body for a Google-only user", async () => {
    const res = await del();

    expect(res.status).toBe(200);
    expect(mockDeleteAccount).toHaveBeenCalledWith("user-1", undefined);
  });

  it("returns 401 without touching the service when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(new ApiError("nope", 401, "UNAUTHORIZED"));

    expect((await del()).status).toBe(401);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{", "INVALID_JSON"],
    ["a non-string password", JSON.stringify({ password: 123 }), "VALIDATION_ERROR"],
  ])("returns 400 for %s", async (_label, body, code) => {
    const res = await del(body);

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(code);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("maps a wrong password to 422", async () => {
    mockDeleteAccount.mockResolvedValue({ code: "UNPROCESSABLE", error: "Incorrect password." });

    const res = await del(JSON.stringify({ password: "wrong" }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("UNPROCESSABLE");
  });
});
