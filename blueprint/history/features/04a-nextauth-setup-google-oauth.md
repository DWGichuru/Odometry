# Feature: NextAuth v5 setup + Google OAuth + protected routes

**From build-plan:** feature 4a
**Status:** not started

## Goal

Install NextAuth v5, wire the Prisma adapter to the existing database schema, set up Google OAuth sign-in, create a `/sign-in` page, add middleware to protect app routes, and show a header with user identity and sign-out. At the end of this feature, a user can sign in with Google, see their name in the header, and sign out. Unauthenticated visitors are redirected to `/sign-in`.

## Design reference

No prototype for this screen. Follow the existing theme tokens in `app/globals.css` and the visual patterns from the dashboard (card shapes, accent color, typography). The sign-in page is minimal: centered card, Google brand button, clean dark/light responsive layout.

## In scope

- Install `next-auth@beta` (v5) and `@auth/prisma-adapter`
- Create `auth.ts` with PrismaAdapter (using `lib/prisma.ts`), Google provider, and base callbacks
- Create `app/api/auth/[...nextauth]/route.ts` -- exports GET/POST from auth handlers
- Create `middleware.ts` at repo root -- redirects unauthenticated access on `/dashboard` and `/shifts/*` to `/sign-in`, preserves callback URL
- Create `/sign-in` page -- "Shift Recorder" branding, Google sign-in button using `signIn("google", { redirectTo: "/dashboard" })`, error display, redirect after sign-in
- Create `/sign-up` page -- stub that redirects to `/sign-in` with a message "Sign-in required. Create an account by signing in with Google."
- Add header to root layout: conditionally rendered (server-side via `auth()`) -- shows user name/email and a "Sign out" button when authenticated, nothing when not
- Add env vars: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`
- Update `.env.example` with the new vars
- Add `generateAuthSecret` helper for generating `AUTH_SECRET` (recommend `npx auth secret`)

## Out of scope

- Email/password credentials provider (feature 4b)
- `/sign-up` page with registration form (feature 4b)
- Replacing `"mock-user-1"` userId in dashboard or shift form (feature 4c)
- User menu, avatar, profile settings (feature 4c)
- Subscription or payment checks (feature 8)
- Landing page at `/` (feature 9 -- root stays boilerplate, not protected)
- Navigation links between pages (nav bar lands in feature 4c or 9)

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Install Auth.js v5 and create auth infrastructure** -- Install `next-auth@beta` and `@auth/prisma-adapter`. Create `auth.ts` with PrismaAdapter (importing `prisma` from `@/lib/prisma`), Google provider, and callbacks that attach `user.id` to the session token. Create `app/api/auth/[...nextauth]/route.ts` exporting `{ GET, POST }` from the auth handlers. Create `middleware.ts` at repo root that protects `/dashboard` and `/shifts/*` -- unauthenticated requests redirect to `/sign-in?callbackUrl=...`. Add env vars: `AUTH_SECRET` (generate with `npx auth secret`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL=http://localhost:3000`. Update `.env.example`. *Done when:* `npm run build` passes, middleware file compiles, route handler exports correctly. (Google OAuth won't work yet without real credentials, but the code compiles and is structurally correct.)

- [x] **Step 2 - Sign-in page and header** -- Create `app/sign-in/page.tsx` -- centered card with "Shift Recorder" title, "Sign in to your account" subtitle, a Google-branded `signIn("google")` button, and error display for OAuth failures (reads `searchParams.error`). Create `app/sign-up/page.tsx` -- a page that shows a brief message and a link to sign in (stub for 4b). Create `components/auth/UserHeader.tsx` -- a server component that calls `auth()` and conditionally renders: when signed in, shows user name/email + "Sign out" button calling `signOut()`; when not, renders nothing. Integrate `UserHeader` into the root layout (top-right corner). *Done when:* pages render at `/sign-in` and `/sign-up`, the header appears conditionally (shown after sign-in), Google button is wired to `signIn("google")`, and `npm run build` passes.

- [x] **Step 3 - Verify end-to-end and polish** -- `npm run build && npm run lint` clean, `npm test` all existing suites pass. With real Google OAuth credentials in `.env`, test the full flow: visit `/dashboard` -> redirect to `/sign-in` -> click Google button -> sign in -> redirect to `/dashboard` -> see user name in header -> click Sign out -> back to `/sign-in`. Test callback URL preservation (visit `/shifts/new` while signed out -> sign in -> redirect to `/shifts/new`). Verify middleware doesn't block `/sign-in`, `/sign-up`, `/`, or the API route. *Done when:* build/lint/tests green, full sign-in flow works, middleware redirects correctly.

## Files / areas

| File | Action |
|------|--------|
| `auth.ts` | Create -- Auth.js config with Prisma adapter + Google provider |
| `app/api/auth/[...nextauth]/route.ts` | Create -- route handler |
| `middleware.ts` | Create -- route protection |
| `app/sign-in/page.tsx` | Create -- sign-in page |
| `app/sign-up/page.tsx` | Create -- stub page |
| `components/auth/UserHeader.tsx` | Create -- conditional header |
| `app/layout.tsx` | Edit -- add UserHeader |
| `.env` / `.env.example` | Edit -- add auth env vars |
| `package.json` | Edit -- install deps |

## Data / contracts

The session object returned by `auth()` is **load-bearing** for features 4c, 5, 6, 7, and 8. After sign-in:

```typescript
{
  user: {
    id: string;      // maps to User.id (cuid) -- used as userId for Shift queries
    name?: string;
    email?: string;
    image?: string;
  }
}
```

The Prisma adapter reads/writes these tables:
- `User` -- created on first OAuth sign-in with id, name, email, emailVerified, image
- `Account` -- OAuth provider details (Google providerId, access/refresh tokens)
- `Session` -- active session token linked to user
- `VerificationToken` -- not used by Google OAuth, schema exists for email verification in 4b

The `User` table already has all NextAuth-expected fields (id, name, email, emailVerified, image, plus our custom `currency`). The adapter just works.

## Testing

No test runner is needed for UI/integration auth flows. `npm test` verifies existing suites still pass. Verification is behavioral:
- Build + lint pass
- Sign-in with Google works end-to-end
- Middleware redirects unauthenticated requests
- Sign-out works and clears the session

## Notes for the AI

- NextAuth v5 is installed as `next-auth@beta` (currently v5 beta). The import path is `next-auth`, same as v4.
- `@auth/prisma-adapter` exports `PrismaAdapter` -- pass it the `prisma` singleton from `lib/prisma.ts`. The adapter auto-maps to our User/Account/Session/VerificationToken tables.
- Google provider: `import Google from "next-auth/providers/google"`, configured with `clientId` and `clientSecret` from env (or the auto-detected `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`).
- `auth.ts` export: `export const { handlers, auth, signIn, signOut } = NextAuth({ ... })`.
- Middleware: `import { auth } from "@/auth"` then `export default auth((req) => { ... })`. Configure `matcher` to only run on protected routes: `["/dashboard", "/shifts/:path*"]`.
- Sign-in page: use `signIn` from `auth.ts` with `redirectTo` option. The button is a form action or `onClick` calling `signIn("google", { redirectTo: "/dashboard" })`.
- UserHeader: server component. Import `auth` from `@/auth`. Call `const session = await auth()`. When session exists, show a simple text "session.user.name" + a Sign-out form (form action calling signOut server action and redirecting to /sign-in). When no session, render null (or a "Sign in" link on /sign-in page).
- `npx auth secret` can generate AUTH_SECRET and add it to .env. Use this tool.
- The `/api/auth/[...nextauth]` route is a catch-all dynamic route: create `app/api/auth/[...nextauth]/route.ts`.
- Do not protect the API auth route, `/sign-in`, or `/sign-up` in middleware.
- The root page `/` is public (it becomes the landing page in feature 9). Don't protect it yet, but it's fine if middleware doesn't block it.
