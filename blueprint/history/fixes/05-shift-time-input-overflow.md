# Fix: Start/end time inputs overflow their grid container on the shift form

**Type:** Fix

## The problem

On the "Add shift" / "Edit shift" form (`/shifts/new`, `/shifts/[id]/edit`), the
Start time and End time `<input type="time">` fields grow into each other and
overflow their container on mobile instead of sitting cleanly side by side.

Root cause: the two inputs sit in a `grid grid-cols-2 gap-3` container in
`components/shifts/ShiftForm.tsx`. CSS Grid items default to `min-width: auto`,
meaning a child won't shrink below its own intrinsic content size. A native
`<input type="time">` (especially on mobile Safari/WebKit) has a wider intrinsic
minimum content width for its time-picker chrome than a 50%-wide grid track
allows, so the input ignores `w-full` and refuses to shrink, overflowing into
the sibling cell.

## The fix

Add `min-w-0` to the two wrapping `<div>` grid items around the `startTime` and
`endTime` inputs, so the grid tracks can actually shrink to their allotted 50%
width and `w-full` on the inputs works as intended.

Must not break: the Amount earned / Trips completed and Start odometer / End
odometer grid rows, which use plain text/decimal inputs without native picker
chrome and weren't affected by this bug - left untouched.

## Build steps

- [x] **Step 1 - Let the time-input grid cells shrink to their track width**
  Add `min-w-0` to the wrapping `<div>` for `startTime` and the wrapping `<div>`
  for `endTime` in `components/shifts/ShiftForm.tsx`.
  *Done when:* Start time and End time render side by side within their card on
  a narrow (mobile) viewport, with no overflow. Build passes.

## Verify

- [x] `npm run build` passes.
- [x] Visual check on a phone/mobile viewport at `/shifts/new`: Start time and
  End time inputs sit side by side, fully inside the card, no overflow.
  Confirmed by the user on their device.
