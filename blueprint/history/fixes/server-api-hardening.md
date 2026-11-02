# Current feature

## Server fixes from the iOS API review (K11 to K16)

**Type:** Fix
**Branch:** `fix/server-api-hardening`
**Source:** `blueprint/ios-conversion/api-implementation-guide.md` section 9

## The problem

Six server defects found while reviewing the iOS API guide. Each is small; they are
combined so the guide's known-issues table can be cleared in one pass.

| ID | Problem | Where |
| --- | --- | --- |
| K11 | The free trial never ends for a driver who never subscribes. Sign-up sets `status: "trialing"`, only Stripe webhooks change it, and `hasAccess` grants access for any `trialing` status regardless of `freeTrialEndsAt`. The web billing page keeps showing "Free trial" after the end date. | `lib/subscription.ts`, `app/billing/page.tsx`, trial banners in `app/dashboard/page.tsx` and `app/shifts/page.tsx` |
| K12 | Shift create/update only checks that `platform`, `date`, `startTime`, `endTime` are present, not their format. Bad values reach `buildShift`/Prisma and return `500`. | `lib/shift-entry.ts` (`validateShiftEntry`) |
| K13 | A `COMPLETED` session can't be discarded, and `/sessions/start` allows a new session while one is waiting, so an older unsaved session resurfaces later. | `lib/services/shift-session.ts`, `app/api/v1/sessions/`, `actions/shift-session.ts`, `app/review-shift/page.tsx` |
| K14 | Screenshot extraction doesn't format-check `date`/`startTime`/`endTime` or round `tripsCompleted`, and an unreadable image returns `200` with every field `null`. | `lib/extract-parser.ts`, `lib/services/extraction.ts` |
| K15 | Stripe failures on checkout and portal are rethrown and return `500 INTERNAL_ERROR`; Stripe's "already has an active subscription" also surfaces as `500`. | `lib/services/billing.ts`, `actions/billing.ts` |
| K16 | `POST /api/v1/shifts` has no idempotency, so a retried request after a timeout can create a duplicate shift. | `app/api/v1/shifts/route.ts` |

## The fix

- **K11:** remove the `status === "trialing"` clause from `hasAccess`. The app-side
  trial is already covered by `now < freeTrialEndsAt`, and Stripe checkout creates
  no Stripe-side trial, so no paying user loses access. On the web, treat a
  `trialing` status whose `freeTrialEndsAt` has passed as "trial ended" (billing page
  shows the subscribe state; trial banners hide once 0 days remain).
- **K12:** `validateShiftEntry` rejects a `platform` outside the `Platform` enum, a
  `date` that isn't a real `YYYY-MM-DD` day, and times not matching
  `^([01]\d|2[0-3]):[0-5]\d$`. Move the date check from `optionalDate` in
  `lib/api-input.ts` into a shared helper both use.
- **K13:** `startShiftSession` returns `CONFLICT` ("Save or discard your last shift
  first.") when a `COMPLETED` session exists. New `discardShiftSession(userId, id)`
  sets a still-`COMPLETED` session to `CANCELLED` via a conditional `updateMany`
  (`NOT_FOUND` if missing or not owned, `CONFLICT` if no longer `COMPLETED`), exposed
  as `POST /api/v1/sessions/{id}/discard` (Sub: yes) and a server action, with a
  confirmed "Discard" button on `/review-shift`.
- **K14:** the parser returns `null` for a malformed `date`, normalizes times to
  `HH:MM` (accepting 12-hour forms like `5:00 PM`), returns `null` for anything else,
  and rounds `tripsCompleted`. `extractShiftFromScreenshot` returns `UNPROCESSABLE`
  ("Couldn't read that screenshot. Try a clearer one or enter it manually.") when
  every extracted field is `null`.
- **K15:** the billing services' `catch` blocks keep `alertOnFailure` but return
  `fail("UPSTREAM_ERROR", "Could not open billing. Try again.")` instead of
  rethrowing; the Stripe "already has an active subscription" error maps to
  `CONFLICT`. `checkoutAction` must branch on `code`: only `CONFLICT` redirects to
  `?checkout=already-subscribed`.
- **K16:** `POST /api/v1/shifts` accepts an optional `id` (must be a UUID, else
  `400`). If a shift with that id exists for this user, return `201` with its
  `shiftId` and create nothing; if it belongs to another user, `409 CONFLICT`. Catch
  Prisma `P2002` on create and resolve it the same way, for two racing requests.
  Omitted `id` keeps today's behavior.

Must not break:

- Lifetime-free users, active subscribers, and users still inside their trial keep
  access.
- Valid manual, screenshot, and odometer shift flows on the web, and full-payload and
  partial `PATCH /shifts/{id}` requests.
- The one-save-per-session guarantee in `createShiftFromSession`.
- Every response keeps the `{ success, data | error, code }` envelope.

## Build steps

- [x] **1. K11 trial expiry** - change `hasAccess`; update `lib/subscription.test.ts`
  (an expired `trialing` sub now has no access); fix the billing page state and the
  dashboard/shifts trial banners.
  Done when: tests pass, and a dev user with `status: "trialing"` and a past
  `freeTrialEndsAt` sees the "trial has ended" state on `/billing` and gets `403
  SUBSCRIPTION_REQUIRED` from `GET /api/v1/shifts`.
- [x] **2. K12 shift input formats** - shared date helper, platform and time checks
  in `validateShiftEntry`, tests in `shift-entry.test.ts`.
  Done when: `POST /api/v1/shifts` with `platform: "TAXI"`, `date: "10/30/2026"`,
  `date: "2026-02-30"`, or `startTime: "5pm"` returns `400 VALIDATION_ERROR`, and
  valid requests still return `201`.
- [x] **3. K15 billing errors** - service changes, `checkoutAction` branch on code,
  tests for both failure codes.
  Done when: tests show a Stripe throw yields `UPSTREAM_ERROR` and the live-sub error
  yields `CONFLICT`; the web checkout only redirects to `already-subscribed` on
  `CONFLICT`.
- [x] **4. K14 screenshot extraction** - parser validation/normalization, all-null
  `UNPROCESSABLE`, tests in `extract-parser.test.ts` and the services test.
  Done when: tests cover a malformed date, `"5:00 PM"` -> `"17:00"`, `"lunch"` ->
  `null`, `7.6` trips -> `8`, and an all-null reply -> `422`; the web `/import` page
  shows the error message instead of an empty form.
- [x] **5. K16 idempotent shift create** - optional `id` on `POST /api/v1/shifts`,
  existing-id and `P2002` handling, route test.
  Done when: sending the same body with the same UUID twice returns the same
  `shiftId` both times and creates one row; a non-UUID `id` returns `400`; another
  user's id returns `409`.
- [x] **6. K13 session discard** - start-blocking check, `discardShiftSession`
  service, `POST /api/v1/sessions/{id}/discard` route, server action, Discard button
  on `/review-shift`, tests.
  Done when: `POST /sessions/start` returns `409` while a `COMPLETED` session exists;
  discard moves it to `CANCELLED` so `GET /sessions` returns `completed: null`; a
  second discard returns `409`; discarding from `/review-shift` returns to the
  dashboard and a new shift can start.
- [x] **7. Docs** - update `api-implementation-guide.md`: delete rows K11 to K16 from
  section 9 and rewrite the workarounds that cite them (4.4 error table, 6.3, 6.4,
  6.5, 6.7, 8.3, 8.4, 8.11, 10.1 `ShiftInput.id`, `discardSession` in 10.6, testing
  checklist). Add K11 to K16 to `server-fix-queue.md` as one ticked item. Record the
  discard and start-blocking rules in `project-plan.md`, then flag `/overview`.
  Done when: no section of the guide refers to K11 to K16, and the guide documents
  the discard endpoint and the `id` field.

## Verify

- `npm test` and `npm run build` pass, plus `npm run lint`.
- Web, as a dev user with an expired trial: `/billing` shows "Your free trial has
  ended" and shift pages are gated.
- Web odometer flow: end a shift, open `/review-shift`, tap Discard and confirm; the
  dashboard has no "finish saving" prompt and "Start shift" works.
- Web import: upload a non-earnings image and see the "Couldn't read that
  screenshot" message.
- API (curl with a Bearer token): the `400`, `409`, and `201` cases in the done-when
  lines for steps 2, 5, and 6.
