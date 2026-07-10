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

In build-plan order. Features 1 through 11 are shipped. The **headline feature is
odometer photo shift tracking** (#12, in progress): start and end a shift by
photographing the odometer, and type nothing at all.

1. **Dashboard page** - glanceable totals (time, earnings, trips, distance) from mock data first.
2. **Manual shift entry form** - enter a shift's stats in one form; local state, no persistence yet.
3. **Database integration** - Prisma + Neon PostgreSQL with the `Shift` model.
4. **Authentication** - NextAuth v5 Google OAuth + email/password; protect the app.
5. **Connect pages to database** - persist shifts scoped to the signed-in user; dashboard reads real data.
6. **Shift management (CRUD)** - list past shifts with edit and delete.
7. **Bottom navigation** - navigation between dashboard, shifts, user profile, and new shift.
8. **Screenshot import** - upload the end-of-shift summary screenshot; OpenAI GPT4-0 mini extracts stats + end odometer, review/edit, then save.
9. **Subscription paywall** - freemium via Stripe: free for the first month, then $3.99/mo.
10. **Trends page** - charts and graphs for earnings/hour, earnings/trip, earnings/km, plus totals over time.
11. **Landing page** - public marketing/entry page.
12. **Odometer photo shift tracking** (headline, in progress) - photograph the odometer to open a shift and again to close it. The vision model reads each value and the server timestamps it when the photo is processed, so start time, end time, and distance are captured with no typing.
    - 12a. `ShiftSession` model + migration + start/end server actions (typed values, no camera)
    - 12b. Odometer vision prompt + response parser + plausibility checks
    - 12c. Camera capture and review/confirm UI, plus the in-progress banner
    - 12d. Chain the earnings screenshot into the end-of-shift flow
13. **Deploy to Vercel** - production deploy with env config and `prisma migrate deploy`.

## Data model

Secrets and entitlements are split out of the profile table on purpose: if the
`User` row leaks or is tampered with, no password hash is exposed and no paid
access is granted. `Credential` and `Subscription` each hold one row per user.
NextAuth's adapter tables (`Account`, `Session`, `VerificationToken`) back OAuth
and sessions.

### User (profile only)

- `id` (string, cuid) - primary key
- `name` (string, optional)
- `email` (string, unique)
- `emailVerified` (datetime, optional)
- `image` (string, optional)
- `currency` (string, ISO 4217, e.g. `USD`) - the driver's chosen currency, applied to shift earnings
- `createdAt` / `updatedAt` (datetime)
- has one `Credential`, has one `Subscription`, has many `Shift`, has many `ShiftSession`

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
- `startOdometer` (decimal) - reading at shift start
- `endOdometer` (decimal) - reading at shift end
- `distanceKm` (decimal, derived = `endOdometer - startOdometer`)
- `entrySource` (enum: `MANUAL` | `SCREENSHOT` | `ODOMETER`)
- `createdAt` / `updatedAt` (datetime)
- belongs to `User`

> Odometer entry rule: if the driver lacks the start odometer, they enter distance
> covered and `startOdometer` is back-calculated as `endOdometer - distance`. The
> `Shift` shape is locked; features #6, #8, and #12 all read or write these fields.
> `ODOMETER` is a new `entrySource` member added by feature #12: a shift born from
> two odometer photos is neither manual nor screenshot, and the shift list tags each
> row by origin. Screenshots and odometer photos are processed then discarded, so
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
> **Ending a shift does not destroy the session.** The second odometer photo moves it
> to `COMPLETED`, where it stays until the driver reviews and saves; only then is the
> `Shift` row written. This is what lets the driver close the app mid-review without
> losing a reading they can no longer retake, since the car has moved. Because
> completed and cancelled sessions persist, a driver holds many rows over time, so
> `userId` is a plain foreign key, not unique; the one-open-session rule is enforced
> in application code.
>
> Timestamps are recorded server-side at the moment the photo is processed, never
> from the client clock or the image's EXIF data: browsers strip EXIF on re-encode,
> and a client clock cannot be trusted.

## Tech stack

- **Next.js (React 19) + TypeScript** - App Router, server components and server actions
- **Neon PostgreSQL + Prisma ORM** - database and schema/migrations
- **NextAuth v5** - authentication (email/password + Google)
- **OpenAI GPT4-0 mini (vision), via API key** - extract shift stats from earnings screenshots and readings from odometer photos; key stays server-side
- **Stripe** - subscription billing for the paywall
- **Tailwind CSS v4 + ShadCN** - styling and UI components
- **Vercel** - hosting and deployment
- **Redis** - optional caching, not in the MVP build plan
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
(font and playful icons).

Routes in the app today:

- `/` - public landing page
- `/dashboard` - weekly totals and shift list
- `/trends` - charts and graphs
- `/shifts` - shift history (list, edit, delete)
- `/shifts/new` - manual entry form
- `/import` - screenshot import flow
- `/sign-in`, `/sign-up` - authentication
- `/profile` - account settings
- `/billing` - subscription management

Feature #12 adds camera capture and review screens. Their look is pinned by the
mockups in `prototypes/`, which share the locked theme in `prototypes/theme.css`;
the exact routes and entry point are a spec decision, not a plan decision.

## Open questions

> Contradictions found between the two plans and the work in flight. Resolve them
> in the plans, then re-run `/overview`.

1. **What happens to a `COMPLETED` session after the `Shift` is saved?**
   `project-plan.md` §4 now says the session is kept as `COMPLETED` "until the driver
   reviews and saves," which settles the review window but not the retention after
   it. Options: delete the row once the `Shift` exists, or keep it as a history of
   how the shift was captured. The 12a spec assumes the latter (12d deletes nothing),
   so completed sessions accumulate. Cheap either way, but say which.

2. **`project-plan.md` §3 lists 7 features; `build-plan.md` lists 13.** The plan's
   feature list never mentions database integration, shift CRUD, bottom navigation,
   the subscription paywall, the landing page, or the Vercel deploy, though
   monetization (§6) implies the paywall. `build-plan.md` is the tracked source of
   truth and `/feature` reads it, so nothing is blocked, but §3 is now a stale
   subset of the real scope.

3. **ShadCN is in the stack table but not in the app.** `project-plan.md` §5 names
   Tailwind v4 + ShadCN; `coding-standards.md` records that no component library is
   installed, and the components built so far are hand-rolled. Either adopt it or
   drop it from §5.
