import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateTokens, verifyAccessToken, verifyRefreshToken } from "@/lib/jwt";

const ACCESS = "a".repeat(32);
const REFRESH = "r".repeat(32);

describe("jwt", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", ACCESS);
    vi.stubEnv("JWT_REFRESH_SECRET", REFRESH);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("round-trips the user id through both token kinds", async () => {
    const { accessToken, refreshToken } = await generateTokens("user-1");
    expect(await verifyAccessToken(accessToken)).toBe("user-1");
    expect(await verifyRefreshToken(refreshToken)).toBe("user-1");
  });

  it("does not accept a refresh token as an access token, or the reverse", async () => {
    const { accessToken, refreshToken } = await generateTokens("user-1");
    expect(await verifyAccessToken(refreshToken)).toBeNull();
    expect(await verifyRefreshToken(accessToken)).toBeNull();
  });

  it("rejects an access token that has typ refresh even when signed with the access secret", async () => {
    vi.stubEnv("JWT_REFRESH_SECRET", ACCESS);
    const { refreshToken } = await generateTokens("user-1");
    expect(await verifyAccessToken(refreshToken)).toBeNull();
  });

  it("rejects tampered and malformed tokens", async () => {
    const { accessToken } = await generateTokens("user-1");
    const tampered = accessToken.slice(0, -2) + (accessToken.endsWith("A") ? "BB" : "AA");
    expect(await verifyAccessToken(tampered)).toBeNull();
    expect(await verifyAccessToken("not-a-jwt")).toBeNull();
  });

  it("rejects an access token after 15 minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { accessToken } = await generateTokens("user-1");

    vi.setSystemTime(new Date("2026-01-01T00:14:00Z"));
    expect(await verifyAccessToken(accessToken)).toBe("user-1");

    vi.setSystemTime(new Date("2026-01-01T00:16:00Z"));
    expect(await verifyAccessToken(accessToken)).toBeNull();
  });

  it("fails closed when a secret is missing or short", async () => {
    vi.stubEnv("JWT_SECRET", "");
    await expect(generateTokens("user-1")).rejects.toThrow("JWT_SECRET");

    vi.stubEnv("JWT_SECRET", "too-short");
    await expect(verifyAccessToken("x")).rejects.toThrow("JWT_SECRET");
  });
});
