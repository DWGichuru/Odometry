# Fix: Bottom nav ignores safe area when installed as a standalone PWA

**Type:** Fix

## The problem

With the app installed to a home screen (standalone display mode, no browser
chrome), the bottom navigation sits flush against the physical bottom edge of the
device, overlapping the iOS home-indicator gesture zone and making the nav's
buttons hard to tap.

Root cause: `app/layout.tsx`'s `viewport` export never sets `viewportFit: "cover"`.
Without it, iOS Safari never activates safe-area layout, so every
`env(safe-area-inset-*)` in the app resolves to `0px` regardless of device -
including the padding already written into `components/layout/BottomNav.tsx`
(`pb-[env(safe-area-inset-bottom,0px)]`), `components/layout/AppShell.tsx`, and
`components/layout/ConnectionStatus.tsx`. That padding was always inert. It went
unnoticed in a regular browser tab because Safari's own chrome buffers the bottom
edge there; installed standalone, nothing does.

## The fix

Add `viewportFit: "cover"` to the `viewport` export in `app/layout.tsx`. This is
the single missing precondition for `env(safe-area-inset-*)` to resolve to real
values on iOS; no other file needs to change since the safe-area padding is
already in place everywhere it's needed.

Must not break: existing layout on non-notched devices/desktop browsers (safe
area insets are `0px` there regardless, so no visual change expected).

## Build steps

- [x] **Step 1 - Set `viewportFit: "cover"`.** Edit the `viewport` export in
      `app/layout.tsx`. Done when: `npm run build` passes, and a mobile Safari /
      iOS simulator check (or Chrome DevTools device toolbar with a notched
      device preset) shows the bottom nav's touch targets sitting above the home
      indicator, with visible breathing room, in both standalone (installed) and
      regular tab display modes.

## Verify

- `npm run build` succeeds.
- Chrome DevTools, mobile device emulation with a notched device (e.g. iPhone 14
  Pro) and viewport-fit honored: bottom nav padding-bottom reflects a non-zero
  safe-area inset instead of collapsing to the nav's bare height.
- Visual check on a real iPhone (or simulator) with the app added to the home
  screen: nav buttons sit clear of the home-indicator swipe zone.
