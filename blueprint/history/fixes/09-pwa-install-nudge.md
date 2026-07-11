# Fix: Dashboard install nudge - banner + platform-aware install modal

**Type:** Fix

## Design reference

`prototypes/install-nudge.html` (approved). Reuses the app's existing theme
tokens as-is (no new tokens to port); it's the visual target for Steps 3 and 4 -
banner copy/layout, and the bottom-sheet modal with its iOS / Android-native /
Android-fallback states.

## The problem

The app is now installable as a PWA (manifest, icons, service worker), but
nothing tells the user that's possible. Drivers on a phone browser have no
prompt pointing them at "Add to Home Screen" / "Install app", so the PWA work
goes undiscovered.

## The fix

Four pieces, additive only:

1. **Pure logic + unit tests** (`lib/pwa-install.ts`) - `detectInstallPlatform(userAgent)`
   returning `"ios" | "android" | "other"`, and `shouldShowInstallBanner(dismissState,
   now)` which encodes the dismiss rule: never dismissed -> show; dismissed once
   and within 7 days -> hide; dismissed once and 7+ days elapsed -> show again;
   dismissed twice (or more) -> hide permanently. Both are pure functions with
   assertable inputs/outputs, so per `coding-standards.md` they ship with unit
   tests (`lib/pwa-install.test.ts`, `vitest`).
2. **`InstallPromptProvider`** (`components/pwa/InstallPromptProvider.tsx`, client
   component, mounted once in `AppShell` alongside `ServiceWorkerRegistration`) -
   captures the Android/Chrome `beforeinstallprompt` event globally (it fires once,
   at any point in the app, so it must be caught at the shell level, not inside a
   component that may not be mounted yet) and calls `preventDefault()` on it,
   holding the event for later. Also listens for `appinstalled` to know a real
   install completed. Exposes via context: `canInstallNatively: boolean`,
   `promptInstall(): Promise<"accepted" | "dismissed" | null>`, `justInstalled:
   boolean`.
3. **`InstallBanner`** (`components/dashboard/InstallBanner.tsx`, client component,
   rendered in `app/dashboard/page.tsx`) - on mount, checks (a) not already
   standalone (`matchMedia("(display-mode: standalone)")` or iOS's
   `navigator.standalone`), (b) mobile only (`detectInstallPlatform` is `"ios"` or
   `"android"`, otherwise render nothing), (c) `shouldShowInstallBanner` against
   the localStorage dismiss record. Shows a dismissible banner ("Install Odometry
   for quicker access" or similar); clicking it (not the dismiss control) opens
   `InstallModal`. Dismiss button writes/increments the localStorage record
   (`odometry-install-dismiss`: `{ count, dismissedAt }`) per the rule in #1.
   `justInstalled` from the provider also hides it permanently (writes the
   permanent-dismiss state) without the user needing to dismiss manually.
4. **`InstallModal`** (`components/dashboard/InstallModal.tsx`) - platform-aware
   content:
   - **Android with `canInstallNatively`**: one-tap "Install" button calling
     `promptInstall()`; closes the modal once the browser's native dialog
     resolves.
   - **Android without it** (Firefox Android, Samsung Internet, expired prompt,
     etc.) and **iOS** (Safari has no such API): numbered manual steps. iOS:
     tap the Share icon -> "Add to Home Screen" -> "Add". Android fallback: open
     the browser menu -> "Add to Home Screen" / "Install app".

Must not break: existing dashboard rendering for desktop/unsupported browsers
(banner simply never renders there), or the existing `NoticeBanner` /
`LiveBanner` banners already on the dashboard.

## Build steps

- [x] **Step 1 - Platform + dismiss-rule logic, with tests.** Add
      `lib/pwa-install.ts` (`detectInstallPlatform`, `shouldShowInstallBanner`,
      the dismiss-record type) and `lib/pwa-install.test.ts` covering: never
      dismissed, within 7 days of first dismiss, past 7 days of first dismiss,
      dismissed twice. Done when: `npm test` passes with these new cases green.
- [x] **Step 2 - `InstallPromptProvider`.** Add the provider + context, mount in
      `AppShell`. Done when: `npm run build` passes; in Chrome desktop DevTools
      with "Add to homescreen" simulated (Application > Manifest > "Add to home
      screen" or the real `beforeinstallprompt` firing on a served build), a
      console log / temporary check confirms the event was captured and
      `preventDefault` was called (no native mini-infobar appears).
- [x] **Step 3 - `InstallBanner` on the dashboard.** Add the component, render it
      in `app/dashboard/page.tsx`. Done when: visiting `/dashboard` in a mobile
      Chrome/Android emulation shows the banner; dismissing it hides it and
      reloading within the 7-day window keeps it hidden (verify by manipulating
      the localStorage timestamp); desktop shows no banner.
- [x] **Step 4 - `InstallModal`.** Add the component, wire the banner's click to
      open it. Done when: on iOS UA emulation the modal shows manual Share-sheet
      steps; on Android UA emulation with a captured prompt it shows the one-tap
      Install button and calls `promptInstall()` on click; on Android UA without a
      captured prompt it shows the manual fallback steps.

## Testing

- `lib/pwa-install.ts`'s `detectInstallPlatform` and `shouldShowInstallBanner` are
  pure logic with real edge cases (boundary at exactly 7 days, 0/1/2+ dismiss
  counts, unknown user agents) - these ship with `lib/pwa-install.test.ts` per the
  Testing gate in `coding-standards.md`.
- `InstallPromptProvider`, `InstallBanner`, and `InstallModal` are browser/UI
  integration surfaces (real `beforeinstallprompt`/`appinstalled` events, real
  `matchMedia`, real user agents) - per `coding-standards.md` these ride on
  browser verification, not unit tests. Note: `beforeinstallprompt` is not
  reliably triggerable in an automated headless browser (it depends on Chrome's
  engagement heuristics and isn't dispatchable from Playwright), so the true
  one-tap Android path needs a manual check in real Chrome/Android or via
  DevTools' manifest install simulation; this will be called out explicitly
  rather than claimed as automated evidence.

## Verify

- `npm test` and `npm run build` both pass.
- Dashboard on a mobile UA (iOS or Android emulation), not already installed:
  banner appears.
- Dashboard already running standalone, or on desktop: banner never appears.
- Dismiss once -> hidden immediately; simulate 7+ days elapsed -> reappears;
  dismiss a second time -> hidden permanently (confirm via localStorage
  inspection, not just visually).
- Modal content matches the platform: iOS shows Share-sheet steps; Android shows
  the native Install button when a prompt was captured, otherwise the manual
  fallback steps.
