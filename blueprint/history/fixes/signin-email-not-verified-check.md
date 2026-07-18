# current-feature

## Title

Sign-in checks the wrong field for "email not verified"

**Type:** Fix

## The problem

Any user whose account exists with the correct password but an unverified
email (`User.emailVerified` is `null`) sees the generic "Invalid email or
password." message on `/sign-in` instead of the "verify your email" banner
with a resend button — making it look like a password problem when it isn't.
Changing the password never fixes it, because the password was never wrong.

Root cause, `components/auth/SignInForm.tsx:41`:

```ts
const result = await signIn("credentials", { email, password, redirect: false });
if (result?.error) {
  if (result.error === "email_not_verified") { ... }
```

`next-auth/react`'s `signIn()` (see `node_modules/next-auth/react.js`) always
returns `error` as the generic Auth.js error *type* — `"CredentialsSignin"` for
every credentials failure, whether it's a wrong password or the custom
`EmailNotVerifiedError` thrown in `auth.ts`. The specific reason lives in a
separate `code` field on the same result object (`code: "email_not_verified"`
for that error, since `EmailNotVerifiedError.code` is set to that value). The
form compares the wrong field, so `result.error === "email_not_verified"` is
never true and that branch is dead code.

Confirmed against a real affected account
(`duncan.gichuru@yahoo.com`): `emailVerified` is `null` in the database, and
`new EmailNotVerifiedError().code` is `"email_not_verified"` as expected --
the mismatch is purely the `result.error` vs `result.code` field.

## The fix

In `SignInForm.tsx`, check `result.code === "email_not_verified"` instead of
`result.error === "email_not_verified"`.

Also remove the `alertOnFailure` call currently sitting in the `else` branch
(uncommitted, added ad hoc while debugging this issue) -- left in place it
would fire a Slack alert on every failed sign-in attempt in production
(including ordinary mistyped passwords), which is noise, not an intended
alert.

**Must not break:** the existing generic "Invalid email or password." message
for actual wrong-password attempts; the resend-verification flow once the
banner correctly shows.

## Build steps

1. [x] Fix the field check in `SignInForm.tsx` and remove the ad hoc
   `alertOnFailure` debug call.
   Done when: signing in with the right password on an unverified account
   shows the "Verify your email" banner (not the generic error); signing in
   with a wrong password still shows "Invalid email or password."

## Verify

- Sign in to an unverified account with its correct password -> "Verify your
  email" banner appears, with a working resend button.
- Sign in with a wrong password (any account) -> generic "Invalid email or
  password." still shows.
- `npm run build` passes.
