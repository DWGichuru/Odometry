# Feature: Deploy to Vercel

**From build-plan:** feature 13
**Status:** not started

## Goal

Deploy GigWise to Vercel for production use. Configure the build to run `prisma migrate deploy` so the database schema stays in sync, document all environment variables, and verify the deployed app works.

## Design reference

None -- this is infrastructure, not UI.

## In scope

- Update the `build` script in `package.json` to run `prisma migrate deploy` before `next build`
- Document all required environment variables for the Vercel project settings
- Create or verify the build command is correctly configured for Prisma + Next.js
- Verify the deployed app loads, auth works, and database queries succeed

## Out of scope

- Setting up a custom domain
- CI/CD beyond Vercel's GitHub integration
- Database backups or failover
- Monitoring (Sentry -- planned for later per the project overview)
- Redis caching (optional, not in MVP)

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Production build configuration**
  Update the `build` script in `package.json` to:
  ```
  "build": "prisma migrate deploy && next build"
  ```
  This ensures the production database schema is migrated before the Next.js build. The `postinstall` script (`prisma generate`) already handles client generation after `npm install`.
  *Done when:* `npm run build` still passes locally (the migrate step is a no-op if schema is already in sync).

- [x] **Step 2 - Environment variables documentation**
  Document all required environment variables. The Vercel project needs these set in Settings > Environment Variables. List each variable and whether it's required:
  - `DATABASE_URL` -- Prisma accelerate connection string (required)
  - `DIRECT_URL` -- Direct PostgreSQL connection for migrations (required)
  - `AUTH_SECRET` -- NextAuth secret (required, generate with `openssl rand -base64 32`)
  - `AUTH_GOOGLE_ID` -- Google OAuth client ID (required for Google sign-in)
  - `AUTH_GOOGLE_SECRET` -- Google OAuth client secret (required for Google sign-in)
  - `AUTH_URL` -- Production URL, e.g. `https://gigwise.vercel.app` (required)
  - `OPENAI_API_KEY` -- OpenAI API key for screenshot/odometer extraction (required for vision features)
  - `STRIPE_SECRET_KEY` -- Stripe secret key (required for subscriptions)
  - `STRIPE_WEBHOOK_SECRET` -- Stripe webhook signing secret (required for subscription sync)
  - `STRIPE_PRICE_ID` -- Stripe price ID for the Pro plan (required)
  *Done when:* The list above is committed to the repo (in `AGENTS.md` or a `DEPLOY.md` note) so it's not lost.

- [ ] **Step 3 - Deploy and verify**
  Deploy to Vercel via CLI (`vercel --prod`) or by pushing to a connected GitHub repo. After deploy:
  - Verify the landing page loads at the production URL
  - Verify sign-in works (Google OAuth)
  - Verify a signed-in user can access the dashboard
  - Verify database queries work (shifts load, trends render)
  *Done when:* The app is live and the core flows (landing → sign-in → dashboard) work in production.

## Files / areas

| File | Action |
|------|--------|
| `package.json` | Update `build` script |
| Env vars | Set in Vercel dashboard (not in repo) |

## Testing

No unit tests for infrastructure. Verification is manual: visit the deployed URL and walk through the core flows.

## Notes for the AI

- `prisma migrate deploy` is safe to run before every build -- it's a no-op when the database is already migrated. It does NOT generate the client (that's `postinstall`'s job) and does NOT create new migrations (that's `prisma migrate dev`'s job).
- The `postinstall` script (`prisma generate`) runs automatically during Vercel's build process after `npm install`.
- If using Vercel's GitHub integration, the deploy triggers automatically on push to `main`. If using CLI, run `vercel --prod` from the repo root after setting env vars.
- Do NOT commit the `.env` file. Environment variables live in Vercel's dashboard.
- The `AUTH_URL` must match the production URL exactly (including `https://`) or NextAuth redirects will fail.
- Google OAuth callback URL must be added in the Google Cloud Console: `https://<domain>/api/auth/callback/google`.
- Stripe webhook endpoint must be configured in the Stripe dashboard: `https://<domain>/api/stripe`.
- Prototypes are NOT consumed by this feature -- they remain in the repo.