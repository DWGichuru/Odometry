# current-feature

## Title

Forgot password

**Type:** Fix

## The problem

Credentials-based accounts (email/password) have no way to recover access if the
password is forgotten. `SignInForm` has no "forgot password" link, and there is
no server action, page, or email template for a reset flow. Only the email
verification flow exists today (`actions/verify-email.ts`, `lib/resend.ts`).

## The fix

Add a standard token-based reset flow, following the existing verification-email
pattern but with its own token table so requesting a reset can never delete or
collide with an in-flight email-verification token (`sendVerificationEmail`
currently does `deleteMany({ where: { identifier: email } })` on the shared
`VerificationToken` table, which a shared table would make unsafe).

- **Schema:** new `PasswordResetToken` model (`id`, `userId` FK to `User`
  cascade-on-delete, `token` unique, `expires`, `createdAt`). Migrated with
  `prisma migrate dev`.
- **Email:** `lib/resend.ts` gets `sendPasswordResetEmail(email, token)`,
  mirroring `sendVerificationEmail`, linking to
  `${NEXT_PUBLIC_URL}/reset-password?token=...`.
- **Server actions** in new `actions/password-reset.ts`:
  - `requestPasswordReset(email)` - always returns the same generic result
    regardless of whether the account exists or is OAuth-only, to avoid leaking
    account existence/auth method. Internally: look up user by email; if a
    `Credential` row exists, apply the same 60s resend cooldown used for email
    verification, delete prior unexpired tokens for that user, create a new
    token (1 hour expiry - shorter than the 24h email-verification token since
    a password reset is higher-stakes), and send the email. If the user or
    credential doesn't exist, do nothing but still report success to the
    caller.
  - `confirmPasswordReset(token, newPassword)` - look up the token, reject if
    missing/expired, enforce the same 8-character minimum used at signup,
    hash with bcrypt, update `Credential.hashedPassword` in a transaction that
    also deletes the token (single-use).
- **Pages/components:**
  - `/forgot-password` (`app/forgot-password/page.tsx` +
    `components/auth/ForgotPasswordForm.tsx`) - email input, calls
    `requestPasswordReset`, shows a generic "check your email" confirmation.
  - `/reset-password` (`app/reset-password/page.tsx` +
    `components/auth/ResetPasswordForm.tsx`) - reads `?token=` from the URL,
    new-password + confirm fields (mirrors `SignUpForm`'s local match check),
    calls `confirmPasswordReset`, then links to `/sign-in` on success.
  - `SignInForm.tsx` - add a "Forgot password?" link near the password field,
    pointing to `/forgot-password`.
- Neither new route is added to `proxy.ts`'s `matcher`, so both stay public
  (matches how `/verify-email` is already public).

**Must not break:** existing email verification flow and its cooldown/token
table; sign-in for OAuth-only users (no `Credential` row - they simply get the
generic response with no email sent).

## Build steps

1. [x] **Schema + email + actions.** Add the `PasswordResetToken` model and run
   `prisma migrate dev`, add `sendPasswordResetEmail` to `lib/resend.ts`, and
   add `actions/password-reset.ts` with `requestPasswordReset` and
   `confirmPasswordReset`.
   Done when: `prisma migrate status` is clean and the two actions compile
   with no logic wired to the UI yet.

2. [x] **Forgot-password page.** Add `/forgot-password` + `ForgotPasswordForm`,
   and the "Forgot password?" link in `SignInForm`.
   Done when: visiting `/forgot-password`, submitting an email shows the
   generic confirmation message, and the link is visible on `/sign-in`.

3. [x] **Reset-password page.** Add `/reset-password` + `ResetPasswordForm`.
   Done when: following a real reset link from the sent email, setting a new
   password, and signing in with it works end-to-end; an expired/invalid/reused
   token shows an error instead of resetting anything.

## Verify

- Request a reset for a real credentials account, receive the email via
  Resend, follow the link, set a new password, sign in with it.
- Re-using the same reset link a second time is rejected (token already
  deleted).
- Requesting a reset for a non-existent email or an OAuth-only account shows
  the same generic confirmation and sends no email.
- Requesting twice within 60 seconds is rate-limited like the verification
  flow.
- `npm run build` passes.
