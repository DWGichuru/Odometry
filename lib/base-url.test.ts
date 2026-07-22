import { afterEach, describe, expect, it } from "vitest";
import { getBaseUrl } from "@/lib/base-url";

describe("getBaseUrl", () => {
  const original = process.env.NEXT_PUBLIC_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_URL;
    } else {
      process.env.NEXT_PUBLIC_URL = original;
    }
  });

  it("returns the configured URL with its scheme intact", () => {
    process.env.NEXT_PUBLIC_URL = "https://odometry.app";
    expect(getBaseUrl()).toBe("https://odometry.app");
  });

  it("strips a trailing slash", () => {
    process.env.NEXT_PUBLIC_URL = "https://odometry.app/";
    expect(getBaseUrl()).toBe("https://odometry.app");
  });

  it("falls back to localhost when unset", () => {
    delete process.env.NEXT_PUBLIC_URL;
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });

  it("falls back to localhost when set to an empty string", () => {
    process.env.NEXT_PUBLIC_URL = "   ";
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });

  it("throws when set without an http(s) scheme", () => {
    process.env.NEXT_PUBLIC_URL = "odometry.app";
    expect(() => getBaseUrl()).toThrow(/missing an http\(s\):\/\/ scheme/);
  });

  it("throws when required and unset", () => {
    delete process.env.NEXT_PUBLIC_URL;
    expect(() => getBaseUrl({ required: true })).toThrow(/not configured/);
  });
});
