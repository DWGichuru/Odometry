# Shift Recorder - Project Overview

> A mobile-first web app that lets gig drivers log each shift, by hand or from a
> screenshot, and see their earnings combined across Uber, Lyft, and DoorDash.

## Problem

Gig drivers have no simple way to see their earnings across platforms. Each app
(Uber, Lyft, DoorDash) shows its own stats in its own place, so a driver can't
tell how many hours, dollars, trips, and kilometers add up across a day, week, or
platform. Shift Recorder consolidates each shift into one place and reports the
totals that matter: time worked, amount earned, trips completed, and distance
covered.

## Users

- **Solo gig drivers** - drive or deliver for Uber, Lyft, and DoorDash, often on
  more than one platform. They log shifts on a phone between trips and want fast
  entry and glanceable totals. Not fleets or accountants.
- **Anonymous visitors** - see the landing page only; everything else requires an
  account.

## Features

In build-plan order. The **headline feature is screenshot import** (#7): extract a
shift's stats from an earnings screenshot instead of typing them.

1. **Dashboard page** - glanceable totals (time, earnings, trips, distance) from mock data first.
2. **Manual shift entry form** - enter a shift's stats in one form; local state, no persistence yet.
3. **Database integration** - Prisma + Neon PostgreSQL with the `Shift` model.
4. **Authentication** - NextAuth v5 Google OAuth + email/password; protect the app.
5. **Connect pages to database** - persist shifts scoped to the signed-in user; dashboard reads real data.
6. **Shift management (CRUD)** - list past shifts with edit and delete.
7. **Screenshot import** - log start odometer, upload the end-of-shift summary screenshot, OpenAI GPT-5.4 Nano extracts stats + end odometer, review/edit, then save.
8. **Subscription paywall** - freemium via Stripe: free for the first three months, then $3.99/mo.
9. **Landing page** - public marketing/entry page.
10. **Deploy to Vercel** - production deploy with env config and `prisma migrate deploy`.

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
- has one `Credential`, has one `Subscription`, has many `Shift`

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
- `freeTrialEndsAt` (datetime) - signup + 3 months; the app-side gate
- `stripeCustomerId` (string, optional, unique)
- `stripeSubscriptionId` (string, optional)
- `status` (enum: `trialing` | `active` | `past_due` | `canceled`)
- `currentPeriodEnd` (datetime, optional) - from Stripe
- `createdAt` / `updatedAt` (datetime)

> Access is granted when `status` is `active`/`trialing` **or** `now < freeTrialEndsAt`.
> Both the app (`freeTrialEndsAt`) and Stripe (trial subscription) track the free
> period; the Stripe webhook keeps `status`/`currentPeriodEnd` in sync.

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
- `entrySource` (enum: `MANUAL` | `SCREENSHOT`)
- `createdAt` / `updatedAt` (datetime)
- belongs to `User`

> Odometer entry rule: if the driver lacks the start odometer, they enter distance
> covered and `startOdometer` is back-calculated as `endOdometer - distance`. Lock
> the `Shift` shape before feature #5 (persistence): features #1, #2, #6, and #7
> all read or write these fields. Screenshots are processed then discarded, so
> there is no image/file model.

## Tech stack

- **Next.js (React 19) + TypeScript** - App Router, server components and server actions
- **Neon PostgreSQL + Prisma ORM** - database and schema/migrations
- **NextAuth v5** - authentication (email/password + Google)
- **OpenAI GPT-5.4 Nano (vision), via API key** - extract shift stats from screenshots; key stays server-side
- **Stripe** - subscription billing for the paywall
- **Tailwind CSS v4 + ShadCN** - styling and UI components
- **Vercel** - hosting and deployment
- **Redis** - optional caching, not in the MVP build plan
- **Sentry** - monitoring, planned for later

## Monetization

Freemium subscription billed through Stripe (feature #8):

| Plan | Price      | Timeline                       |
| ---- | ---------- | ------------------------------ |
| Free | $0         | First three months per account |
| Pro  | $3.99 / mo | After the free period          |

## UI/UX

Dark mode first (light mode optional), minimal and fast for phone use between
trips, with clear glanceable numbers over dense tables. Visual inspiration: Uber
(color palette), Notion (organization), Raycast (quick-access patterns), DoorDash
(font and playful icons).

Anticipated routes (named as features land; not yet built):

- `/` - public landing page
- `/dashboard` - totals and trends
- `/shifts` - shift history (list, edit, delete)
- `/shifts/new` - manual entry form
- `/import` - screenshot import flow
- `/sign-in`, `/sign-up` - authentication
- `/billing` - subscription management

## Open questions

> None outstanding. Data-model decisions (odometer back-calculation, start/end
> timestamps, per-account currency, split credential/subscription tables, and dual
> app+Stripe trial tracking) are all resolved above. Re-run `/overview` if the
> plans change materially.
