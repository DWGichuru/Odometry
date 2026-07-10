# Odometry

A mobile-first web app that lets gig drivers log each shift, by hand, from a
screenshot, or by photographing the odometer, and see their earnings combined
across Uber, Lyft, and DoorDash.

Gig drivers juggle separate apps that each show their own numbers in their own
place. Odometry consolidates every shift into one dashboard: hours worked,
amount earned, trips completed, and distance covered, whether the shift was
typed in by hand, imported from an earnings screenshot, or captured with two
odometer photos and no typing at all.

## Features

- **Dashboard** - glanceable totals for time, earnings, trips, and distance
- **Manual shift entry** - log a shift's stats directly
- **Screenshot import** - upload an end-of-shift summary; a vision model extracts the stats
- **Odometer photo tracking** - photograph the odometer to start a shift, again to end it; start/end time and distance are captured automatically
- **Shift history** - list, edit, and delete past shifts
- **Trends** - earnings per hour, per trip, and per km over time
- **Multi-platform** - Uber, Lyft, and DoorDash shifts in one place
- **Auth** - Google OAuth or email/password
- **Subscription** - free for the first month, then a paid plan via Stripe

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (React 19), App Router |
| Language | TypeScript, strict mode |
| Database | Neon PostgreSQL + Prisma ORM |
| Auth | NextAuth v5 (Google OAuth + email/password) |
| Vision extraction | OpenAI GPT-4o mini |
| Billing | Stripe |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel |

## Getting started

```bash
npm install
```

Create a `.env` file with the variables listed below, then run the database
migrations and generate the Prisma client:

```bash
npx prisma migrate dev
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma Accelerate connection string |
| `DIRECT_URL` | Direct PostgreSQL connection (for `prisma migrate deploy`) |
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_URL` | App URL, e.g. `http://localhost:3000` in development |
| `OPENAI_API_KEY` | OpenAI API key (vision model for screenshot/odometer extraction) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Stripe price ID for the paid plan |

See `AGENTS.md` for the production deployment checklist, including the
third-party dashboard URLs (Google Cloud Console, Stripe) that need updating
per environment.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server at localhost:3000 |
| `npm run build` | Run `prisma migrate deploy` then build for production |
| `npm run lint` | Lint the codebase |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## Project structure

- `app/` - routes (App Router, no `src/` directory)
- `components/` - UI components by feature
- `actions/` - Server Actions
- `lib/` - shared utilities
- `prisma/` - schema and migrations
- `blueprint/` - the AI-assisted development workflow this project is built with; see `AGENTS.md` for how it works
