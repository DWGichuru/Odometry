# Wire alertOnFailure into unmonitored failure points

**Type:** Fix

## The problem

`lib/alert.ts` posts to a Slack webhook on failure and is only wired into three
places (`actions/auth.ts`, `actions/password-reset.ts`, `actions/verify-email.ts`).
Everywhere else, failures either throw uncaught (no visibility beyond a generic
error page) or are caught and turned into a user-facing error string with no
backend signal. Two categories of gap:

1. **No try/catch at all** - `actions/shifts.ts`, `actions/shift-session.ts`,
   `actions/review-shift.ts`, `actions/billing.ts`, `actions/profile.ts`, the
   export routes. A Prisma or Stripe error here throws straight to the Next.js
   error boundary; nobody is alerted.
2. **Caught but not alerted** - the Stripe webhook (`app/api/stripe/route.ts`)
   only `console.error`s; the AI vision calls (`actions/odometer-extract.ts`,
   `actions/import.ts`) catch and return a user-facing error but never alert.

Also, `actions/verify-email.ts:48` calls `alertOnFailure(...)` without `await`,
so in a Server Action the call can be dropped before the fetch fires.

## The fix

Follow the existing pattern from `actions/auth.ts`: wrap the failure-prone call,
`await alertOnFailure("<context>", err)`, then preserve the existing
user-visible behavior (rethrow where it currently throws uncaught; return the
existing error shape where one already exists). Don't change validation-error
paths (`{ error: "..." }` returns for bad input/access checks) - only wrap the
Prisma/Stripe/OpenAI calls that can throw for infrastructure reasons.

Must not break: existing return types/signatures of every action, the Stripe
webhook's 200/500 response contract, or the export routes' file download
response.

## Build steps

1. [x] **Payment-critical: Stripe webhook + billing actions**
   - `app/api/stripe/route.ts`: replace `console.error("Stripe webhook error:", e)`
     with `await alertOnFailure("Stripe webhook processing failed", e)`, keep the
     500 response.
   - `actions/billing.ts`: wrap the `createCheckoutSession`/`createPortalSession`
     calls and the "Could not create/open ..." throws in try/catch, alert, rethrow.
   - Done when: both files build, and reading the diff shows the response/throw
     contracts are unchanged.

2. [x] **Core shift data: shifts, shift-session, review-shift**
   - `actions/shifts.ts`: wrap `prisma.shift.create`, `prisma.shift.update`,
     `prisma.shift.delete` each in try/catch, alert with a call-specific context
     string, rethrow.
   - `actions/shift-session.ts`: wrap `prisma.shiftSession.create` (start) and
     the two `prisma.shiftSession.update` calls (end, cancel), same pattern.
   - `actions/review-shift.ts`: wrap `prisma.shift.create`, same pattern.
   - Done when: all three files build; existing `{ error }` returns for
     validation/access-check paths are untouched.

3. [x] **AI extraction + verify-email await fix**
   - `actions/odometer-extract.ts` and `actions/import.ts`: in the existing
     catch block around the OpenAI vision call, add
     `await alertOnFailure("<context>", e)` before returning the existing
     user-facing error.
   - `actions/verify-email.ts:48`: add the missing `await`.
   - Done when: both extraction actions still return the same error shape, and
     `verify-email.ts` awaits the alert.

4. [x] **Export routes + profile**
   - `app/api/export/pdf/route.ts` and `app/api/export/csv/route.ts`: wrap the
     post-auth body in try/catch, alert, return
     `NextResponse.json({ error: "..." }, { status: 500 })` on failure.
   - `actions/profile.ts`: wrap `prisma.user.update` in try/catch, alert, rethrow.
   - Done when: all four files build; export routes still stream the file on
     success.

## Verify

- `npm run build` passes after each step.
- Spot-check one path per step by triggering a failure (e.g. temporarily throw
  inside a wrapped Prisma call) and confirming `alertOnFailure` is invoked -
  either via a log statement or by pointing `SLACK_ALERT_WEBHOOK_URL` at a local
  request-bin during manual testing, then removing the temporary throw.
- Confirm no validation-error return path (`{ error: "You must be signed in." }`
  etc.) was wrapped in an alert - those are expected user errors, not failures.
