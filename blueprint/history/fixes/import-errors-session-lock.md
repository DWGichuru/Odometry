# Import error messages and the one-open-session guard

**Type:** Fix

**Source:** review of `blueprint/ios-conversion/api-implementation-guide.md` (items 2 and 7)

## The problem

Two server defects the iOS guide currently works around:

1. **Raw upstream errors reach the driver.** `extractShiftFromScreenshot` and
   `extractOdometerFromPhoto` in `lib/services/extraction.ts` return
   `fail("UPSTREAM_ERROR", e.message)` when the OpenAI call throws. `lib/openai.ts`
   throws messages like `OpenAI API error 500: {raw body}` and
   `OPENAI_API_KEY is not configured`, so the driver sees them: on the web
   (`/capture`, `/import` via `actions/odometer-extract.ts` and `actions/import.ts`)
   and in the iOS app (`502` from `/api/v1/import/*`). Insights and billing already
   return fixed messages.
2. **Two sessions can be open at once.** `startShiftSession` in
   `lib/services/shift-session.ts` runs `findFirst` for an `OPEN`/`COMPLETED`
   session, then `create`, with no lock or constraint. Two concurrent starts (a
   double tap, or a retry while the first request is still running) both pass the
   check and both create an `OPEN` row. `GET /sessions` then returns one at random
   and the other is stranded.

## The fix

**1. Fixed upstream messages.** Replace `e.message` with constants, matching
`lib/services/insights.ts` and `lib/services/billing.ts`:

| Endpoint | Message |
| --- | --- |
| Screenshot | `"Couldn't read that screenshot right now. Try again or enter it manually."` |
| Odometer | `"Couldn't read the odometer right now. Try again or type it in."` |

`alertOnFailure` keeps receiving the original error, so nothing is lost for
debugging.

**2. Serialize starts per driver.** Run the check and the create inside one
interactive `prisma.$transaction`, taking a Postgres transaction-scoped advisory
lock keyed on the user first:

```ts
await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"shift-session:" + userId}))`;
```

A second concurrent start waits for the lock, then sees the first one's row and
returns `CONFLICT` as it does today. The lock is released when the transaction
commits or rolls back.

Why not a partial unique index (`WHERE status IN ('OPEN','COMPLETED')`)? Prisma's
schema can't express it, so `prisma migrate dev` would treat it as drift and try to
drop it. The advisory lock needs no schema change or migration. The client
connects directly through `@prisma/adapter-pg` (`lib/prisma.ts`), so interactive
transactions and raw SQL both work (`createShiftFromSession` already uses one).

Must not break:

- Existing `startShiftSession` behavior: `SUBSCRIPTION_REQUIRED`, `VALIDATION_ERROR`
  for a negative reading, the two `CONFLICT` messages (open vs completed waiting),
  rounding, and `startedAt` stamped from the app clock (fix `d5edf25`).
- `422 UNPROCESSABLE` for unreadable images (only the thrown-call path changes).
- The web capture and import pages, which show the same messages.

## Build steps

- [x] **Step 1 - fixed extraction messages.** Swap both `e.message` returns in
  `lib/services/extraction.ts` for the constants above. Add tests in
  `lib/services/services.test.ts`: when `callOpenAIVision` / `callOpenAIOdometerVision`
  rejects with `OpenAI API error 500: secret body`, the result is `UPSTREAM_ERROR`
  with the fixed message, and it does not contain the thrown text.
  **Done when:** `npm test` is green with those cases, and `npm run build` passes.
- [x] **Step 2 - advisory lock on start.** Move the existence check and `create` in
  `startShiftSession` into `prisma.$transaction(async (tx) => ...)`, taking the
  advisory lock first. Add `$executeRaw` to the test's `mockPrisma` and assert it
  runs before `findFirst`; keep the existing start tests passing.
  **Done when:** `npm test` and `npm run build` pass, and the concurrency check in
  Verify returns one `201` and one `409`.
- [x] **Step 3 - guide cleanup.** In `blueprint/ios-conversion/api-implementation-guide.md`,
  remove the `/import/*` `502` exception in section 4.1 and the matching note in
  section 10.3 (every `502` message is now driver-safe again), and replace the
  check-then-create note in section 6.4 with a plain "the server enforces this; a
  concurrent second start returns `409`".
  **Done when:** the guide has no remaining workaround text for either defect.

## Verify

- `npm test` and `npm run build` are green.
- **Upstream message:** with `OPENAI_API_KEY` unset in a local `.env`, upload a photo
  at `/capture` and a screenshot at `/import`. Each shows the fixed message, not
  `OPENAI_API_KEY is not configured`.
- **Concurrent start:** against `npm run dev`, with a token for a user who has no
  open session, fire two `POST /api/v1/sessions/start` requests at once (for example
  two backgrounded `curl` calls). Expect one `201` and one `409 CONFLICT`, and
  `GET /api/v1/sessions` shows one `open` session. Cancel it afterwards.

## Outcome

- Steps 1-3 built; `npm test` (394) and `npm run build` green.
- The live concurrent-start check (one `201`, one `409`) was not run before merge;
  the advisory-lock ordering is covered by a unit test only.
- The guide edits in step 3 are local only: `blueprint/ios-conversion/` is gitignored.
