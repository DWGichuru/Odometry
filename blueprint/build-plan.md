# Build Plan

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
- [x] 8. **Screenshot import** - log the car's start odometer, then upload the end-of-shift summary screenshot; OpenAI model extracts stats and end odometer; review/edit, then save (distance = end - start)
  - [x] 8a. OpenAI GPT4-0 mini integration - API call, response parser, extractShiftFromScreenshot server action
  - [x] 8b. Import flow UI - /import page, file upload, loading state, review/edit form, save flow
- [x] 9. **Subscription paywall** - freemium gate: free for the first month, then $3.99/mo via Stripe; 5 lifetime-free users via `isLifetimeFree` flag
  - [x] 9a. Stripe integration - install SDK, product/price config, create Stripe customer + Subscription row at signup
  - [x] 9b. Paywall gate + billing page - access check middleware, billing UI for users to manage subscription
- [x] 10. **Trends page** - charts and graphs showings trends in total earnings, hours, trips and kms. Also showing trends in earnings/hour, earnings/trip and earnings/km.
- [x] 11. **Landing page** - public marketing/entry page
- [ ] 12. **Odometer photo shift tracking** - start a shift by photographing the odometer and end it the same way; the vision model reads each reading and the app timestamps it when the photo is processed, so start time, end time, and distance are captured without typing
  - [x] 12a. `ShiftSession` model + migration + start/end server actions (typed odometer values, no camera yet) so one open shift per user survives an app close
  - [ ] 12b. Odometer vision prompt + response parser + plausibility checks (unit, trip-meter confusion, reading continuity against the driver's last shift)
  - [ ] 12c. Camera capture and review/confirm UI for both ends of the shift, plus the in-progress banner on the dashboard
  - [ ] 12d. Chain the earnings screenshot into the end-of-shift flow so every `Shift` field is filled with no typing
- [ ] 13. **Deploy to Vercel** - production deploy with env config and `prisma migrate deploy`
