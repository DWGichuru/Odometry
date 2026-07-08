# Feature: Email/password registration + sign-in

**From build-plan:** feature 4b
**Status:** not started

## Goal

Add email/password sign-in to the existing Google OAuth flow. Users can register an account with name, email, and password, then sign in with those credentials. The sign-in page shows both sign-in methods (Google button + email/password form). Registration auto-creates a free-trial Subscription row.

## Design reference

No prototype. Follow existing theme tokens and the visual patterns from the sign-in page created in 4a (centered card, accent buttons, dark/light).

## In scope

- Install `bcryptjs` and `@types/bcryptjs` for password hashing
- Add Credentials provider to `auth.ts` (authorize callback verifies password against `Credential.hashedPassword`)
- Create server action `actions/auth.ts` -- `register()`: validates input, hashes password, creates `User` + `Credential` + `Subscription` (3-month trial from now), signs in the new user
- Replace `/sign-up` stub with a registration form (name, email, password, confirm password) using the `register()` server action
- Add email/password form to `/sign-in` page (below the Google button, with a divider)
- Handle Credentials sign-in errors on `/sign-in` (invalid email, wrong password)
- Handle registration errors on `/sign-up` (email taken, password too short, passwords don't match)

## Out of scope

- Email verification (VerificationToken table exists, sending verification emails is post-MVP)
- Password reset / forgot password flow
- Profile editing (feature 6 maybe)
- OAuth account linking (user who signed up with email/password later adding Google -- post-MVP)

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Backend: password hashing, register action, credentials provider** -- Install `bcryptjs` + `@types/bcryptjs`. Create `actions/auth.ts` with `register()` server action: takes `{ name, email, password }`, validates (name and email required, password >= 8 chars), checks for duplicate email in `prisma.user`, hashes password, creates `User` + `Credential` + `Subscription` (freeTrialEndsAt = now + 3 months), then calls `signIn("credentials", ...)` to sign in the new user and redirects to `/dashboard`. Add `Credentials` provider to `auth.ts` with an `authorize` callback that finds the user by email, loads the `Credential` record, and compares the password with `bcrypt.compare()`. *Done when:* `npm run build` and `npm test` pass.

- [x] **Step 2 - Registration page** -- Replace the `/sign-up` stub with a client form component. Fields: name (text), email (email), password (password, min 8), confirm password (password). Client-side validation (required, passwords match, min length) before calling `register()`. Inline errors. On success, redirects to `/dashboard` via the server action. *Done when:* `/sign-up` renders a working registration form, submitting valid data creates a user in the DB and signs them in, duplicate email shows an error.

- [x] **Step 3 - Add email/password to sign-in page** -- Add a horizontal divider ("or") below the Google button on `/sign-in`. Below it: email and password inputs + "Sign in" submit button, wired to `signIn("credentials", ...)`. After a failed sign-in, show "Invalid email or password" error. The Google button stays above, unchanged. *Done when:* `/sign-in` shows both auth methods, email/password sign-in works, wrong password shows error.

- [x] **Step 4 - Polish and verify** -- `npm run build && npm run lint` clean, `npm test` all suites pass. Manual walkthrough: register a new account at `/sign-up` -> auto-sign-in to `/dashboard` -> sign out -> sign in at `/sign-in` with email/password -> shown the dashboard. Test error cases: duplicate email, mismatched passwords, wrong password. Verify middleware still protects routes. *Done when:* build/lint/tests green, full email/password sign-up and sign-in flow works.

## Files / areas

| File | Action |
|------|--------|
| `actions/auth.ts` | Create -- `register()` server action |
| `auth.ts` | Edit -- add Credentials provider |
| `app/sign-up/page.tsx` | Rewrite -- registration form |
| `app/sign-in/page.tsx` | Edit -- add email/password form |
| `package.json` | Edit -- install bcryptjs |

## Data / contracts

- `Credential` table: `userId` (FK, unique), `hashedPassword` (bcrypt hash)
- `Subscription` table: auto-created on registration with `status: trialing`, `freeTrialEndsAt: now + 3 months`
- The Credentials provider returns `{ id, email, name }` on success, `null` on failure
- The `register()` action returns `{ success: true } | { error: string }` for client-side handling

No schema changes needed -- `Credential`, `User`, and `Subscription` already exist.

## Testing

Vitest is configured. In-scope logic: the `register()` action has validation and DB writes, but it's a server action that depends on Prisma and bcrypt. Test by running the dev server and going through the flow manually. Existing test suites must remain green.

## Notes for the AI

- `bcryptjs` is the pure-JS implementation (no native deps, works everywhere). Import `bcrypt from "bcryptjs"`.
- The Credentials provider's `authorize` callback runs on every sign-in attempt. Hash the incoming password with `bcrypt.compare(password, credential.hashedPassword)`. Return the user object or null.
- `register()` is a server action (`"use server"` directive). It hashes with `bcrypt.hash(password, 10)`. After creating the user, call `signIn("credentials", { email, password, redirect: false })` to establish the session, then redirect.
- The sign-in page email/password form should be a client component. Use `signIn("credentials", { email, password, redirectTo: "/dashboard" })` from `next-auth/react`. Catch the thrown error (CredentialsSignin) for display.
- The divider on sign-in: simple `<hr>` with centered "or" text.
- Registration form is a client component with `useActionState` or plain `onSubmit` calling the server action. Server validation errors return `{ error: string }` displayed as inline errors.
- Auto-sign-in after registration: after creating the user in the DB, call `signIn("credentials", ...)` server-side. If it succeeds, redirect to `/dashboard`. If it fails, return an error.
- Do not add a `'use client'` directive to `auth.ts` -- it stays server-only.
- Existing Google OAuth flow must not break. Test both sign-in paths.
