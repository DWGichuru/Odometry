# Build Plan

> One of the two planning docs you provide. Write it yourself or with the AI's help.

The features that make up this project, high level and in rough build order, one
line each, no detail (that comes per feature). Rough is fine at first, but before
`/overview` runs this file should be shaped into a checkbox list the build loop
can track.

Keep it as a checklist. Run `/feature` with no number to spec the **next
unchecked** item, or `/feature 3` / `/feature "login"` to pick a specific one.
Completed features get checked off here, so the build plan doubles as your
progress tracker. A big item gets split into sub-items (4a, 4b, etc.) when you
spec it.

Scaffolding the app (create-next-app, etc.) and prototyping the look are
pre-build steps, not features (see the README), so don't list them here. Start
with your first real slice of functionality.

A common order that works well: build the core UI with placeholder data first,
then wire up data, auth, and integrations, and deploy once it's worth shipping.
Adapt it to your project.

## Format

Use checkboxes. Each item should be a feature-sized outcome, not a loose task or
a whole product area.

Good:

- [ ] 1. **Skill submission** - upload a skill package and save its metadata
- [ ] 2. **Validation result** - run checks and show pass/fail status for a skill
- [ ] 3. **Directory listing** - browse and filter published skills

Avoid:

- Upload stuff
- Database
- Make it look nice
- Auth, billing, dashboard, validation, and deploy

If your first pass is just rough bullets, that is okay. Run `/overview` after
filling both planning docs; it will flag plan-shape problems and can propose a
cleaned-up checkbox version before generating the project overview.

## Features

- [x] 1. **Dashboard page** - UI dashboard showing shift statistics (time, earnings, trips, distance) from mock data for now
- [x] 2. **Manual shift entry form** - form to enter hours, earnings, trips, distance, and platform in one go (local state, no persistence yet)
- [x] 3. **Database integration** - set up Prisma + Neon PostgreSQL and the `Shift` model
- [x] 4. **Authentication** - NextAuth v5 Google OAuth + email/password sign-in; protect the app
  - [x] 4a. NextAuth v5 setup + Google OAuth + protected routes
  - [x] 4b. Email/password registration + sign-in
  - [x] 4c. Wire user session to app code
- [x] 5. **Connect pages to database** - persist entered shifts scoped to the signed-in user; dashboard reads real data
- [x] 6. **Shift management (CRUD)** - list past shifts with edit and delete for shift and account data
- [x] 7. **Bottom navigation** - navigation between dashboard, shifts, user profile and new shift
- [x] 8. **Screenshot import** - log the car's start odometer, then upload the end-of-shift summary screenshot; OpenAI GPT-5.4 Nano extracts stats and end odometer; review/edit, then save (distance = end - start)
  - [x] 8a. OpenAI GPT-5.4 Nano integration - API call, response parser, extractShiftFromScreenshot server action
  - [x] 8b. Import flow UI - /import page, file upload, loading state, review/edit form, save flow
- [ ] 9. **Subscription paywall** - freemium gate: free for the first three months, then $3.99/mo via Stripe; 5 lifetime-free users via `isLifetimeFree` flag
  - [x] 9a. Stripe integration - install SDK, product/price config, create Stripe customer + Subscription row at signup
  - [ ] 9b. Paywall gate + billing page - access check middleware, billing UI for users to manage subscription
- [ ] 10. **Landing page** - public marketing/entry page
- [ ] 11. **Deploy to Vercel** - production deploy with env config and `prisma migrate deploy`
