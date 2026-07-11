# Fix: Restore bottom navigation on authenticated pages

**Type:** Fix

## The problem

The root layout was stripped to a plain `<main>{children}</main>` during the
landing page build, removing `BottomNav` from all pages. It should exist on all
pages except `/` (the marketing landing page).

## The fix

Restore `auth()` and `BottomNav` to the root layout. Use a client shell component
(`AppShell`) that checks `usePathname()` to conditionally render `BottomNav` only
when not on `/`. Pass the session via props from the server layout.

## Build steps

- [x] **Step 1 - Restore BottomNav with pathname check**
  - Add `auth()` back to root layout
  - Create `components/layout/AppShell.tsx` (`'use client'`): wraps children,
    checks `usePathname()`, renders `BottomNav` only when pathname !== "/" and
    user is authenticated
  - Wire it into root layout, passing session as prop
  *Done when:* BottomNav renders on `/dashboard`, `/shifts`, `/trends`,
  `/profile`. No BottomNav on `/`. Build passes.

## Verify

- `npm run build` passes
- Navigate to `/` - no BottomNav
- Navigate to `/dashboard` - BottomNav visible
- Navigate to `/shifts` - BottomNav visible
- Navigate to `/trends` - BottomNav visible
