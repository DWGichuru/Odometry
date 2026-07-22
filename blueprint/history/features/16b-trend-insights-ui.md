# Feature: AI trend insights - trends page UI

**From build-plan:** feature 16b (part of 16, split from the original single item)
**Status:** complete

## Design reference

`prototypes/trends.html` (linked theme: `prototypes/theme.css`) - the full
`/trends` page with the new "Insights" card leading the page, above the
existing Rates/Totals sections (insights are the headline feature here, so
they come first, not last). Use the prototype-only state switcher at the top
of the page to preview all five states the real component must support:
empty, loading, populated, exhausted, and error.

**Note for the build step:** `theme.css` here is not a new theme - it's a
verbatim copy of the tokens already shipped in `app/globals.css` (this app's
look was locked long before this feature). There is nothing to port; skip any
"port theme.css into the app" step. Build `TrendInsights.tsx` to match the
card's markup/spacing/copy in the mockup, using the app's real Tailwind
classes and existing CSS variables (`bg-surface`, `border-border`,
`shadow-md`, `text-accent`, etc.), not the mockup's plain CSS.

## Goal

Give the driver a way to request an insight from the trends page and see the
result: best times to work, ideal shift length, and what's not working, plus
how many requests they have left this month. User-facing copy says
"Insights"/"Get insights", never "AI" - this wires the 16a backend
(`generateTrendInsights`, `getInsightsStatus`) into the UI; no new server
logic.

## In scope

- `components/trends/TrendInsights.tsx` - client component: a "Get insights"
  button, a quota indicator ("X of 5 left this month"), the three-field
  result display, a loading state while the request is in flight, and an
  inline error state for any `{ error }` the action returns (cap reached,
  too few shifts, generation failure) without discarding a previously shown
  result.
- Wiring into `app/trends/page.tsx`: server-fetch `getInsightsStatus()`
  alongside the existing shift query, pass the initial quota and latest
  insight (if any) into `TrendInsights` so the most recent insight shows on
  load with no extra round trip.

## Out of scope

- Any change to `generateTrendInsights`/`getInsightsStatus` themselves (16a
  is done and merged).
- Insight history browsing (list of past insights) - only "the most recent
  one" per the locked 16a contract.
- Editing or deleting insights.
- Client-side pre-check of the 5-shift minimum - the button always attempts
  the request; the server's `{ error }` message covers that case inline.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `TrendInsights` client component** - add
  `components/trends/TrendInsights.tsx` (`"use client"`), taking
  `initialRemaining: number` and `initialLatest: InsightData | null` as props.
  States: quota text ("3 of 5 insights left this month" / "You've used all 5
  insights this month - they reset next month" when `remaining === 0`); the
  latest insight's three fields rendered as labeled blocks ("Best times to
  work", "Ideal shift length", "What's not working") when present, else a
  short empty-state line ("Get insights on your shift history."); a
  "Get insights" button (disabled while loading or while `remaining === 0`,
  loading label "Generating..."); on click, call `generateTrendInsights()`,
  and on success replace the displayed insight and `remaining` with the
  response, on error show the returned message in an inline banner without
  clearing whatever insight was already showing. The card title is
  "Insights" - no "AI" anywhere in user-facing copy. Match the layout, copy,
  and five states shown in `prototypes/trends.html`'s "Insights" card, built
  with the card styling already used on the page (`rounded-lg border
  border-border bg-surface shadow-md p-5`) and the button/quota styling
  conventions in `components/export/PeriodForm.tsx` /
  `components/dashboard/LiveBanner.tsx`.
  *Done when:* the component compiles and `npm run build` passes. No page uses
  it yet - there's no isolated component preview tool (no Storybook) in this
  project, so visual proof of each state happens in Step 2 once it's wired in.
- [x] **Step 2 - wire into the trends page** - in `app/trends/page.tsx`, call
  `getInsightsStatus()` alongside the existing `prisma.shift.findMany` call
  (guard for `{ error }` the same way other server-fetched data is handled;
  on error, treat as `remaining: 0, latest: null` rather than failing the
  page), then render `<TrendInsights initialRemaining={...} initialLatest={...} />`
  as a new section **above** the existing "Your rates" section - insights lead
  the page, per the prototype - in the main render path only. The existing
  zero-shifts early return (the "No shifts yet" card) is unchanged and does
  not gain this section, since insights need 5+ shifts regardless. *Done
  when:* all four states in the Testing section below are
  verified in the browser with screenshots: empty (5+ shifts, no prior
  insight), populated (after a successful generate, and on reload for a
  returning user), exhausted (`remaining: 0`), and error (a seed user with
  under 5 shifts).

## Files / areas

- `components/trends/TrendInsights.tsx` - new
- `app/trends/page.tsx` - add the `getInsightsStatus()` call and the new section

## Data / contracts

No new contracts - consumes the `InsightData`/`InsightsStatus` shapes and the
`generateTrendInsights`/`getInsightsStatus` actions already locked in 16a
(`actions/insights.ts`).

## Testing

This is UI/integration work (a client component wired into a server page,
driven by clicks and network calls), which the Testing gate in
`coding-standards.md` exempts from unit tests - it rides on the dev server,
a screenshot, and `npm run build` instead. No Playwright is installed or
declared in `AGENTS.md`, so verify manually against the running dev server
rather than adding it.

- Empty state: a user with 5+ shifts and no prior insight sees the "Get
  insights..." prompt and an enabled button.
- Populated state: after a successful generation (or on load, for a user with
  a prior insight), the three fields and updated quota render.
- Exhausted state: with `remaining: 0`, the button is disabled and the
  reset-next-month message shows.
- Error state: trigger the too-few-shifts error (a seed/test user with under
  5 shifts) and confirm the inline banner shows without crashing the page.

Manual generation requires a working `OPENAI_API_KEY` in the dev environment,
same as the existing screenshot/odometer import flows already depend on.

## Notes for the AI

- Server component (`app/trends/page.tsx`) fetches `getInsightsStatus()`;
  everything interactive lives in the `"use client"` component, per
  `coding-standards.md`.
- `getInsightsStatus()` already scopes by the authenticated session's user id
  internally (via its own `checkAccess()`) - the page doesn't need to pass a
  user id.
- Keep the card visually consistent with the existing "Your rates" / "Totals"
  sections on the page (same border/shadow/padding, same `text-[15px]
  font-semibold` section title style) so it reads as part of the same page,
  not a bolted-on widget.
- Don't add a loading skeleton for the initial server-fetched state - only
  the post-click "Generating..." state needs a spinner/disabled treatment,
  since the initial quota/latest insight arrive with the page render.
