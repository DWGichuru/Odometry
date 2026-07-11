import { describe, expect, it } from "vitest";
import {
  detectInstallPlatform,
  shouldShowInstallBanner,
  type InstallDismissState,
} from "@/lib/pwa-install";

describe("detectInstallPlatform", () => {
  it("detects iPhone", () => {
    expect(
      detectInstallPlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe("ios");
  });

  it("detects iPad", () => {
    expect(
      detectInstallPlatform(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe("ios");
  });

  it("detects Android", () => {
    expect(
      detectInstallPlatform(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0",
      ),
    ).toBe("android");
  });

  it("returns other for desktop user agents", () => {
    expect(
      detectInstallPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      ),
    ).toBe("other");
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

function dismissState(overrides: Partial<InstallDismissState> = {}): InstallDismissState {
  return { count: 1, dismissedAt: Date.now(), ...overrides };
}

describe("shouldShowInstallBanner", () => {
  it("shows when never dismissed", () => {
    expect(shouldShowInstallBanner(null, Date.now())).toBe(true);
  });

  it("hides within 7 days of a first dismissal", () => {
    const now = Date.now();
    const state = dismissState({ count: 1, dismissedAt: now - 3 * DAY_MS });
    expect(shouldShowInstallBanner(state, now)).toBe(false);
  });

  it("shows again once 7+ days have passed since a first dismissal", () => {
    const now = Date.now();
    const state = dismissState({ count: 1, dismissedAt: now - 7 * DAY_MS });
    expect(shouldShowInstallBanner(state, now)).toBe(true);
  });

  it("hides permanently after a second dismissal, regardless of elapsed time", () => {
    const now = Date.now();
    const state = dismissState({ count: 2, dismissedAt: now - 365 * DAY_MS });
    expect(shouldShowInstallBanner(state, now)).toBe(false);
  });
});
