import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { user: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  ApiError,
  handleApiRequest,
  readJsonObject,
  requireAuth,
  unwrap,
} from "@/lib/api-auth";
import { generateTokens } from "@/lib/jwt";
import { fail } from "@/lib/services/result";

function request(init: { headers?: Record<string, string>; body?: string } = {}) {
  return new NextRequest("http://localhost/api/v1/test", {
    method: "POST",
    headers: init.headers,
    body: init.body,
  });
}

describe("requireAuth", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "a".repeat(32));
    vi.stubEnv("JWT_REFRESH_SECRET", "r".repeat(32));
    mockPrisma.user.findUnique.mockImplementation(({ where }) => Promise.resolve({ id: where.id }));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns the user id for a valid bearer access token", async () => {
    const { accessToken } = await generateTokens("user-1");
    const req = request({ headers: { authorization: `Bearer ${accessToken}` } });
    await expect(requireAuth(req)).resolves.toBe("user-1");
  });

  it("throws 401 for a valid token whose user was deleted", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { accessToken } = await generateTokens("user-1");
    const req = request({ headers: { authorization: `Bearer ${accessToken}` } });
    await expect(requireAuth(req)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it.each([
    ["no header", {}],
    ["a non-bearer scheme", { authorization: "Basic abc" }],
    ["an empty bearer token", { authorization: "Bearer " }],
    ["a garbage token", { authorization: "Bearer nope" }],
  ])("throws 401 for %s", async (_label, headers) => {
    await expect(requireAuth(request({ headers }))).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("throws 401 when given a refresh token", async () => {
    const { refreshToken } = await generateTokens("user-1");
    const req = request({ headers: { authorization: `Bearer ${refreshToken}` } });
    await expect(requireAuth(req)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("unwrap", () => {
  it("passes success values through", () => {
    expect(unwrap({ success: true, data: 1 })).toEqual({ success: true, data: 1 });
  });

  it.each([
    ["VALIDATION_ERROR", 400],
    ["UNPROCESSABLE", 422],
    ["SUBSCRIPTION_REQUIRED", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["RATE_LIMITED", 429],
    ["UPSTREAM_ERROR", 502],
  ] as const)("maps %s to HTTP %i", (code, status) => {
    try {
      unwrap(fail(code, "nope"));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e).toMatchObject({ statusCode: status, code, message: "nope" });
    }
  });
});

describe("readJsonObject", () => {
  it("parses an object body", async () => {
    await expect(readJsonObject(request({ body: '{"a":1}' }))).resolves.toEqual({ a: 1 });
  });

  it.each([
    ["malformed JSON", "{"],
    ["an array", "[1]"],
    ["a primitive", "3"],
    ["null", "null"],
  ])("rejects %s with 400", async (_label, body) => {
    await expect(readJsonObject(request({ body }))).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_JSON",
    });
  });
});

describe("handleApiRequest", () => {
  it("wraps data with the given success status", async () => {
    const res = await handleApiRequest(() => ({ id: "x" }), 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: "x" } });
  });

  it("returns an ApiError's status, code, and message", async () => {
    const res = await handleApiRequest(() => {
      throw new ApiError("Shift not found", 404, "NOT_FOUND");
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: "Shift not found", code: "NOT_FOUND" });
  });

  it("hides unexpected error messages behind a generic 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleApiRequest(() => {
      throw new Error("connection string postgres://secret@host");
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("secret");
    spy.mockRestore();
  });
});
