# Saved sessions can be saved again (duplicate shifts)

**Type:** Fix

Source: `blueprint/ios-conversion/server-fix-queue.md` item 2 (guide ref K3).

## The problem

`createShiftFromSession` in `lib/services/shift-session.ts` writes a `Shift` from a
`COMPLETED` session but leaves the session `COMPLETED`. So:

- `getCompletedSession` keeps returning it, and `GET /api/v1/sessions` and the web
  `/review-shift` page keep offering it for review.
- Saving it again creates a duplicate shift.
- Two concurrent saves (a double tap) both pass the `status === "COMPLETED"` check
  and both create a shift, because the check and the create are separate queries.

Callers: `POST /api/v1/sessions/{id}/shift` and the `createShiftFromSession` server
action in `actions/review-shift.ts`. Neither needs to change.

## The fix

**Decision (resolves open question 1 in `project-overview.md`):** delete the session
once its `Shift` is saved. The `Shift` already holds every session field (both
odometer readings and both timestamps, which become `startTime`/`endTime`), and nothing
reads completed sessions except the review lookup, so keeping the row adds nothing.
No migration.

In `createShiftFromSession`, replace the separate `shift.create` with one interactive
`prisma.$transaction`:

1. `tx.shiftSession.deleteMany({ where: { id: sessionId, userId, status: "COMPLETED" } })`
2. If `count === 0`, abort the transaction and return `fail("CONFLICT", ...)`. This is
   the race guard: Postgres row-locks the row on delete, so a concurrent second call
   waits, then deletes nothing, and gets `409` instead of a second shift.
3. Otherwise `tx.shift.create(...)` with the same data as today. If it throws, the
   delete rolls back and the session is still there to retry.

Keep the existing pre-checks (`findUnique`, NOT_FOUND for another driver's session,
CONFLICT for an open session, CONFLICT for missing end data) so their error messages
don't change. The conditional delete is the authority; the pre-check is just for the
message.

Must not break:

- The success response shape `{ success: true, shiftId }`.
- `alertOnFailure` on an unexpected database error (but not on the expected CONFLICT
  abort).
- `cancelShiftSession` and the one-open-session rule (they only touch `OPEN` rows).

## Build steps

- [x] **1. Atomic save-and-delete in `createShiftFromSession`, with tests.** Wrap the
  delete and create in a transaction as above. Add tests in
  `lib/services/services.test.ts` (extend `mockPrisma` with `$transaction` and
  `shiftSession.deleteMany`):
  - a successful save deletes the session and creates exactly one shift;
  - a second save of the same id (delete count 0) returns `CONFLICT` and calls
    `shift.create` zero times;
  - a failing `shift.create` still alerts and rethrows.

  **Done when:** `npm test` and `npm run build` are green, and the new tests pass.

- [x] **2. Record the decision in the plans.** Update the "Shift sessions" bullet in
  `blueprint/project-plan.md` §4 to say the session is deleted once the `Shift` is
  saved, then re-run `/overview` so open question 1 drops out of
  `project-overview.md`.

  **Done when:** `project-overview.md` describes the delete and no longer lists open
  question 1.

## Verify

- Tests above, green under `npm test`.
- Web: start and end a shift, save it on `/review-shift`, then reload the dashboard.
  The review prompt does not come back, and `/shifts` shows one new `ODOMETER` shift.
- API: `POST /api/v1/sessions/{id}/shift` returns `201`; repeating it returns `409
  CONFLICT`; `GET /api/v1/sessions` returns `completed: null` afterwards.

## After `/complete`

Per the queue's instructions:

1. Tick item 2 in `server-fix-queue.md` with the history file name.
2. In `api-implementation-guide.md`, delete K3 and the "Review guard" paragraph in
   8.2 (keep the "disable Save while in flight" advice).
