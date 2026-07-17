# current-feature

**Title:** One subscription per Stripe customer

**Type:** Fix

## The problem

Nothing stopped a signed-in user from ending up with two live Stripe
subscriptions on the same customer. `checkoutAction` never checked for an
existing subscription before starting a new Checkout session, and Stripe
places no limit on subscriptions per customer by default. The UI only hid the
"Subscribe" button while `status === "active"`, which is a display-only
guard: two browser tabs, a double click, or calling the server action
directly could each start a separate Checkout session. If both completed, the
`checkout.session.completed` webhook only overwrites the single
`stripeSubscriptionId` column on the user's `Subscription` row (`userId` is
unique, one row per user) - so the older subscription would keep running and
billing in Stripe with no record of it left in the app.

## The fix

Three layers, each closing a different window:

1. **App-level guard** (`actions/billing.ts`) - `checkoutAction` reads
   `stripeSubscriptionId` and `status` before creating a Checkout session; if
   a live (non-canceled) subscription is already on file, redirect back to
   `/billing?checkout=already-subscribed` instead of starting a new one.
2. **Stripe-authoritative guard** (`lib/stripe.ts`) - `createCheckoutSession`
   asks Stripe directly (`stripe.subscriptions.list`) whether the customer
   already has a subscription in `active`, `trialing`, `past_due`, or
   `unpaid` status, and throws before creating a session if so. Catches the
   race the DB-only check can miss (stale read, two tabs).
3. **Webhook self-heal** (`app/api/stripe/route.ts`) - in the
   `checkout.session.completed` handler, list the customer's subscriptions
   and cancel any other live ones before syncing the one that just
   completed. Guarantees no customer is left double-billed even if layers 1
   and 2 both lose the race.

Must not break: the existing trial flow (a user who has never checked out
has `stripeCustomerId` set at signup but no `stripeSubscriptionId` yet, and
must still be able to start their first Checkout session), or the portal
flow (`portalAction`, unchanged).

## Build steps

- [x] Add the app-level guard to `checkoutAction` in `actions/billing.ts`:
  select `stripeSubscriptionId` and `status` alongside `stripeCustomerId`,
  redirect to `/billing?checkout=already-subscribed` when a live subscription
  already exists. Covered by `actions/billing.test.ts` (5 cases: unauthenticated,
  blocked while trialing/active with a subscription on file, allowed for a
  never-subscribed trialing user, allowed again once canceled).
  Done when: a user with `stripeSubscriptionId` set and `status !==
  "canceled"` is redirected without a Checkout session being created; a
  trialing user with no `stripeSubscriptionId` yet still reaches Checkout.
- [x] Add the Stripe-authoritative guard to `createCheckoutSession` in
  `lib/stripe.ts`: list the customer's subscriptions and throw if any are
  `active`, `trialing`, `past_due`, or `unpaid`.
  Done when: `createCheckoutSession` throws for a customer with a live
  subscription in any of those four statuses, and still succeeds for a
  customer with none.
- [x] Add self-healing cleanup to the `checkout.session.completed` case in
  `app/api/stripe/route.ts`: list the customer's subscriptions, cancel any
  other than the one just completed that are still `active`, `trialing`, or
  `past_due`.
  Done when: a customer who somehow completes two Checkout sessions ends up
  with exactly one live Stripe subscription and one `stripeSubscriptionId`
  on their `Subscription` row.

## Verify

- `npx tsc --noEmit` clean on the three touched files (unrelated pre-existing
  errors remain in test files outside this fix's scope: `review-shift.test.ts`,
  `session.test.ts`, `shift-session.test.ts`, `shifts.test.ts`,
  `tests/trends.spec.ts`).
- `npx eslint actions/billing.ts lib/stripe.ts app/api/stripe/route.ts` clean
  (2 pre-existing `_formData` unused-var warnings, no errors).
- `npx vitest run` - 197/198 passing; the 1 failure (`lib/trends.test.ts`,
  `formatTrendTotal`) is pre-existing and unrelated. Added
  `actions/billing.test.ts` covering the app-level guard in `checkoutAction`
  (5 cases). The Stripe-authoritative guard and webhook self-heal are
  integration surface against the Stripe API, verified by code review and the
  Stripe CLI, not unit tests.
- Manual: `stripe trigger checkout.session.completed` twice for the same
  customer via the Stripe CLI against `/api/stripe`, confirm only one
  subscription remains `active` afterward.
