# Fix: Stripe checkout fails with "No such customer" for a stale stripeCustomerId

**Type:** Fix

## The problem

On `/billing`, clicking Subscribe can fail with `Stripe checkout session creation
failed: No such customer: 'cus_...'`.

Root cause: `stripeCustomerId` is created once at signup
(`actions/auth.ts:71-75`) and stored permanently on the user's `Subscription`
row. `checkoutAction` (`actions/billing.ts:29-32`) reads that stored ID and
`createCheckoutSession` (`lib/stripe.ts:41-48`) passes it straight to Stripe's
`checkout.sessions.create` with no check that the customer still exists in
Stripe. If the ID is stale (e.g. the `STRIPE_SECRET_KEY` was swapped between
test/live mode or Stripe accounts since signup, or the customer was deleted in
the Stripe Dashboard), Stripe rejects the whole checkout with `resource_missing`
and the user can never subscribe until a human fixes the database row by hand.

## The fix

Before reusing a stored `stripeCustomerId`, verify it still exists in Stripe. If
it doesn't, create a fresh Stripe customer and persist the new ID on the
`Subscription` row before proceeding, so:

- Checkout succeeds instead of throwing.
- The DB row is corrected going forward (no more manual fixes).
- The Stripe webhook's `checkout.session.completed` handler
  (`app/api/stripe/route.ts:70-71`), which matches on
  `where: { stripeCustomerId: customerId }`, still finds the row - the new ID is
  saved *before* the checkout session is created, not left for the webhook to
  discover.

Must not break: the existing "already has a live subscription" redirect guard,
the brand-new-user path where `stripeCustomerId` was never set (Stripe signup
call failed - `actions/auth.ts:76-79`), or `portalAction`'s use of
`stripeCustomerId` (out of scope for this fix; the portal already requires a
subscription to exist first and is comparatively unlikely to see a filled-in-but-
invalid customer id in normal operation).

## Build steps

- [x] **Step 1 - Add a Stripe customer-existence check and a customer-creation
  helper to `lib/stripe.ts`**
  Added `customerExists(customerId: string): Promise<boolean>` (retrieves the
  customer, returns `false` on a `deleted` customer or a `resource_missing`
  Stripe error, rethrows anything else) and `createCustomer(params: { email?:
  string; name?: string })` (thin wrapper over `stripe.customers.create`,
  mirroring the existing call in `actions/auth.ts:71`). Dropped the now-unused
  `customerEmail` param from `CreateCheckoutSessionParams` / `createCheckoutSession`
  since callers always pass a verified `customerId` now.
  *Done when:* `lib/stripe.ts` exports both helpers; `npm run build` passes.

- [x] **Step 2 - Verify-and-repair the stored customer id in `checkoutAction`**
  In `actions/billing.ts`, after loading `sub` and before calling
  `createCheckoutSession`: if `sub?.stripeCustomerId` is set, calls
  `customerExists`; if it returns `false`, treats the id as missing. If there is
  no valid `customerId` at that point (missing or never set), calls
  `createCustomer` with the session user's email/name, then
  `prisma.subscription.update` to persist the new `stripeCustomerId` on that
  user's row, and uses it for the checkout call. Real failures (network/API
  errors other than a missing customer) still route through the existing
  `alertOnFailure` + rethrow.
  *Done when:* a user whose stored `stripeCustomerId` doesn't exist in Stripe
  can complete checkout without a manual DB fix, and the `Subscription` row
  shows the new id afterward. `actions/billing.test.ts` covers: stale/missing
  customer id triggers `createCustomer` + a `prisma.subscription.update` before
  checkout, and a valid stored customer id skips customer creation entirely.
  `npm test` and `npm run build` pass.

## Verify

- [x] `npm run build` and `npm test` pass (one pre-existing, unrelated failure in
  `lib/trends.test.ts` confirmed present on `main` before this fix).
- [x] Manual/DB check: verified the logic path via unit tests covering a stale
  stored id (`customerExists` returns `false`) triggering `createCustomer` +
  `prisma.subscription.update` before checkout succeeds.
