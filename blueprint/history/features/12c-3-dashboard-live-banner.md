# Feature: Dashboard in-progress banner

**From build-plan:** feature 12c-3
**Status:** not started

## Goal

Show a green live banner on the dashboard when an OPEN `ShiftSession` exists. The banner displays elapsed time (updating every second), the start odometer, and a button to end the shift. It sits above the weekly earnings card, matching the prototype -- the driver sees the week's data while the clock runs.

## Design reference

| Mockup | What it pins down |
| --- | --- |
| [prototypes/dashboard-live.html](../../prototypes/dashboard-live.html) | The live banner: pulsing dot + "Shift in progress" tag, elapsed timer, start odometer chip, "Distance so far" chip (placeholder), "End shift · snap odometer" button. Layout relative to the weekly card. |

Theme tokens ported in 12a. Prototypes preserved until feature 12 is fully complete.

## In scope

- `LiveBanner` client component -- fetches OPEN session via `getOpenSession()` from 12c-1, renders banner when a session exists
- Elapsed timer display: formats as `H:MM` (under 1 hour: `M:SS`), updates every second
- Pulsing dot + "Shift in progress" tag using `--live` token
- "Started 9:41 AM" text from `session.startedAt`
- Start odometer chip: displays `startOdometer` in mono font with "km" suffix (e.g. "048231 km")
- "Distance so far" chip: placeholder showing "— km" (no current odometer to compute distance without a second photo)
- "End shift · snap odometer" button: navigates to `/capture?type=end`
- Mount the banner in the dashboard page, below the page title and above the weekly card

## Out of scope

- Computing actual distance so far (requires a current odometer reading, which we don't have until the end photo)
- The FAB entry sheet or live FAB (already built in 12c-1)
- The camera capture page (already built in 12c-2)
- Modifying the weekly stats or shift list -- existing content unchanged
- The "1 running" pill text in the weekly card (minor, but not in the prototype's live banner scope)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `LiveBanner` component**
  Create `components/dashboard/LiveBanner.tsx` -- a `"use client"` component. On mount, calls `getOpenSession()`. If no session, renders nothing. If a session exists, renders:
  - Card (`rounded-[var(--radius-lg)]`, border with `--live` tint, gradient background using `--live-muted` and `--surface`, shadow)
  - Top row: left side "⚫ Shift in progress" tag (uppercase, `--live` color, pulsing dot) + right side "Started 9:41 AM" (muted, from `session.startedAt`)
  - Large elapsed time: `H:MM` or `M:SS` format, bold, tabular-nums. Updates every second via `setInterval`.
  - Meta chips row: two equal-width chips. Left: "START ODOMETER" label + `"048231 km"` value (mono, tabular-nums). Right: "DISTANCE SO FAR" label + `"— km"` value.
  - "End shift · snap odometer" button: full-width, `bg-live` background, `text-[#05271c]` text, stop icon. Navigates to `/capture?type=end`.
  Match `dashboard-live.html` lines 306-329 for layout and styling.
  *Done when:* `npm run build` passes. Component renders correctly when an OPEN session exists. Returns null when no session. Elapsed timer ticks.

- [x] **Step 2 - Mount in dashboard**
  Mount `<LiveBanner />` in `app/dashboard/page.tsx` between the page title row and the weekly earnings card. No other dashboard changes.
  *Done when:* `npm run build` passes. Visiting `/dashboard` with an OPEN session shows the banner. Without a session, dashboard renders as before.

## Files / areas

| File | Action |
|------|--------|
| `components/dashboard/LiveBanner.tsx` | **New.** The live banner component |
| `app/dashboard/page.tsx` | Add `<LiveBanner />` between title and weekly card |
| `actions/session.ts` | Called (unchanged from 12c-1) |

## Data / contracts

Uses `getOpenSession()` from 12c-1, returns `{ session: ShiftSession | null }`. The banner reads `session.startOdometer` and `session.startedAt`.

**LiveBanner props:** none. It's self-contained -- calls `getOpenSession()` internally.

**Elapsed time format:**
- 1+ hours: `H:MM` (e.g. "2:14")
- Under 1 hour: `M:SS` (e.g. "42:08")

## Testing

`npm test` is configured. This feature is UI-only (client component, timer, navigation) -- no new pure logic. Rides on build + screenshot evidence. Use `/check` or manual browser verification against `dashboard-live.html`.

Existing tests must still pass.

## Notes for the AI

- `LiveBanner` returns `null` when no session exists -- the dashboard renders as before.
- Elapsed timer: same pattern as `BottomNav` live FAB from 12c-1. Calculate `(Date.now() - new Date(session.startedAt).getTime()) / 1000` seconds. Update every second.
- The "DISTANCE SO FAR" chip shows "— km" as static placeholder. No computation needed.
- The banner uses `--live` (emerald) and `--live-muted` tokens from 12a. Border uses `color-mix(in srgb, var(--live) 40%, var(--border))`.
- Button navigates via `useRouter().push("/capture?type=end")`.
- Format `startedAt` for "Started 9:41 AM" using `new Date(session.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })`.
- The banner sits inside the dashboard's scrollable area, not fixed-positioned.
- Prototypes are preserved. Do not delete `prototypes/` at `/complete` for 12c-3.