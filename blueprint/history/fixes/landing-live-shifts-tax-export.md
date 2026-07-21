# current-feature

**Title:** Marketing page: lead with live shifts, add tax export section, use real app icon

**Type:** Fix

## The problem

`app/page.tsx` (the public landing page) is out of date against the shipped/in-progress
feature set:

1. The "Log a shift in seconds" section (`#two-ways`) presents screenshot import as the
   `Headline feature` and manual entry as the alternative. It has no mention of live
   odometer-photo shift tracking (build-plan #12), which `project-overview.md` calls
   the actual headline feature: photograph the odometer to start a shift, photograph it
   again to end one, no typing at all.
2. There is no section telling visitors they can export their shift history as a PDF
   summary or CSV for tax purposes, even though `/export` (`app/export/page.tsx`) already
   ships that: period picker (month/year/range) plus PDF and CSV downloads.
3. The brand mark in the header and footer is a Unicode circle placeholder
   (`&#x25D0;`), not the actual Odometry app icon that already exists at
   `public/icons/icon-*.png` (a gradient gauge/odometer glyph).

## The fix

Edit `app/page.tsx` only (plus a small addition to `components/landing/` if a new visual
needs its own component). No routes, data, or server logic change; this is marketing copy
and layout.

- **Live shifts as the calling card:** turn `#two-ways` into three ways to log, led by
  live odometer capture. Move the `Headline feature` tag onto it, demote screenshot
  import to second, manual entry to third. Give it a real phone screenshot like the
  other cards, not a placeholder icon: capture `app/capture/page.tsx` in its "framing"
  state (viewfinder guide, "Line up the odometer inside the frame") using a one-off
  Playwright script, since the project already has `@playwright/test` and a seeded
  test user (`tests/seed.ts`, `pw-test@odometry.dev`) - launch Chromium with
  `--use-fake-device-for-media-stream` (no real camera in this environment), sign in,
  navigate to `/capture`, screenshot the framing UI, save as
  `public/screens/capture.png`, and render it with the existing `PhoneFrame` component
  exactly like the other three screens.
- **Tax export section:** add a new `section-block` (after the trends section, before
  pricing) that mirrors the existing split-layout sections: copy about downloading a
  PDF summary or CSV of shifts for tax time, pulling the same points `/export` already
  delivers (period selection, totals, per-shift CSV rows).
- **Real app icon:** replace both `<span className="mark">&#x25D0;</span>` occurrences
  (header brand, footer brand) with the actual icon image, e.g.
  `<img src="/icons/icon-192x192.png" alt="Odometry" />` sized to fit the existing
  `.mark` box. Keep the `.mark` gradient box as a fallback background if the image has
  transparent padding.

Must not break: existing sections' content/order otherwise, the `#two-ways` anchor link
from the hero's "See how it works" CTA, responsive layout (`.duo`, `.split`, `.wrap-block`
etc. already handle mobile).

## Build steps

1. [x] **Live shifts calling card.** Capture the `/capture` framing-state screenshot via the
   one-off Playwright script and save it to `public/screens/capture.png`. Rework
   `#two-ways` into a three-card row with live odometer capture first (using the new
   screenshot via `PhoneFrame`) and tagged `Headline feature`; screenshot import and
   manual entry follow, tags removed or downgraded to plain labels.
   Done when: the section shows three cards in order (live shift, screenshot, manual),
   the live-shift card shows the real capture-UI screenshot, live shift carries the
   headline tag, and the page builds with no layout regressions at mobile and desktop
   widths.

2. [x] **Tax export section.** Add a new section between trends and pricing describing PDF
   and CSV export for tax records, matching the visual pattern of the surrounding
   `split`/`split rev` sections.
   Done when: the section renders with a heading, supporting copy, and a feature list
   (or equivalent) describing PDF/CSV export, matching the existing section styling.

3. [x] **Real Odometry icon.** Swap both Unicode `mark` spans for the real app icon image.
   Done when: header and footer both show the actual gauge icon instead of the `&#x25D0;`
   glyph, in both light and dark rendering.

## Verify

- `npm run build` passes.
- Load `/` in the browser (logged out): header/footer show the real icon, the
  `#two-ways` section leads with live shifts, the new export section appears before
  pricing, and "See how it works" still scrolls to the right section.
- Check mobile width (e.g. 390px) for the reworked three-card row and the new section.
