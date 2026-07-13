# Current Feature

**Type:** Fix

## Title

Dashboard: show the weekly chart/stats even on an empty week

## The problem

`app/dashboard/page.tsx` currently branches on `shifts.length === 0` and, when
the selected week has no shifts, replaces the *entire* weekly section (earnings
card with the day-by-day bar chart, the Avg per hour/trip/distance stats grid,
and the shift list) with one generic "No shifts this week." card. This hides the
week's own chart/stats entirely, which is jarring - navigating to a different
week either shows a rich chart+stats view or a totally different, much sparser
card, depending on whether that week happens to have data.

## The fix

Remove the `shifts.length === 0` branch that swaps out the whole section.
Always render the normal weekly layout:

- The earnings card (title, total, day-by-day bars, platform breakdown) -
  already degrades safely to zero: `totalEarnings`/`totalHours`/`totalTrips`/
  `totalDistanceKm` default to `0`, the per-day bars already handle a missing
  shift per day (`"No shift"` tooltip, 0% height), and the platform breakdown
  block is already gated on `totalEarnings > 0` so it simply won't render when
  empty.
- The stats grid (Avg per hour/trip/distance) - `perHour`/`perTrip`/
  `perDistance` are already guarded against divide-by-zero (`> 0 ? ... : 0`), so
  this renders `$0.00` / `0h worked` etc. with no new logic needed.

Only the **"This week's shifts"** section changes conditionally: when
`shifts.length === 0`, show a small "No shifts this week" message with a "Log a
shift" link in place of the `ShiftListItem` list, instead of hiding the section.

Must not break: the non-empty rendering path (unchanged), or the existing
zero-guards in the per-rate calculations.

## Build steps

- [x] **Step 1 - Always render the weekly section; conditionally render the
      shift list.** Remove the `shifts.length === 0 ? ... : ...` branch wrapping
      the whole section in `app/dashboard/page.tsx`; keep the earnings card and
      stats grid unconditional; add a small conditional inside the "This week's
      shifts" block for the empty case. Done when: a week with no shifts shows
      the earnings card (`$0.00`, empty bars) and the stats grid (`$0.00` /
      `0h worked` / etc.), and "This week's shifts" shows "No shifts this week"
      with a working "Log a shift" link instead of the list; a week with shifts
      renders exactly as before.

## Verify

- `npm run build` passes (no test command changes needed - this is presentation
  logic with no new branches in already-tested pure functions).
- Navigate to a week with shifts: dashboard looks unchanged from before this fix.
- Navigate to a week with no shifts (e.g. via the `week` query param): earnings
  card and stats grid render with zeroed values; "This week's shifts" shows the
  empty message and a working "Log a shift" link to `/shifts/new`.
