# Odometry - Project Overview

> A mobile-first web app that lets gig drivers log each shift, by hand, from a
> screenshot, or by photographing the odometer, and see their earnings combined
> across Uber, Lyft, and DoorDash.

## Problem

Gig drivers have no simple way to see their earnings across platforms. Each app
(Uber, Lyft, DoorDash) shows its own stats in its own place, so a driver can't
tell how many hours, dollars, trips, and kilometers add up across a day, week, or
platform. Odometry consolidates each shift into one place and reports the
totals that matter: time worked, amount earned, trips completed, and distance
covered.

## Users

- **Solo gig drivers** - drive or deliver for Uber, Lyft, and DoorDash, often on
  more than one platform. They log shifts on a phone between trips and want fast
  entry and glanceable totals. Not fleets or accountants.
- **Anonymous visitors** - see the landing page only; everything else requires an
  account.

## Features

In build-plan order. All 16 features are shipped. The **headline feature is
odometer photo shift tracking** (#12): start and end a shift by photographing the
odometer, and type nothing at all.

1. **Dashboard page** - glanceable totals (time, earnings, trips, distance).
2. **Manual shift entry form** - enter a shift's stats in one form.
3. **Database integration** - Prisma + Neon PostgreSQL with the `Shift` model.
4. **Authentication** - NextAuth v5 Google OAuth + email/password; protect the app.
5. **Connect pages to database** - persist shifts scoped to the signed-in user; dashboard reads real data.
6. **Shift management (CRUD)** - list past shifts with edit and delete.
7. **Bottom navigation** - navigation between dashboard, shifts, user profile, and new shift.
8. **Screenshot import** - upload the end-of-shift summary screenshot; OpenAI GPT4-0 mini extracts stats + end odometer, review/edit, then save.
9. **Subscription paywall** - freemium via Stripe: free for the first month, then $3.99/mo; up to 5 lifetime-free users.
10. **Trends page** - charts for total earnings, hours, trips, and km, plus earnings per hour, trip, and km.
11. **Landing page** - public marketing/entry page.
12. **Odometer photo shift tracking** (headline) - photograph the odometer to open a shift and again to close it. The vision model reads each value and the server timestamps it when the photo is processed, so start time, end time, and distance are captured with no typing. The earnings screenshot chains into the end-of-shift flow so every `Shift` field is filled without typing.
13. **Deploy to Vercel** - production deploy with env config and `prisma migrate deploy`.
14. **Email verification on registration** - credentials sign-up sends a verification link via Resend; the account can't sign in until it's clicked. Google sign-ups are auto-verified.
15. **Earnings export** - page linked from trends; pick a month, year, or custom range and download a PDF summary or a CSV of every shift with calculated fields.
16. **AI trend insights** - on request, an AI summary of best times/days to work, ideal shift length, and what's not working. Capped at 5 requests per user per calendar month.

## Data model

Secrets and entitlements are split out of the profile table on purpose: if the
`User` row leaks or is tampered with, no password hash is exposed and no paid
access is granted. `Credential` and `Subscription` each hold one row per user.
NextAuth's adapter tables (`Account`, `Session`, `VerificationToken`) back OAuth,
sessions, and email verification.

### User (profile only)

- `id` (string, cuid) - primary key
- `name` (string, optional)
- `email` (string, unique)
- `emailVerified` (datetime, optional) - set when the verification link is clicked (#14), or at Google sign-up
- `image` (string, optional)
- `currency` (string, ISO 4217, e.g. `USD`) - the driver's chosen currency, applied to shift earnings
- `createdAt` / `updatedAt` (datetime)
- has one `Credential`, has one `Subscription`, has many `Shift`, `ShiftSession`, `Insight`

### Credential (email/password secret)

- `id` (string, cuid) - primary key
- `userId` (string, unique) - FK to `User`, cascade on delete
- `hashedPassword` (string)
- `createdAt` / `updatedAt` (datetime)

> OAuth-only users have no `Credential` row; their login lives in NextAuth's
> `Account` table.

### Subscription (billing + entitlement)

- `id` (string, cuid) - primary key
- `userId` (string, unique) - FK to `User`, cascade on delete
- `freeTrialEndsAt` (datetime) - signup + 1 month; the app-side gate
- `stripeCustomerId` (string, optional, unique)
- `stripeSubscriptionId` (string, optional)
- `status` (enum: `trialing` | `active` | `past_due` | `canceled`)
- `currentPeriodEnd` (datetime, optional) - from Stripe
- `isLifetimeFree` (boolean) - grants permanent free access, capped at 5 users
- `createdAt` / `updatedAt` (datetime)

> Access is granted when `isLifetimeFree` is true, `status` is `active`/`trialing`,
> **or** `now < freeTrialEndsAt`. Both the app (`freeTrialEndsAt`) and Stripe (trial
> subscription) track the free period; the Stripe webhook keeps
> `status`/`currentPeriodEnd` in sync. Lifetime free users skip the paywall entirely.

### Shift

- `id` (string, cuid) - primary key
- `userId` (string) - FK to `User`, cascade on delete
- `date` (date) - the day of the shift
- `platform` (enum: `UBER` | `LYFT` | `DOORDASH`)
- `startTime` (datetime) / `endTime` (datetime) - hours worked = `endTime - startTime`
- `amountEarned` (decimal) - gross earnings for the shift, in the user's `currency`
- `tripsCompleted` (int)
- `startOdometer` (decimal) - reading at shift start, in km
- `endOdometer` (decimal) - reading at shift end, in km
- `distanceKm` (decimal, derived = `endOdometer - startOdometer`)
- `entrySource` (enum: `MANUAL` | `SCREENSHOT` | `ODOMETER`)
- `createdAt` / `updatedAt` (datetime)
- belongs to `User`

> Odometer entry rule: if the driver lacks the start odometer, they enter distance
> covered and `startOdometer` is back-calculated as `endOdometer - distance`. The
> `Shift` shape is locked; features #6, #8, #12, #15, and #16 all read or write
> these fields. Screenshots and odometer photos are processed then discarded, so
> there is no image/file model.

### ShiftSession (an open shift, feature #12)

- `id` (string, cuid) - primary key
- `userId` (string) - FK to `User`, cascade on delete
- `startOdometer` (decimal) - read from the first odometer photo
- `startedAt` (datetime) - set server-side when that photo is processed
- `endOdometer` (decimal, optional) - read from the second photo
- `endedAt` (datetime, optional) - set server-side when that photo is processed
- `status` (enum: `OPEN` | `COMPLETED` | `CANCELLED`)
- `createdAt` / `updatedAt` (datetime)
- belongs to `User`

> **At most one `OPEN` session per driver.** A shift can span hours during which the
> app is closed, so the open shift lives in the database, not client state.
> `startedAt` and `endedAt` become the resulting `Shift`'s `startTime` and `endTime`,
> which is why the driver never types a time.
>
> **Lifecycle.** The second odometer photo moves the session to `COMPLETED`, where it
> stays until the driver reviews and saves, so closing the app mid-review loses no
> reading (the car has moved; it can't be retaken). **Saving writes the `Shift` and
> deletes the session in one transaction**, conditional on it still being
> `COMPLETED`, so a session can be saved only once and a concurrent second save gets
> a conflict instead of a duplicate shift. The `Shift` keeps every reading and
> timestamp, so nothing is lost. Cancelled sessions persist, so `userId` is a plain
> foreign key, not unique; the one-open-session rule is enforced in application code.
>
> Timestamps are recorded server-side at the moment the photo is processed, never
> from the client clock or the image's EXIF data: browsers strip EXIF on re-encode,
> and a client clock cannot be trusted.

### Insight (AI trend insights, feature #16)

- `id` (string, cuid) - primary key
- `userId` (string) - FK to `User`, cascade on delete
- `bestTimes` (string) - best times and days to work
- `idealShiftLength` (string)
- `notWorking` (string) - what's not working
- `createdAt` (datetime) - counted per calendar month to enforce the 5-request cap
- belongs to `User`

> The most recent `Insight` is shown on the trends page load.

## Tech stack

- **Next.js (React 19) + TypeScript** - App Router, server components and server actions
- **Neon PostgreSQL + Prisma ORM** - database and schema/migrations
- **NextAuth v5** - authentication (email/password + Google)
- **OpenAI GPT4-0 mini (vision), via API key** - extract shift stats from earnings screenshots and readings from odometer photos, and generate trend insights; key stays server-side
- **Stripe** - subscription billing for the paywall
- **Resend** - transactional email (verification links)
- **Tailwind CSS v4 + ShadCN** - styling and UI components
- **Vercel** - hosting and deployment
- **Redis** - optional caching, not in the build plan
- **Sentry** - monitoring, planned for later

## Monetization

Freemium subscription billed through Stripe (feature #9):

| Plan | Price      | Timeline                |
| ---- | ---------- | ----------------------- |
| Free | $0         | First month per account |
| Pro  | $3.99 / mo | After the free period   |

## UI/UX

Dark mode first (light mode optional), minimal and fast for phone use between
trips, with clear glanceable numbers over dense tables. Visual inspiration: Uber
(color palette), Notion (organization), Raycast (quick-access patterns), DoorDash
(font and playful icons). The odometer capture and review screens follow the
mockups in `prototypes/`, which share the theme in `prototypes/theme.css`.

Routes:

- `/` - public landing page
- `/sign-in`, `/sign-up` - authentication
- `/verify-email` - email verification link target (#14)
- `/dashboard` - weekly totals, shift list, and the in-progress shift banner
- `/shifts` - shift history; `/shifts/new` manual entry; `/shifts/[id]/edit` edit
- `/import` - screenshot import flow
- `/capture` - odometer camera capture for starting and ending a shift (#12)
- `/review-shift` - review and save a completed shift session (#12)
- `/trends` - charts, plus AI insights (#16)
- `/export` - PDF/CSV earnings export (#15)
- `/profile` - account settings
- `/billing` - subscription management

## Open questions

> Contradictions and gaps found between the two plans and the shipped app.
> Resolve them in the plans, then re-run `/overview`.

1. **`project-plan.md` §3 lists 7 features; `build-plan.md` lists 16.** The plan's
   feature list never mentions database integration, shift CRUD, bottom navigation,
   the paywall, the landing page, the Vercel deploy, email verification, export, or
   AI insights, though monetization (§6) implies the paywall. `build-plan.md` is the
   tracked source of truth, so nothing is blocked, but §3 is a stale subset.

2. **ShadCN is in the stack table but not in the app.** `project-plan.md` §5 names
   Tailwind v4 + ShadCN; `coding-standards.md` records that no component library is
   installed. Either adopt it or drop it from §5.

3. **Shipped capabilities that neither plan records.** The app has these, but no
   plan describes them, so this overview leaves them out of the data model:
   - a `distanceUnit` preference on `User` (km or miles)
   - password reset (`/forgot-password`, `/reset-password`, `PasswordResetToken`)
   - the `/api/v1` REST API for the iOS app (JWT access/refresh tokens)

   Add them to `project-plan.md` (§4 for the data, §3 or `build-plan.md` for the
   features) if they should be part of the source of truth.

4. **Resend and the insights text model aren't in the stack table.** Feature #14
   uses Resend and #16 makes a text-completion call, but `project-plan.md` §5 lists
   OpenAI only for vision and has no email provider.
