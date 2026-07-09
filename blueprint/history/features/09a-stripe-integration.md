# Feature: Stripe integration

**From build-plan:** feature 9a
**Status:** not started

## Goal

Set up Stripe billing: install the SDK, create a Stripe customer at signup (for both email/password and Google OAuth), store the customer ID on the Subscription row, and create a webhook endpoint to keep subscription status in sync. This prepares the billing foundation for the paywall gate and billing UI (9b).

## Design reference

None -- backend Stripe integration. No visual target.

## In scope

- Install `stripe` npm package
- Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` to `.env.example`
- Create `lib/stripe.ts` with a singleton Stripe client
- Modify `actions/auth.ts` `register`: after creating the user, create a Stripe customer (`stripe.customers.create({ email, name })`), update the Subscription row with the `stripeCustomerId`
- Modify `auth.ts` NextAuth config: add an `events.createUser` callback that creates a Subscription row (3-month trial) + Stripe customer for Google OAuth users (who bypass the `register` action)
- Create `app/api/stripe/route.ts` webhook handler: verify signature, handle `checkout.session.completed` (set status to `active`, store `stripeSubscriptionId`), `customer.subscription.updated` (sync `status` and `currentPeriodEnd`), `customer.subscription.deleted` (set status to `canceled`). Ignore other event types.
- Create `lib/subscription.ts` with a helper `hasAccess(subscription)` that returns true when `isLifetimeFree === true` OR `status === "active"` OR `status === "trialing"` OR `freeTrialEndsAt > now`. This is used by 9b but logging it here so the access rule is defined with the data model.

## Out of scope

- The paywall gate (middleware/route checks that block expired users) -- 9b
- The billing page UI (subscription management for users) -- 9b
- Stripe Checkout session creation (the "Subscribe" flow) -- 9b
- Lifetime free user grant/admin mechanism (the flag exists, granting it is manual for now)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Stripe SDK + subscription at signup** -- Install `stripe` npm package. Create `lib/stripe.ts` exporting a singleton Stripe instance (`new Stripe(process.env.STRIPE_SECRET_KEY!)`). Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` to `.env.example`. Modify `actions/auth.ts` `register`: after the `prisma.user.create`, call `stripe.customers.create({ email, name })`, then `prisma.subscription.update` to set `stripeCustomerId` on the user's subscription. Wrap Stripe calls in try/catch so registration doesn't fail if Stripe is down (log the error, continue without customer ID). Modify `auth.ts`: add an `events.createUser` callback that creates a Subscription row (3-month trial, status trialing) and a Stripe customer for Google OAuth users. Access the `user` object from the event to get email/name. *Done when:* email/password signup and Google sign-in both create a Subscription row with a Stripe customer ID (or continue gracefully if Stripe is unavailable), and build + lint + tests pass.

- [x] **Step 2 - Webhook endpoint + access helper** -- Create `app/api/stripe/route.ts`: export POST handler that reads the raw body (`request.text()`), verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET`, parses the event, and handles the three event types. For `checkout.session.completed`: extract `subscription` ID and `customer` ID from the session, find the Subscription by `stripeCustomerId`, update with `stripeSubscriptionId` and status `active`. For `customer.subscription.updated`: find by `stripeSubscriptionId`, sync `status` and `currentPeriodEnd`. For `customer.subscription.deleted`: find by `stripeSubscriptionId`, set status to `canceled`. Return 200 for handled events, 400 for unhandled. Create `lib/subscription.ts` with `hasAccess(sub: { status, freeTrialEndsAt, isLifetimeFree } | null): boolean` that returns true when `isLifetimeFree` OR `status === "active"` OR `status === "trialing"` OR `freeTrialEndsAt > now`. *Done when:* the webhook endpoint compiles and handles the three event types correctly, the access helper returns correct results for all states, and build + lint + tests pass.

## Files / areas

| File | Action |
|---|---|
| `lib/stripe.ts` | Create -- Stripe client singleton |
| `lib/subscription.ts` | Create -- `hasAccess` helper |
| `app/api/stripe/route.ts` | Create -- webhook handler |
| `actions/auth.ts` | Modify -- create Stripe customer at registration |
| `auth.ts` | Modify -- add `events.createUser` callback |
| `.env.example` | Modify -- add Stripe env vars |
| `package.json` | Modify -- add `stripe` dependency |

## Data / contracts

### hasAccess rules

```ts
function hasAccess(sub: ...): boolean {
  if (sub?.isLifetimeFree) return true;           // lifetime free
  if (sub?.status === "active") return true;      // paid
  if (sub?.status === "trialing") return true;    // in trial
  if (sub?.freeTrialEndsAt > new Date()) return true; // trial not expired
  return false;
}
```

### Stripe webhook events

| Event | Action |
|---|---|
| `checkout.session.completed` | Set `stripeSubscriptionId`, `status = "active"` |
| `customer.subscription.updated` | Sync `status` and `currentPeriodEnd` |
| `customer.subscription.deleted` | Set `status = "canceled"` |

### Stripe customer creation

- Email/password: in `register` action, after `prisma.user.create`, call `stripe.customers.create` and store ID via `prisma.subscription.update`
- Google OAuth: in `events.createUser` callback, call `stripe.customers.create` and `prisma.subscription.create`

## Testing

No new pure-logic functions besides `hasAccess` in `lib/subscription.ts`. Add a test file `lib/subscription.test.ts` covering all access states: lifetime free, active, trialing, trial not expired, expired trial, no subscription (null). The Stripe API calls and webhook are integration-level, verified by build + lint evidence. The existing test suite must stay green.

## Notes for the AI

- The `stripe` package is `stripe` on npm, not `@stripe/stripe-js` (that's the client-side package). Import: `import Stripe from "stripe"`.
- Stripe API version: use the latest stable (`2025-06-16.acacia` or similar). Pin in the Stripe constructor.
- For the webhook: Next.js App Router API routes receive `Request` (Web API). Use `request.text()` to get the raw body for signature verification.
- `events.createUser` in NextAuth receives `{ user }` where `user` has `id`, `email`, `name`. It runs after the user is created in the DB by the Prisma adapter.
- Graceful degradation for Stripe failures at signup: wrap `stripe.customers.create` in try/catch. If it fails, log the error and continue. The user can still use the app during the trial period without a Stripe customer ID (they just can't subscribe later until it's fixed).
- The `STRIPE_PRICE_ID` env var stores the Stripe Price object ID for the $3.99/month Pro plan. This is used in 9b when creating Checkout sessions.
- `lib/subscription.ts` should export both the type shape and the `hasAccess` function. The type is: `{ status: string; freeTrialEndsAt: Date; isLifetimeFree: boolean }`.
