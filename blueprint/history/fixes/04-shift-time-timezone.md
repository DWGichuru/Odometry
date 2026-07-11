# Fix: Shift edit time shifts by the server/browser timezone offset

**Type:** Fix

## The problem

Editing (or creating) a shift and typing a start/end time saves the wrong time,
offset by a fixed number of hours (e.g. entering `13:00` is saved and later
displayed as `18:00`).

Root cause is a double, mismatched timezone conversion in the manual shift
entry path:

- `buildShift()` in `lib/shift-entry.ts` encoded the typed `"HH:mm"` string with
  `new Date(`${date}T00:00:00`)` + `.setHours()`, which resolves in whatever
  timezone the **server process** happens to run in, then persisted it via
  `.toISOString()`.
- `ShiftForm.tsx` decoded the saved time back for the edit form with
  `.toLocaleTimeString()` and no `timeZone` option, which resolves in the
  **browser's** local timezone.
- `ShiftListItem.tsx` had the same undated decode for the `/shifts` list.

When the server's runtime timezone differs from the browser's, the round trip
shifts by the offset between them.

## The fix

Stop relying on ambient runtime timezone on either side; pin both the encode
and decode steps to UTC so the round trip is exact no matter what timezone the
server process executes in.

- `buildShift()` now builds `startDate`/`endDate` with `Date.UTC(year, month - 1,
  day, hours, minutes)` instead of local `new Date(...).setHours()`.
- `ShiftForm.tsx`'s prefill (`toLocaleTimeString` for `startTime`/`endTime`) now
  passes `timeZone: "UTC"`.
- `ShiftListItem.tsx`'s `formatTime()` now passes `timeZone: "UTC"` too, since the
  shift list showed the same skew.

Must not break: shift duration math (`getShiftHours`, `shiftHours` in
`ShiftListItem.tsx`), which uses `getTime()` differences and is timezone-agnostic
already; the odometer-photo flow (`ShiftSession`/`review-shift`), which uses real
server `now()` timestamps rather than typed `HH:mm` strings and was never
affected.

## Build steps

- [x] **Step 1 - Encode and decode shift times in UTC, not ambient local time**
  - `lib/shift-entry.ts`: `buildShift()` builds start/end via `Date.UTC(...)`.
  - `components/shifts/ShiftForm.tsx`: prefill decode passes `timeZone: "UTC"`.
  - `components/shifts/ShiftListItem.tsx`: `formatTime()` passes `timeZone: "UTC"`.
  - `lib/shift-entry.test.ts`: the two day-rollover assertions used local
    `.getDate()`, which only passed because it was coupled to the same bug;
    switched to `.getUTCDate()`.
  *Done when:* entering a time in the shift form and reloading the edit page
  shows the same time back, regardless of the machine's local timezone. Build
  and tests pass.

## Verify

- [x] `npm run build` passes.
- [x] `npm test -- --run` - `lib/shift-entry.test.ts` green (122 tests pass minus
  one pre-existing, unrelated failure in `lib/trends.test.ts` confirmed present
  on `main` before this change).
- [x] `npm run lint` clean on the touched files.
- [x] Round-trip verified directly: `buildShift({ startTime: "13:00", ... })`
  stores `2026-07-11T13:00:00.000Z`; decoding it with the fixed `timeZone: "UTC"`
  formatting returns `13:00` again, run on a machine in `America/Vancouver`
  (UTC-7) to prove the fix no longer depends on ambient timezone.
