# Feature: Dashboard page

**From build-plan:** feature 1
**Status:** complete

## Goal

A `/dashboard` page that shows the driver's aggregate shift statistics (time, earnings, trips, distance) at a glance, backed by mock data. This establishes the visual tone of the app -- dark mode first, mobile-first, Uber-inspired palette, minimal layout with prominent numbers.

## Design reference

**Prototype:** `prototypes/dashboard-v2.html` -- the full dashboard mockup: hero weekly-earnings card (big total, trend chip, daily bar chart, platform split bar), three average-rate stat tiles ($/hour, $/trip, $/km) with the totals as sub-lines, shift list, bottom nav, and light/dark mode toggle.

**Theme tokens:** `prototypes/theme.css` -- the source of truth for colors, type, spacing, and platform badges. Port this into `app/globals.css` `@theme` as step 1.

- **Dark mode first**, light mode via toggle
- **Blue accent** (#3B82F6 / #2563EB) on clean dark/light surfaces
- **Glanceable numbers** over dense tables -- large stat cards with small labels
- **Mobile-first** -- full-width hero card, rate tiles 3-up at every width, bottom nav bar

## In scope

- `/dashboard` page -- a hero card with the week's total earnings (daily bar chart + platform split bar), three average-rate stat cards ($/hour, $/trip, $/km with the totals as sub-lines), plus a summary shift log showing the underlying mock shifts
- TypeScript `Shift` type with all fields from the data model (load-bearing for features 2, 5, 6, 7)
- Mock shift data (2-3 shifts across different platforms) with a pure function to compute aggregates
- Dark-first theme tokens in `@theme` (`globals.css`) -- blue accent, surface/card backgrounds, muted text
- Stat card component (`components/dashboard/StatCard.tsx`)
- Dashboard page component (`app/dashboard/page.tsx`)
- Update root layout metadata to "Shift Recorder" (replace the boilerplate)

## Out of scope

- Navigation, header, or sidebar (belongs to auth feature #4 or landing page #9)
- The landing page at `/` (feature #9 -- root stays as boilerplate for now)
- Manual shift entry form (feature #2)
- Database, Prisma, or real persistence (feature #3)
- Authentication or route protection (feature #4)
- Real data fetching from the database (feature #5)
- Edit/delete of shifts (feature #6)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 -- Theme tokens and Shift type + mock data** -- Add dark-first theme tokens (blue accent, surface, muted) to `@theme` in `app/globals.css`. Define `Shift` and `Platform` types in `types/shift.ts` matching every field from the data model. Create `lib/mock-data.ts` with 2-3 mock shifts across different platforms and a pure `computeShiftStats(shifts)` function that returns total hours, total earnings, total trips, and total distance. *Done when:* `npm run build` passes with no errors, and the types export successfully at compile time.

- [x] **Step 2 -- Hero card, rate tiles, and dashboard page** -- Create `components/dashboard/StatCard.tsx` (a small `'use client'` component, accepts `label: string`, `value: string`, `backLabel: string`, `backValue: string`; renders a dark-surface card with large value text that flips left-to-right on click to reveal the total on its back face). Create `app/dashboard/page.tsx` -- a server component that imports mock data, computes stats, and renders: a page heading ("Dashboard"), a hero card with the week's total earnings, daily earnings bar chart, and platform split bar (all plain CSS sized from the mock data, per `prototypes/dashboard-v2.html`), three `StatCard` components in a 3-column grid showing average $/hour, $/trip, and $/km with the totals (hours, trips, distance) as sub-lines, and a "Recent shifts" section below listing each mock shift's date, platform, times, trips, distance, and earnings. Update `app/layout.tsx` metadata to `title: "Shift Recorder"` and `description: "Log your rideshare and delivery shifts across platforms."`. *Done when:* `/dashboard` matches `prototypes/dashboard-v2.html`: the hero shows the correct weekly total and platform split, the three rate cards show correctly derived averages, the shift log is visible, the page is responsive, and dark mode looks correct.

- [x] **Step 3 -- Polish and verify** -- Run `npm run build && npm run lint` and fix any warnings. Start the dev server and visually verify the dashboard on a mobile viewport (phone) and desktop. Verify dark mode via system preference toggle. Verify the mock data totals are arithmetically correct. *Done when:* build and lint pass clean, the page looks good on both mobile and desktop viewports, and dark mode renders with the correct surface/background tokens.

## Files / areas

| File | Action |
|------|--------|
| `app/globals.css` | Add `@theme` tokens (blue accent, surface, muted) |
| `types/shift.ts` | Create -- `Platform` enum and `Shift` interface |
| `lib/mock-data.ts` | Create -- mock shifts and `computeShiftStats()` |
| `components/dashboard/StatCard.tsx` | Create |
| `app/dashboard/page.tsx` | Create |
| `app/layout.tsx` | Edit -- update metadata |

## Data / contracts

The `Shift` type is **load-bearing** -- features 2 (manual entry), 5 (persistence), 6 (CRUD), and 7 (screenshot import) all read or write these fields. Lock it now:

```typescript
export enum Platform {
  UBER = "UBER",
  LYFT = "LYFT",
  DOORDASH = "DOORDASH",
}

export enum EntrySource {
  MANUAL = "MANUAL",
  SCREENSHOT = "SCREENSHOT",
}

export interface Shift {
  id: string;
  userId: string;
  date: string; // ISO date string
  platform: Platform;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  amountEarned: number;
  tripsCompleted: number;
  startOdometer: number;
  endOdometer: number;
  distanceKm: number;
  entrySource: EntrySource;
  createdAt: string;
  updatedAt: string;
}
```

All server components except `StatCard`, which is `'use client'` for the click-to-flip toggle (a single `useState` boolean; the flip itself is CSS 3D transforms).

## Testing

No test runner is configured (`AGENTS.md` has no `test` command). Verification relies on:

- `npm run build` passing clean (catches type errors and dead code)
- `npm run lint` passing clean
- Visual verification: dev server + browser screenshots at mobile and desktop viewports, dark and light modes

No logic-bearing functions that need unit tests at this stage (`computeShiftStats` is pure arithmetic and will be replaced by a real DB query in feature #5; testing it now would be brittle throwaway work).

## Notes for the AI

- Server components everywhere except `StatCard` (`'use client'` for the flip toggle); the page itself stays a server component
- Match the `Shift` fields exactly to the project overview data model (do not rename or omit)
- Mock data: use at least two different platforms (e.g. Uber and DoorDash) to prove the aggregate function works across platforms
- `computeShiftStats` computes hours from `endTime - startTime`, distance from `endOdometer - startOdometer` (match the derived fields in the data model)
- Derive the rate averages ($/hour, $/trip, $/km) and the hero's per-day and per-platform groupings at render time from the totals and mock shifts; `computeShiftStats` keeps returning the four totals. Guard against divide-by-zero when a total is 0
- The hero's bar chart and platform split bar are plain CSS (heights/widths computed from the data) -- no chart library, no client component
- Tailwind v4 is CSS-first: tokens live in `@theme inline { ... }` in `globals.css`, not a config file
- Dark mode tokens should reference the existing `prefers-color-scheme` media query pattern -- do not switch to class-based dark mode
- Currency formatting: for now, hardcode `$` prefix -- per-account currency (from the `User.currency` field) is feature #5
- The `public/next.svg`, `public/vercel.svg`, etc. are boilerplate -- leave them alone, they get cleaned up when the landing page replaces them
