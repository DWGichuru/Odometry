# Fix: Live shift start/end timestamps drift by a fixed number of hours

**Type:** Fix

## The problem

A live shift (feature #12, `ShiftSession`) records a duration that's off by a
fixed number of hours (e.g. 5) between its start and end. This is the same
category of bug as `blueprint/history/fixes/04-shift-time-timezone.md`, but a
different pair of clocks.

Root cause: `ShiftSession.startedAt` and `endedAt` are stamped by two different
clocks.

- `startedAt` (`prisma/schema.prisma`) has `@default(now())`, which the
  migration (`prisma/migrations/20260710172647_add_shift_session/migration.sql`)
  turns into `DEFAULT CURRENT_TIMESTAMP` - evaluated **inside Postgres**, using
  whatever timezone the database session happens to be in.
- `endedAt` (`actions/shift-session.ts`, `endShiftSession()`) is set explicitly
  from `const now = new Date()` - Node's clock, always UTC.

When the DB session's timezone isn't UTC, `startedAt` is written offset from
`endedAt` by that timezone's UTC offset. Every place that diffs the two
inherits the skew: the "shift closed" duration and start/end times on
`app/review-shift/page.tsx`, the elapsed timer and "Started" time in
`components/dashboard/LiveBanner.tsx`, and the final `Shift.startTime`/
`endTime` written by `createShiftFromSession()` in `actions/review-shift.ts`
(and everything downstream that reads that shift, e.g. `/shifts`,
`/dashboard`, `/trends`).

## The fix

Set `startedAt` explicitly in `startShiftSession()` (`actions/shift-session.ts`)
from `new Date()`, the same way `endedAt` is already set in `endShiftSession()`,
so both ends of a session come from the same clock regardless of the DB
session's timezone. Left the schema's `@default(now())` in place as a harmless
fallback (no migration needed) - it's now only a safety net, never the source
of truth, since the app always supplies the value explicitly.

Must not break: `cancelShiftSession()` (doesn't touch these fields), the
`shiftSession.create` test expectations in `actions/shift-session.test.ts`
(needed the new `startedAt` field in the expected `data` payload), and the
existing UTC-pinned manual-entry fix (`lib/shift-entry.ts`), which is a
separate code path and untouched by this change.

## Build steps

- [x] **Step 1 - Set `startedAt` explicitly from the app clock**
  - `actions/shift-session.ts`: `startShiftSession()` now captures
    `const now = new Date()` before the `prisma.shiftSession.create()` call and
    passes `startedAt: now` in its `data`, then uses `now` (instead of
    `session.startedAt`) when building the returned `data.startedAt`.
  - `actions/shift-session.test.ts`: updated the `toHaveBeenCalledWith` payload
    assertions that check `shiftSession.create`'s `data` to include `startedAt`,
    pinning the clock with `vi.setSystemTime()`.
  *Done when:* `startShiftSession()` always writes `startedAt` from Node's
  clock; `npm run build` and `npm test -- --run` pass.

## Verify

- [x] `npm run build` passes.
- [x] `npm test -- --run` - `actions/shift-session.test.ts` green (203 total,
  1 pre-existing unrelated failure in `lib/trends.test.ts` confirmed present on
  main before this change).
- [x] `npm run lint` clean on touched files.
- Manual live-shift walkthrough wasn't run: the root cause only manifests when
  the database session's timezone isn't UTC, which a local dev DB typically
  doesn't reproduce (also why the bug was hard to catch in the first place).
  The unit test directly proves the fix by asserting `shiftSession.create()`
  now receives `startedAt` explicitly rather than relying on the DB default.
