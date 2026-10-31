# Odometer shift times shown in UTC on the web

**Type:** Fix

**Source:** `blueprint/ios-conversion/server-fix-queue.md` item 3 (guide ref K4)

## The problem

`Shift.startTime`/`endTime` mean two different things depending on `entrySource`:

| `entrySource` | What is stored | Written by |
| --- | --- | --- |
| `MANUAL`, `SCREENSHOT` | Driver's wall-clock time stored as if it were UTC ("floating time") | `buildShift` in `lib/shift-entry.ts` (`Date.UTC(...)`) |
| `ODOMETER` | A real server instant | `createShiftFromSession` in `lib/services/shift-session.ts` copies `startedAt`/`endedAt` as-is |

Every reader treats the columns as floating and formats in UTC:

- `components/shifts/ShiftListItem.tsx` (`timeZone: "UTC"`)
- `components/shifts/ShiftForm.tsx` (edit form prefill, `timeZone: "UTC"`)
- `lib/export.ts` (PDF/CSV)
- `lib/services/insights.ts` (`getUTCDay()` weekday, hour formatted in UTC)

So an odometer shift started at 5:00 PM Pacific shows as 12:00 AM, lands on the
wrong weekday in insights, and editing it through the form rewrites its instants as
floating time.

## The fix

**Decision: make odometer shifts floating** (option 1 in the queue). Floating time is
what every reader already assumes, so display, export, insights, and the edit form
need no change. "Make all shifts true instants" would need a time zone on manual
entry plus a backfill of every manual and screenshot shift.

**Time zone source: sent on save, not stored on `User`.** The conversion happens once,
at the moment the session becomes a `Shift`, so the client's current IANA zone is the
right one (it is where the driver is) and no schema change or profile setting is
needed.

Approach:

1. New pure helper `toFloatingTime(instant: Date, timeZone: string): Date` in
   `lib/shift-time.ts`. It reads the wall-clock parts of `instant` in `timeZone` via
   `Intl.DateTimeFormat(...).formatToParts` and returns
   `new Date(Date.UTC(y, m - 1, d, h, min, s, ms))`. Plus
   `isValidTimeZone(tz: string): boolean` (try constructing a formatter).
2. `createShiftFromSession(userId, sessionId, fields, timeZone)` stores
   `startTime`/`endTime` as `toFloatingTime(s.startedAt / s.endedAt, timeZone)`.
   When `fields.date` is missing, default `date` to the start's local calendar day in
   that zone (today it uses the server clock, which is UTC on Vercel). Invalid zone
   returns `VALIDATION_ERROR`.
3. Callers pass the zone:
   - Web: `app/review-shift/page.tsx` sends
     `Intl.DateTimeFormat().resolvedOptions().timeZone` through
     `actions/review-shift.ts`.
   - API: `POST /api/v1/sessions/{id}/shift` reads a required `timeZone` string in
     the body (`parseSessionShiftFields` in `lib/api-input.ts`); missing or invalid
     returns `400 VALIDATION_ERROR`. Required, not defaulted to UTC, because a silent
     UTC default reproduces this bug; the iOS app is unreleased, so nothing breaks.
4. One-off backfill for existing `ODOMETER` shifts: `prisma/backfill-odometer-times.ts`
   (run with `tsx`, like the seed). Takes `--tz <IANA zone>` and an optional
   `--user <email>`, defaults to a dry run that prints before/after, and writes only
   with `--apply`. Existing rows carry no zone, so the owner picks it at run time.

Must not break:

- `MANUAL` and `SCREENSHOT` shift creation and editing (untouched).
- Hours worked: `endTime - startTime` stays exact except across a DST change inside
  a shift (off by an hour, same as manual entry today). Acceptable; note it in the
  helper's one-line doc.
- Session screens (`/capture`, `/review-shift`, `LiveBanner`) keep formatting
  `ShiftSession` instants in the browser zone; sessions stay true instants.
- The duplicate-save guard (conditional delete in the transaction) from fix #2.

## Build steps

- [x] **Step 1 - helper + service.** Add `lib/shift-time.ts` with tests
  (`lib/shift-time.test.ts`), and thread `timeZone` through `createShiftFromSession`.
  Extend the service tests in `lib/services/services.test.ts`.
  **Done when:** `npm test` is green, with cases for: a Pacific 17:00 instant becomes
  `...T17:00:00.000Z`; a shift crossing local midnight; a DST date; an invalid zone
  returns `VALIDATION_ERROR` and creates no shift; missing `date` defaults to the
  local day, not the UTC day.
- [x] **Step 2 - callers.** Web review page + server action pass the browser zone;
  API route requires `timeZone`.
  **Done when:** `lib/api-input.test.ts` covers missing/invalid `timeZone` (400) and
  a valid one; `npm run build` passes; saving an odometer shift on the web shows the
  local start/end time on `/dashboard` and `/shifts`.
- [x] **Step 3 - backfill script.** `prisma/backfill-odometer-times.ts`, dry run by
  default.
  **Done when:** a dry run against the dev database lists each `ODOMETER` shift with
  old and new times, and `--apply` updates only `ODOMETER` rows.

## Verify

1. Start a shift on `/capture`, end it, save on `/review-shift`.
2. The start and end times on `/dashboard`, `/shifts`, and `/shifts/[id]/edit` match
   the local clock times of the two photos.
3. Export that month as CSV/PDF: same times.
4. Generate insights (or inspect the prompt in a test): the shift's weekday and hour
   are local.
5. Edit the shift's earnings only and save: times unchanged.

## After `/complete`

- Tick item 3 in `server-fix-queue.md` with the history file name.
- `api-implementation-guide.md`: rewrite 7.2 so every shift is floating (format with
  `TimeZone(identifier: "UTC")`), add `timeZone` to the `POST /sessions/{id}/shift`
  body (`TimeZone.current.identifier`), relax the "don't edit times on `ODOMETER`
  shifts" advice near line 459, and delete K4.
- Run the backfill with `--apply` against production once deployed.

## Outcome

- Steps 1 and 2 shipped as one diff: the new `timeZone` parameter broke the action
  test and the build until the callers passed it.
- The backfill script gained two safeguards found during the dry run:
  - a required `--before <ISO>` cutoff (the deploy time), so shifts saved after
    the fix are not converted;
  - it skips rows whose start and end are both whole minutes. Edits through the
    form or `PATCH` had already rewritten those as wall-clock `HH:MM`, so
    converting them would shift them twice.
- Dev/prod dry run (one user, 25 `ODOMETER` shifts): 12 real instants to convert,
  13 already wall-clock. Created-at times match end times in
  `America/Los_Angeles`, so that is the zone to apply.
- `--apply` has not been run. Run it once after deploy; converted rows keep their
  milliseconds, so a second run would shift them again.
- Not browser-verified at completion; the done-whens rest on unit tests and the build.
