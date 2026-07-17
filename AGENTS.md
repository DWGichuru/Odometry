# AGENTS.md

Claude Code reads this via `CLAUDE.md`. The Blueprint workflow layer (.agents/,
.claude/, blueprint/) is overlaid on top of the app. Never run a framework
scaffolder inside this directory -- it already has scaffold files and will fail.

## Context files (load these every session)

- `blueprint/context/project-overview.md` -- architecture, data model, tech stack
- `blueprint/context/coding-standards.md` -- naming, file layout, patterns
- `blueprint/context/ai-interaction.md` -- workflow loop, commit/branch rules
- `blueprint/context/current-feature.md` -- the one thing being built right now

## Commands

- Dev server: `npm run dev` (http://localhost:3000)
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm test` (Vitest; watch mode: `npm run test:watch`)

## Stack specifics

- Next.js 16 (React 19) with App Router at repo root (no `src/` directory)
- TypeScript strict mode, `@/*` path alias maps to repo root
- Tailwind v4 via `@tailwindcss/postcss` -- CSS-first config in `app/globals.css` (`@theme`), no `tailwind.config.js`
- ESLint v9 flat config (`eslint.config.mjs`)
- Server components by default; `'use client'` only when needed

## Blueprint workflow

Build one feature or fix at a time. Run `$feature` (or `/feature`) to spec from
`blueprint/build-plan.md`, `$implement` to build, `$complete` to merge. Skills
live in `.agents/skills/<name>/SKILL.md` and `.claude/skills/<name>/SKILL.md`.
The `$status` skill shows current progress.

## Environment Variables

Required for Vercel production deployment (set in Settings > Environment Variables):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma Accelerate connection string |
| `DIRECT_URL` | Direct PostgreSQL connection (for `prisma migrate deploy`) |
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `AUTH_URL` | Production URL, e.g. `https://odometry.vercel.app` |
| `OPENAI_API_KEY` | OpenAI API key (vision model for screenshot/odometer extraction) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Stripe price ID for the Pro plan |
| `RESEND_API_KEY` | Resend API key for sending transactional emails |

Third-party dashboard URLs to update with the production domain:

- Stripe Dashboard: `https://<domain>/api/stripe`
