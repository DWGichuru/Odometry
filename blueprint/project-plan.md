# Project Plan

> One of the two planning docs you provide. Answer each section in a line or two
> (a worksheet, not an essay). Draft it yourself or let the AI help you expand and
> sharpen it; either way, the content is yours to direct. When it's filled in, run
> `/overview` to generate the project overview from this plus `build-plan.md`.

## 1. Problem - What problem are we solving?

Gig drivers have no simple way to see their earnings across platforms. Each app
(Uber, Lyft, DoorDash) shows its own stats in its own place, so a driver can't
tell how many hours, dollars, trips, and kilometers add up across a day, week, or
platform. GigWise lets a driver log each shift, by hand or from a
screenshot, and review combined earning statistics over time: total time worked,
total earned, total trips, and total distance.

## 2. Users - Who is this for?

Gig workers who drive or deliver for Uber, Lyft, and DoorDash, often across more
than one platform at once. Primarily solo drivers tracking their own income on a
phone between trips, not fleets or accountants.

## 3. Features - What does the MVP need?

High level list of features. One line each, don't go into deep detail

- Manual shift entry - record hours, earnings, trips, distance, and platform for a shift
- Screenshot import - extract shift stats from a platform earnings screenshot via vision AI
- Odometer photo shift tracking - photograph the odometer to start a shift and again to end it; vision AI reads each value and the app timestamps it when the photo is processed
- Shift storage - persist each driver's shifts, scoped to their account
- Authentication - quick, secure sign-in (email + Google)
- Dashboard - totals and trends across shifts (time, earnings, trips, distance)
- Trends - charts and graphs showings trends in total earnings, hours, trips and kms. Also showing trends in earnings/hour, earnings/trip and earnings/km.

## 4. Data - What are we storing?

List of data that will be stored eg. users, products, stats

Separate secrets and entitlements from the profile so a leak or tamper of the
user row does not expose credentials or grant paid access.

- **Users** - profile only: name, email, image, preferred currency
- **Credentials** - email/password hash, in its own table linked to the user
  (OAuth logins live in NextAuth's `Account` / `Session` tables)
- **Subscriptions** - Stripe customer/subscription ids, plan status, and
  free-trial end date, in its own table linked to the user
- **Shifts** - date, platform, start and end time (hours worked derived), amount
  earned, trips completed, start odometer and end odometer (distance derived as
  end - start, in km; if the driver doesn't have the start odometer, they enter
  distance covered and the start odometer is back-calculated), and entry source
  (manual, screenshot, or odometer photo)
- **Shift sessions** - one open shift per driver, holding the start time and start
  odometer between the two odometer photos. A shift can span hours during which the
  app is closed, so the open shift lives in the database, not client state. Ending
  the shift turns the session into a `Shift` row and keeps it as COMPLETED until the driver reviews and saves.

> Timestamps for odometer photo tracking are recorded server-side at the moment the
> photo is processed, not from the client clock or the image's EXIF data (browsers
> strip EXIF on re-encode and a client clock can't be trusted).

## 5. Tech - What stack are we using?

| Category    | Choice                                                                          |
| ----------- | ------------------------------------------------------------------------------- |
| Framework   | **Next.js (React 19)**                                                          |
| Language    | TypeScript                                                                      |
| Database    | Neon PostgreSQL + Prisma ORM                                                    |
| AI / Vision | OpenAI GPT4-0 mini (vision) via API key, for screenshot and odometer extraction |
| Caching     | Redis (optional)                                                                |
| CSS/UI      | Tailwind CSS v4 + ShadCN                                                        |
| Auth        | NextAuth v5 (email + Google)                                                    |
| Payments    | Stripe (subscriptions)                                                          |
| Deployment  | Vercel                                                                          |
| Monitoring  | Sentry (later)                                                                  |

> Screenshots and odometer photos are processed for extraction and not stored, so
> the MVP needs no object storage.

## 6. Monetize - How will this make money?

Freemium subscription billed through Stripe: free to start, then a flat monthly fee.

| Plan | Price      | Timeline              |
| ---- | ---------- | --------------------- |
| Free | $0         | First month of use    |
| Pro  | $3.99 / mo | After the free period |

## 7. UI/UX - How should this look and feel?

- Dark mode first, light mode as an option
- Minimal and fast: built for quick logging on a phone between trips
- Clear, glanceable numbers on the dashboard over dense tables

Design inspiration:

| Source                           | What to borrow         |
| -------------------------------- | ---------------------- |
| [Uber](https://uber.com)         | Color palette          |
| [Notion](https://notion.so)      | Clean organization     |
| [Raycast](https://raycast.com)   | Quick-access patterns  |
| [DoorDash](https://doordash.com) | Font and playful icons |
