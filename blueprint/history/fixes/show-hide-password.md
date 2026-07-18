# current-feature

## Title

Show/hide password toggle

**Type:** Fix

## The problem

All password inputs (`SignInForm.tsx:123`, `SignUpForm.tsx:86,103`,
`ResetPasswordForm.tsx:71,88`) are plain `<input type="password">` with no way
to reveal what was typed. Users can't verify a password before submitting,
which is especially awkward on `SignUpForm`/`ResetPasswordForm` where a typo in
one of the two fields only surfaces as a "passwords do not match" error after
submit.

## The fix

Add one reusable `components/auth/PasswordInput.tsx` client component: an
`<input>` wrapped in a `relative` container with an eye/eye-off toggle button
absolutely positioned inside it. Toggling switches the input's `type` between
`password` and `text` and swaps the icon; the button is `type="button"` so it
never submits the form, and gets an `aria-label` ("Show password" / "Hide
password") since it's icon-only.

- No icon library is installed (`coding-standards.md` notes no component
  library is in the project yet), so the icons are small hand-rolled inline
  SVGs (eye / eye-with-slash) sized to match the existing 15px input text,
  rather than adding a new dependency for two glyphs.
- The component forwards its ref (`React.forwardRef`) and spreads the rest of
  its props onto the underlying `<input>`, so it's a drop-in replacement for
  the existing `<input type="password" ...>` call sites, including the
  uncontrolled-ref pattern `SignUpForm` and `ResetPasswordForm` already use
  for their local password-match check.
- Reuses the existing `inputClasses` string from each form, extended with
  right padding so typed text never sits under the icon button.

Replace all 5 existing `type="password"` inputs with `PasswordInput`:
`SignInForm.tsx` (1), `SignUpForm.tsx` (2, including `minLength={8}`),
`ResetPasswordForm.tsx` (2, including `minLength={8}`).

**Must not break:** the `SignUpForm`/`ResetPasswordForm` client-side
password-match check, which reads `.value` off the forwarded refs; `autoComplete`
hints (`current-password` / `new-password`) already set per field.

## Build steps

1. [x] Add `PasswordInput.tsx` and swap it into all 5 call sites across
   `SignInForm.tsx`, `SignUpForm.tsx`, `ResetPasswordForm.tsx`.
   Done when: on `/sign-in`, `/sign-up`, and `/reset-password`, typing into any
   password field shows an eye icon; clicking it reveals the plaintext and
   swaps to an eye-off icon, clicking again re-masks it. Sign-up's mismatch
   check and sign-in's submit still work unchanged.

## Verify

- `/sign-in`: toggle reveals/hides the password field.
- `/sign-up`: toggle works independently on both password and confirm fields;
  mismatch validation still fires correctly.
- `/reset-password`: toggle works on both fields; submitting a new password
  still works end-to-end.
- `npm run build` passes.
