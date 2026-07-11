export type InstallPlatform = "ios" | "android" | "other";

export function detectInstallPlatform(userAgent: string): InstallPlatform {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return "other";
}

export interface InstallDismissState {
  count: number;
  dismissedAt: number;
}

const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldShowInstallBanner(
  dismissState: InstallDismissState | null,
  now: number,
): boolean {
  if (!dismissState || dismissState.count === 0) return true;
  if (dismissState.count >= 2) return false;
  return now - dismissState.dismissedAt >= DISMISS_WINDOW_MS;
}
