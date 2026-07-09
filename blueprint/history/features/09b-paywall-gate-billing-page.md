# Feature: Paywall gate + billing page

**From build-plan:** feature 9b
**Status:** not started

## Goal

Enforce the freemium subscription paywall across the app and give users a billing page to manage their subscription. Users on an active trial or paid plan (or lifetime-free) access the app normally; everyone else is redirected to `/billing`. The billing page shows subscription status, trial days remaining, and lets users subscribe ($3.99/mo) or manage their existing subscription via Stripe.

## Design reference

- **Billing page mockup:** `prototypes/billing.html` — covers all 7 subscription states (trialing, trial ending, active, past due, canceled, no subscription, signed out). Build the billing page against this mockup.
- **Theme tokens:** `prototypes/theme.css` is mirrored from `app/globals.css` — all colors, shadows, and radii already exist in the app's `@theme`. No porting needed.

## In scope

- Enrich the JWT token with subscription access info on sign-in so the proxy can enforce the paywall without a database call on every request
- Redirect authenticated users without access to `/billing` from all protected routes
- Enforce access in all server actions (shift CRUD, screenshot import) so expired users cannot create or modify shifts via direct API calls
- Add Stripe Checkout session creation (subscribe) and Billing Portal session creation (manage)
- Fix the webhook handler: use `mapStripeStatus` in `checkout.session.completed`, add `invoice.paid`/`invoice.payment_failed` handlers, add `customer.subscription.trial_will_end` handler
- Create a `/billing` page showing plan info, subscription status, trial days remaining, upgrade/manage buttons
- Add subscription status and trial-remaining info to the profile page
- Add a paywall banner/trial-expiry warning to the dashboard and shifts pages when the trial is within 7 days of expiry

## Out of scope

- Changing the subscription model (pricing, trial length, lifetime-free logic)
- Cancellation flow within the app (Stripe portal handles that)
- Email notifications for trial expiry
- In-app upgrade prompts beyond the billing page and trial-expiry banners
- Admin panel for managing lifetime-free users (manual DB edit for now)
- Grace period after payment failure beyond what Stripe handles

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

## Build steps

- [x] **Step 1 - Enrich JWT with subscription info** — Add `jwt` and update `session` callbacks in `auth.ts` to fetch the user's subscription row on sign-in and store `subscriptionAccess` (boolean) in the token/session. Update the `authorized` callback in `auth.config.ts` to redirect users without access to `/billing`. Note: `/billing` must NOT be added to the proxy matcher (it is a public page). *Done when:* an authenticated user with an expired trial is redirected to `/billing` when visiting `/dashboard`; an authenticated user with access passes through; users visiting `/billing` are never redirected.

- [x] **Step 2 - Enforce paywall in server actions** — Add `hasAccess` check at the top of every server action in `actions/shifts.ts` and `actions/import.ts`. Fetch the user's subscription row, call `hasAccess()`, and return an error if access is denied. *Done when:* calling a shift CRUD action or the import action with an expired trial returns an access-denied error; calling with valid access succeeds.

- [x] **Step 3 - Stripe Checkout and Billing Portal actions** — Create `actions/billing.ts` with `createCheckoutSession` (creates a Stripe Checkout in subscription mode for $3.99/mo, with success/cancel URLs pointing to `/billing`) and `createPortalSession` (creates a Stripe Billing Portal session for the user's `stripeCustomerId`, return URL `/billing`). Add `createCheckoutSession` and `createPortalSession` helpers to `lib/stripe.ts`. *Done when:* the actions succeed when called with a valid authenticated user who has a Stripe customer ID; the portal action errors if the user has no `stripeCustomerId`.

- [x] **Step 4 - Fix webhook handler** — In `app/api/stripe/route.ts`: fix `checkout.session.completed` to use `mapStripeStatus(subscription.status)` instead of hardcoded `"active"`, and set `currentPeriodEnd`. Add handlers for `invoice.paid` (set status to active), `invoice.payment_failed` (set status to past_due), and `customer.subscription.trial_will_end` (no-op — Stripe sends a warning, app-side trial gate already handles it). *Done when:* the webhook handler compiles, uses `mapStripeStatus` consistently, and handles the new event types without errors.

- [x] **Step 5 - Billing page** — Create `app/billing/page.tsx` as a server component, matching `prototypes/billing.html`. The page has two permanent sections (plan card with features + price) and a state-driven section below. States to handle:
  - **Trialing** — status card with badge (blue dot + "Free trial"), trial end date, days remaining, price after trial. "Subscribe to Pro" primary button. Note text: "Cancel anytime..."
  - **Trial ending** (≤7 days) — warning notice banner with triangle icon: "Trial ends in N days" + "Subscribe now to keep logging shifts." Then status card (same fields as trialing). "Subscribe to Pro" primary button.
  - **Active** — status card with green badge "Active", plan name, renewal date. "Manage subscription" secondary (bordered) button. Note text: "Update payment, view invoices, or cancel in the Stripe portal."
  - **Past due** — danger notice banner with circle-X icon: "Payment failed" + "We couldn't charge your card..." Then status card with amber badge "Past due", plan, last attempt date. "Update payment method" primary button (opens Stripe Portal, same as manage).
  - **Canceled** — info notice with clock icon: "Subscription canceled" + "You have Pro access until [date]." Status card with red badge "Canceled", access-until date. "Resubscribe" primary button.
  - **No subscription** (expired trial, never paid) — danger notice with lock icon: "Your free trial has ended" + "Subscribe to Pro to unlock..." "Subscribe to Pro" primary button. Note: "Billed monthly. Cancel anytime."
  - **Signed out** — info notice with arrow icon: "Sign in to subscribe" + "Start with 3 months free..." "Sign in to subscribe" primary button linking to `/sign-in`. Note: "New here? Creating an account starts your free trial."
  - **Lifetime free** — status card with green badge "Lifetime Free". No pricing, no buttons (just status display).
  *Done when:* the billing page renders the correct state for trialing, trial ending, active, past due, canceled, no-subscription, signed-out, and lifetime-free users. Buttons initiate the correct Stripe flows. The page is publicly accessible (no auth guard).

- [x] **Step 6 - Profile subscription display** — Add a "Plan" row to the profile page info card showing the subscription status badge (trialing/active/past_due/canceled) and trial days remaining, plus a link to `/billing`. *Done when:* the profile page shows the user's subscription status and links to the billing page.

- [ ] **Step 7 - Trial expiry banners** — Add a warning notice banner (matching the mockup's `.notice.warn` style: amber background, triangle icon, bold title + body text) to the dashboard and shifts pages when the trial has 7 or fewer days remaining. The banner shows "Trial ends in N days" and links to `/billing`. Extract the notice banner + status badges into a reusable `components/billing/` component so both the billing page and the page banners share the same styles. *Done when:* a user with a trial ending within 7 days sees the banner on dashboard and shifts pages; a user with more than 7 days left or with active/lifetime access does not.

## Files / areas

| File                                  | Action                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `auth.ts`                             | Modify: add `jwt` callback, update `session` callback                              |
| `auth.config.ts`                      | Modify: update `authorized` callback to check subscription access                  |
| `proxy.ts`                            | No change needed — matcher already covers protected routes                         |
| `actions/billing.ts`                  | **Create**                                                                         |
| `lib/stripe.ts`                       | Modify: add `createCheckoutSession` and `createPortalSession`                      |
| `lib/subscription.ts`                 | Read-only (already has `hasAccess`)                                                |
| `app/api/stripe/route.ts`             | Modify: fix bug, add new event handlers                                            |
| `app/billing/page.tsx`                | **Create**                                                                         |
| `components/billing/NoticeBanner.tsx` | **Create** — reusable notice banner (warn/danger/info variants)                    |
| `components/billing/StatusBadge.tsx`  | **Create** — status badge with colored dot (trialing/active/past_due/canceled)     |
| `components/billing/PlanCard.tsx`     | **Create** — plan comparison card (Pro plan, feature list, pricing)                |
| `components/billing/StatusCard.tsx`   | **Create** — subscription status card (key-value rows matching profile page style) |
| `app/profile/page.tsx`                | Modify: add subscription info rows                                                 |
| `app/dashboard/page.tsx`              | Modify: add trial expiry banner                                                    |
| `app/shifts/page.tsx`                 | Modify: add trial expiry banner                                                    |
| `actions/shifts.ts`                   | Modify: add subscription check to create/update/delete                             |
| `actions/import.ts`                   | Modify: add subscription check                                                     |

## Data / contracts

- **JWT token enrichment** — new fields on the token: `subscriptionAccess: boolean`
- **Session enrichment** — new field on `session.user`: `subscriptionAccess: boolean`. Type extension needed on the NextAuth session type.
- **Stripe Checkout** — mode `subscription`, line item price from env var `STRIPE_PRICE_ID`, success URL `/billing?checkout=success`, cancel URL `/billing?checkout=canceled`
- **Stripe Portal** — configuration in Stripe Dashboard, return URL `/billing`
- **Subscription model** — no schema changes; the model already has all needed fields

## Testing

A test runner is configured (`npm test`, Vitest). The `hasAccess` function already has tests. No new pure-logic functions are introduced by the spec steps above — the paywall enforcement is integration-level (proxy redirects, server action guards, UI rendering), so it is verified via build + screenshot evidence, not unit tests.

## Notes for the AI

- The proxy runs on Node.js runtime in Next.js 16, but enriching the JWT token avoids a database call on every proxied request. Store `subscriptionAccess` in the JWT on sign-in (jwt callback) and surface it in the session (session callback). The proxy's `authorized` callback reads it from `auth.user.subscriptionAccess`.
- **Old token edge case:** users with JWT tokens created before this deployment won't have `subscriptionAccess`. In the `authorized` callback, if `subscriptionAccess` is `undefined`, redirect to `/billing` — the user will sign out and back in once, which enriches the token. This is a one-time migration for existing sessions.
- For the NextAuth session type extension, declare a module augmentation for `next-auth` (or `@auth/core/types`) to add `subscriptionAccess: boolean` to the user/session type.
- `hasAccess()` lives in `lib/subscription.ts` and is already tested. Use it everywhere, don't inline the logic.
- The `stripeCustomerId` is set at signup (in `auth.ts` createUser event and `actions/auth.ts` register). It may be null if Stripe was unreachable during signup — handle that case gracefully on the billing page.
- **Missing `STRIPE_PRICE_ID` env var:** the `createCheckoutSession` action must check for it and return a clear error instead of crashing.
- Webhook signature verification must remain the first thing the handler does. Don't move or weaken it.
- The billing page is accessible without auth (visitors see the plan info) but protected actions (checkout, portal) require auth. Redirect unauthenticated users to `/sign-in` when they click subscribe.
- Match existing UI patterns: use the same card component style as the profile page, the same button styles, and the same color tokens from `app/globals.css`.
- Break the billing page into reusable components under `components/billing/`: `NoticeBanner` (warn/danger/info variants with icon + title + body), `StatusBadge` (colored dot + label for trialing/active/past_due/canceled), `PlanCard` (Pro plan features + pricing), `StatusCard` (key-value rows). These are also used by the trial expiry banners on dashboard/shifts.
- The notice banner icons use inline SVGs matching the mockup (triangle for warn, circle-X for danger, clock for info, lock for noccess, arrow for sign-in).
- Server actions return `{ success, data, error }` per coding standards.
- All user-scoped queries filter by the authenticated user's id.
