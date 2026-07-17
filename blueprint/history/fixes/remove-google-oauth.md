# current-feature

**Title:** Remove Google OAuth

**Type:** Fix

## The problem

The app offered two sign-up/sign-in paths: email/password and Google OAuth
(NextAuth's `Google` provider, via `PrismaAdapter`). Google sign-in is being
dropped so email/password is the only auth method going forward. There are no
existing Google-signed-up users in production, so this is a clean removal with
no account-migration path needed.

## The fix

Remove the Google provider from NextAuth's config and the "Sign in with
Google" UI, then remove the resulting dead code and stale docs. Must not
break: the `Credentials` provider, `PrismaAdapter`, `events.createUser`
(subscription bootstrap), or the `jwt`/`session` callbacks — none of these are
Google-specific and all stay as-is.

Deliberately out of scope: `blueprint/project-plan.md`, `build-plan.md`,
`project-overview.md`, and `blueprint/history/*` still describe Google OAuth
as shipped. Those are Blueprint planning docs meant to go through `/overview`,
not an ad-hoc edit, so they're left alone pending a separate decision.

## Build steps

- [x] Remove the `Google` provider and its import from `auth.ts`.
  Done when: `auth.ts` only configures the `Credentials` provider; `tsc` and
  `eslint` are clean.
- [x] Remove the Google sign-in button, the "or" divider, and the resulting
  dead code from `app/sign-in/page.tsx`: the unused `signIn` import from
  `@/auth`, and the OAuth-only `params.error` banner (credentials errors are
  handled client-side in `SignInForm.tsx` and never reach this page).
  Done when: `app/sign-in/page.tsx` shows only the credentials form; `tsc`
  and `eslint` are clean.
- [x] Update `AGENTS.md` and `README.md`: drop `AUTH_GOOGLE_ID` /
  `AUTH_GOOGLE_SECRET` from both env-var tables and the Google Cloud Console
  line from the dashboard-URL lists.
  Done when: no remaining Google references in either doc.

## Verify

- `npx tsc --noEmit` clean on `auth.ts` and `app/sign-in/page.tsx`.
- `npx eslint auth.ts app/sign-in/page.tsx` clean.
- `npx vitest run` - 192/193 passing; the 1 failure (`lib/trends.test.ts`,
  `formatTrendTotal`) is pre-existing and reproduces identically with these
  changes stashed out, so it's unrelated to this fix.
- `grep -rn "Google\|google" auth.ts app/sign-in/page.tsx components/auth/*.tsx`
  returns nothing.
