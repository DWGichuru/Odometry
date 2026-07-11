# Fix: Two safe-area layout regressions in standalone PWA mode

**Type:** Fix

## The problem

Confirmed via a real-device screenshot from the user (both invisible in the
Chromium/Playwright tooling used to verify the earlier safe-area fix, since
Chromium doesn't simulate hardware safe-area insets):

1. **Bottom nav icons render squeezed/clipped almost to nothing.**
   `components/layout/BottomNav.tsx`'s `<nav>` uses `h-16` (a *fixed* 64px
   height) plus `pb-[env(safe-area-inset-bottom,0px)]`. With `border-box`
   sizing, that padding eats into the fixed height instead of adding to it - on
   a device with a ~34px home-indicator inset, the visible content area shrinks
   to ~30px, clipping the 24px icons down to almost nothing while the text
   labels below them survive. Before the `viewport-fit=cover` fix
   ([08-pwa-safe-area-cover](../history/fixes/08-pwa-safe-area-cover.md)) this
   inset was always `0px`, so the bug was silently present but invisible.

2. **Page content collides with the status bar / Dynamic Island at the top.**
   `components/layout/AppShell.tsx`'s `<main>` never reserves any top padding
   for `env(safe-area-inset-top)` - only the bottom is accounted for (for the
   nav bar). In a browser tab, Safari's own chrome ate that space; standalone,
   nothing does, so page headers (e.g. the dashboard title and date pill)
   render under the notch/status bar.

## The fix

1. Change `BottomNav`'s nav height from `h-16` to
   `h-[calc(4rem+env(safe-area-inset-bottom,0px))]`, keeping the existing
   `pb-[env(safe-area-inset-bottom,0px)]`. This mirrors the additive pattern
   `AppShell`'s `<main>` already uses correctly for the same nav
   (`pb-[calc(4rem+env(safe-area-inset-bottom,0px))]`): the content area stays a
   full 4rem regardless of device, and the safe area becomes genuine extra
   height, not stolen height.
2. Add `pt-[env(safe-area-inset-top,0px)]` to `AppShell`'s `<main>` (applied
   regardless of `showNav`/`authenticated`, since the top overlap affects every
   page, including sign-in/landing if opened standalone via a deep link).

Must not break: existing bottom nav layout/tap targets on non-notched
devices/desktop (inset is `0px` there, so no visual change), or the `main`
padding-bottom already in place for the nav.

## Build steps

- [x] **Step 1 - Fix nav height + add top safe-area padding.** Edit
      `components/layout/BottomNav.tsx` and `components/layout/AppShell.tsx` per
      above. Done when: `npm run build` passes, and a manual check on a real
      notched device (or iOS Simulator) run standalone shows full-size, uncut
      nav icons and a dashboard header that clears the status bar/Dynamic
      Island.

## Verify

- `npm run build` succeeds.
- Real iPhone (or iOS Simulator) with the app installed standalone: bottom nav
  icons render at their normal size (not clipped), and the dashboard's title
  and date pill are fully visible below the status bar.
- Non-notched device / desktop browser: no visible change (insets are `0px`).
