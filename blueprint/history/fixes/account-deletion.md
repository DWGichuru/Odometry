# Account deletion

**Type:** Fix

**Source:** `blueprint/ios-conversion/server-fix-queue.md` item 4 (guide ref K7)

## The problem

A driver has no way to delete their account. App Store guideline 5.1.1(v) requires
in-app account deletion for any app that allows sign-up, so this blocks the iOS
release. The web app should offer it too.

Related gap: `requireAuth` in `lib/api-auth.ts` only verifies the JWT signature. A
token for a deleted user keeps passing it until expiry, and routes then fail in
inconsistent ways (`404` from `GET /user/profile`, `403 SUBSCRIPTION_REQUIRED` from
gated routes, a `500` from a foreign-key error on create).

## The fix

One service, `deleteAccount(userId, password?)` in `lib/services/account.ts`, shared
by a new `DELETE /api/v1/user` route and a new `deleteAccount` server action.

**Decisions**

| Question | Answer |
| --- | --- |
| Re-authenticate? | Yes, for users with a `Credential` row: the current password is required and checked with `bcrypt.compare`. Google-only users have no password, so the session/token is enough. |
| Stripe | If `Subscription.stripeCustomerId` is set, delete the Stripe customer. That cancels every subscription on it immediately (no further billing) and removes the PII Stripe holds. A `resource_missing` error counts as already gone. |
| Stripe fails | Abort and return `UPSTREAM_ERROR`; never delete the user while they might still be billed. |
| Webhook after delete | `customer.subscription.deleted` will still arrive; `app/api/stripe/route.ts` uses `updateMany`, so a missing row is a no-op. No change needed. |
| Data removal | One transaction: delete `VerificationToken` rows where `identifier = email` (no relation, so no cascade), then delete the `User`. `Credential`, `Subscription`, `Shift`, `ShiftSession`, `Insight`, `Account`, `Session`, `PasswordResetToken` all cascade (checked in `prisma/schema.prisma`). |
| Stale API tokens | `requireAuth` also confirms the user row exists (one primary-key lookup) and returns `401 UNAUTHORIZED` if not, so every `/api/v1` route rejects a deleted user's token the same way. |
| Web | Server action deletes, then `signOut({ redirectTo: "/" })`. Other browsers holding a NextAuth JWT cookie are not force-signed-out (JWT strategy); their pages already redirect when the user row is missing. Out of scope. |

**Service result codes**

- `VALIDATION_ERROR` - password missing for a credentials user
- `UNPROCESSABLE` - password wrong (API maps to `422`; keeps `401` meaning "bad token")
- `NOT_FOUND` - user already gone
- `UPSTREAM_ERROR` - Stripe call failed

**Must not break:** the user can only ever delete themselves (the id comes from
the token or session, never the body); no auth means `401` / `"You must be
signed in."`; existing `/api/v1` behavior for live users is unchanged.

## Build steps

- [x] **1. Backend: service, API route, stale-token check**
  - `lib/stripe.ts`: add `deleteCustomer(customerId)`.
  - `lib/services/account.ts`: `deleteAccount` per the decisions above.
  - `app/api/v1/user/route.ts`: `DELETE`, Bearer auth, optional JSON body
    `{ "password": string }`, returns `{ success: true, data: { deleted: true } }`.
  - `lib/api-auth.ts`: `requireAuth` confirms the user exists.
  - Tests (Vitest, Prisma/Stripe/bcrypt mocked): service happy path with and
    without a Stripe customer; Stripe customer deleted before the user; Stripe
    failure leaves the user in place; `resource_missing` still deletes; wrong or
    missing password rejected; Google-only user needs no password;
    `VerificationToken` cleanup by email. `requireAuth` returns `401` for a valid
    token whose user is gone.
  - **Done when:** `npm test` and `npm run build` pass, and the tests above are green.

- [x] **2. Web: server action and Delete account control on `/profile`**
  - `actions/account.ts`: `deleteAccount(password?)` server action, calls the
    service with `session.user.id`, signs out on success; returns `{ error }`
    otherwise.
  - `components/profile/DeleteAccount.tsx` (client): a danger-styled "Delete
    account" button under Sign out that opens a confirm panel. The driver types
    `DELETE` to enable the final button; credentials users also enter their
    password. Shows the action's error inline.
  - `app/profile/page.tsx`: render it, passing whether the user has a password.
  - Test for the action: unauthenticated rejected, service called with the
    session user id, `signOut` called on success only.
  - **Done when:** the control appears on `/profile`, the final button stays
    disabled until `DELETE` is typed, and a successful delete lands on `/`
    signed out. Build and tests pass.

## Verify

> Status at completion: items 1 and 4 checked by unit tests (Vitest) and the build. Items 2 and 3 (browser delete, Stripe test customer removal) were not run before merge.

1. `npm test` green, `npm run build` passes.
2. Web, credentials user with a Stripe test subscription: delete from `/profile`
   with the right password. Lands on `/` signed out; the Stripe test customer is
   gone; signing in fails; signing up again with the same email works and sends a
   fresh verification email.
3. Web, wrong password: inline error, account still exists.
4. API: `DELETE /api/v1/user` with no token returns `401`; with a valid token and
   password returns `200`; afterwards the same access token on `GET /shifts`
   returns `401`, and `POST /auth/refresh` returns `401 INVALID_TOKEN`.

## After /complete

- Tick item 4 in `server-fix-queue.md` with the history file name.
- `api-implementation-guide.md`: add `DELETE /user` to section 6.2, the client
  flow (confirm, password for credentials users, then clear tokens and return to
  sign-in) to 8.5, and delete K7.
