# Feature: Email verification on registration

**From build-plan:** feature 14
**Status:** not started

## Goal

Credentials sign-up (email/password) must be confirmed by clicking a link sent
to the driver's inbox before they can sign in. Google sign-ups are already
verified by Google, so they're marked verified automatically and skip this
entirely. Sent via Resend (`RESEND_API_KEY` already in `.env`); sender address
is `noreply@odometry.app` on a verified Resend domain.

## In scope

- Sending a verification email (Resend) when a credentials account registers.
- A confirmation page that consumes the link's token and marks the account verified.
- Blocking credentials sign-in for an unverified account, with a resend option.
- Auto-verifying Google OAuth sign-ups (no email needed - Google already confirmed the address).

## Out of scope

- Re-verifying email on address change (there's no "change email" feature yet).
- Rate-limiting resend requests beyond token replacement (see Notes).
- Any UI for admins to manually verify a user.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Resend client** - Install the `resend` package. Add `lib/resend.ts`
  with a lazy `getResend()` singleton (same pattern as `lib/stripe.ts`'s
  `getStripe()`) and a `sendVerificationEmail(email: string, token: string)`
  helper that builds the link as `${NEXT_PUBLIC_URL ?? "http://localhost:3000"}/verify-email?token=...`
  and sends from `noreply@odometry.app`. Document `RESEND_API_KEY` in the
  `AGENTS.md` env var table. *Done when:* project builds; `lib/resend.ts` has no
  callers yet so nothing is user-visible.

- [x] **Step 2 - Issue the token at registration** - Add `actions/verify-email.ts`
  with `sendVerificationEmail(email: string)`: generate a token
  (`crypto.randomBytes(32).toString("hex")`), delete any existing
  `VerificationToken` row for that email, create a new one with a 24-hour
  expiry, call the Step 1 helper to send it. Wire into `register()` in
  `actions/auth.ts`: for a new credentials account, stop auto-signing-in and
  redirecting to `/dashboard` - instead call `sendVerificationEmail(email)` and
  return `{ success: true }`. Update `SignUpForm.tsx` to render a "check your
  email" panel when `state.success` is true, instead of expecting a redirect.
  *Done when:* registering a new account shows the check-your-email panel, a
  `VerificationToken` row exists for that email, and the email arrives (confirm
  via Resend's dashboard logs or an inbox).

- [x] **Step 3 - Confirmation page** - Add `app/verify-email/page.tsx`, reading
  `?token=` from the URL. Render a button (not an auto-firing GET action - some
  corporate email scanners prefetch links, which would burn the token before the
  real click) that calls a new `confirmEmailVerification(token: string)` server
  action in `actions/verify-email.ts`: look up the `VerificationToken`, reject if
  missing or past `expires`, otherwise set that user's `emailVerified` to now and
  delete the token. Show success (with a link to `/sign-in`) or a clear
  expired/invalid state. *Done when:* clicking a fresh link marks the account
  verified and the page confirms it; revisiting a used or stale link shows the
  invalid/expired state instead of erroring.

- [x] **Step 4 - Gate sign-in on verification** - In `auth.ts`'s `Credentials`
  provider, after the password check succeeds, if `user.emailVerified` is null
  throw a custom `EmailNotVerifiedError extends CredentialsSignin` (distinct
  `code`) instead of returning the user. Update `SignInForm.tsx` to detect that
  code and show a "please verify your email" message with a resend button that
  calls `sendVerificationEmail` from Step 2. *Done when:* signing in with a valid
  but unverified credentials account is rejected with the verify-email message
  and a working resend button; a verified account signs in as before.

- [x] **Step 5 - Auto-verify Google sign-ups** - In `auth.ts`, override the
  `Google` provider's `profile()` to map `emailVerified: profile.email_verified ? new Date() : null`
  (Google's own claim), so an OAuth sign-up never hits the gate added in Step 4.
  *Done when:* a fresh Google sign-up can reach `/dashboard` immediately with no
  verification step.

## Files / areas

- `lib/resend.ts` - new
- `actions/verify-email.ts` - new
- `actions/auth.ts` - edit `register()`
- `components/auth/SignUpForm.tsx` - edit (check-your-email state)
- `components/auth/SignInForm.tsx` - edit (unverified error + resend)
- `app/verify-email/page.tsx` - new
- `auth.ts` - edit (`Credentials.authorize`, `Google.profile`)
- `AGENTS.md` - edit (env var table)
- `package.json` - add `resend` dependency

## Data / contracts

- No migration: reuses the existing `VerificationToken` model
  (`identifier` = email, `token` = random hex string, `expires` = 24h from send).
- Token format (`crypto.randomBytes(32).toString("hex")`) and 24-hour expiry are
  load-bearing if a later feature (e.g. password reset) wants to reuse this table -
  keep the shape consistent rather than inventing a second convention.
- `User.emailVerified` (already in the schema, previously unused) becomes the
  gate credentials sign-in checks.

## Testing

- `npm test` (Vitest) is the configured runner, so logic-bearing code needs a
  test - but this feature has none of its own: token generation, expiry
  comparison, and email sending are thin wrapping over `crypto` and the Resend
  SDK, and every action here touches Prisma or NextAuth directly, matching how
  `actions/auth.ts` and `actions/*.ts` are already untested elsewhere in this
  codebase (only `lib/` pure functions get unit tests). If a step turns up real
  branching logic worth isolating, extract it to `lib/` and test it then.
- Verify each step by walking the actual flow in the browser: register with
  email/password, confirm the check-your-email panel, retrieve the email
  (Resend dashboard or a real inbox on the verified domain), click the link,
  confirm sign-in now succeeds, and confirm a fresh Google sign-up is never
  gated. Also click an already-used link to see the expired/invalid state.

## Notes for the AI

- `register()` and `confirmEmailVerification` are Server Actions; `auth.ts`
  changes run in the NextAuth config, not a client component.
- Every query stays scoped correctly already (`VerificationToken.identifier`
  is the email itself, `User` lookups by unique email) - no user id to scope by
  here since these run pre-session.
- Resending a token deletes the old one first (Step 2), so only the newest link
  ever works - a cheap substitute for rate-limiting without adding new state.
- Don't perform the verification as a side effect of a plain GET - use a
  button-triggered POST/server action (Step 3) so email-scanner prefetches
  can't burn the token.
- Keep the `EmailNotVerifiedError` code distinct from generic credential
  failures so `SignInForm` can tell "wrong password" from "right password, not
  verified yet" and show the correct message.
