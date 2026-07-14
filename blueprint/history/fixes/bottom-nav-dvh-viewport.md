# Current feature

## Title
Bottom nav floats mid-screen on short pages (empty dashboard week)

**Type:** Fix

## The problem

On `/dashboard` when the selected week has no shifts, the page content is short
enough that it doesn't fill the viewport. The bottom nav (`components/layout/BottomNav.tsx`)
is `position: fixed; bottom: 0`, which per spec should always pin to the true
viewport bottom regardless of content height. In practice, on iOS Safari and in
standalone PWA mode, `position: fixed` elements can render relative to the
*layout* viewport captured at initial paint rather than the real *visual*
viewport when the page doesn't need to scroll - a well-documented WebKit quirk.
The result is exactly what the screenshot shows: the nav renders above the true
bottom edge, leaving a dead black gap below it down to the home indicator.

The root cause is the page shell's height being set with percentage units
(`app/layout.tsx`): `html` uses `h-full` and `body` uses `min-h-full`. These
resolve against the initial containing block and don't reliably track the
*actual* visual viewport on iOS when no scrolling occurs, which is what lets the
fixed nav drift. Populated weeks don't show the bug because there's enough
content to force a taller layout viewport, which happens to line up correctly.

## The fix

Switch the root shell from percentage-based height (`h-full` / `min-h-full`) to
the `dvh` (dynamic viewport height) unit, which iOS Safari keeps in sync with the
real visual viewport regardless of content length or toolbar state. This is the
standard fix for this class of iOS fixed-position bug and doesn't touch the nav's
own `fixed` positioning, safe-area padding, or `AppShell`/`BottomNav` structure at
all - only the top-level height utility class.

- `app/layout.tsx`: `html` className drops `h-full`; `body` className changes
  `min-h-full` to `min-h-dvh`.

Must not break: safe-area padding on `BottomNav`/`AppShell` (unchanged), the
existing scroll behavior on populated dashboard weeks, and the nav's fixed
positioning/backdrop-blur styling.

## Build steps

1. [x] In `app/layout.tsx`, change the `html` element's className from
   `` `${geistSans.variable} ${geistMono.variable} h-full antialiased` `` to
   `` `${geistSans.variable} ${geistMono.variable} antialiased` `` and the `body`
   className from `"min-h-full flex flex-col"` to `"min-h-dvh flex flex-col"`.
   **Done when:** the dashboard's empty-week state (no shifts logged) renders
   with the bottom nav flush against the true bottom edge on a mobile viewport,
   with no dead gap below it, and populated weeks are unaffected.

## Verify

- Chrome DevTools device toolbar (iPhone viewport) on `/dashboard` for a week
  with zero shifts: bottom nav should sit flush at the screen bottom, no gap.
- Same check on a week with shifts logged (existing behavior, should be
  unchanged).
- `npm run build` passes.
