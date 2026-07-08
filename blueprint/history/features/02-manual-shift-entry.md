# Feature: Manual shift entry form

**From build-plan:** feature 2
**Status:** not started

## Goal

A `/shifts/new` page where a driver enters one shift's stats in a single form.
Submitted shifts live in local component state only (no persistence yet); the
point is to lock the entry UX and the odometer/overnight rules that features 5
(persistence), 6 (edit), and 7 (screenshot review) will reuse.

## Design reference

No prototype exists for this screen (`prototypes/` was consumed at feature 1).
The visual target is the built dashboard: theme tokens in `app/globals.css`,
card/badge/typography patterns from `app/dashboard/page.tsx`. Mobile-first,
dark-first, fast to fill in between trips: large touch targets, one column,
numeric keyboards on number fields.

## In scope

- `app/shifts/new/page.tsx` - server component: page heading ("Log shift") and
  the form
- `components/shifts/ShiftForm.tsx` - the one client component: form + the
  session list of shifts submitted since page load, shown below with a "not
  saved yet" note
- Fields, matching the `Shift` data model: date, platform (segmented control:
  Uber / Lyft / DoorDash), start time, end time, amount earned, trips completed,
  end odometer, and start odometer **or** distance covered (a two-way mode
  toggle; distance mode back-calculates `startOdometer = endOdometer - distance`
  per the project overview rule)
- Overnight rule: if end time is at or before start time, the shift ends the
  next day (a 6:00 PM - 1:30 AM shift is 7.5h, not an error)
- Client-side validation with inline error messages; the form keeps entered
  values on error
- Derived values shown per submitted shift: hours worked and distance km
- Extract the platform label/badge maps shared with the dashboard into
  `lib/platform.ts` (used by both pages; features 6 and 7 will need them too)

## Out of scope

- Persistence, Prisma, database (features 3 and 5 - submitted shifts vanish on
  reload, and the page says so)
- Authentication (feature 4); `userId` stays the mock value
- Editing or deleting entered shifts (feature 6)
- Screenshot import (feature 7)
- Navigation links from the dashboard to this page (nav lands with feature 4/9;
  reach it by URL)
- Zod validation (standards adopt it when server actions arrive in feature 5;
  this form validates client-side by hand)
- Currency preference (feature 5) - `$` stays hardcoded

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Form UI and platform lib** - Create `lib/platform.ts` with the
  platform label/badge/fill maps and update `app/dashboard/page.tsx` to import
  them (no visual change). Create `app/shifts/new/page.tsx` (server: heading +
  renders the form) and `components/shifts/ShiftForm.tsx` (`'use client'`) with
  all fields: date, platform segmented control, start/end time, amount earned
  (`inputMode="decimal"`), trips (`inputMode="numeric"`), end odometer, and the
  start-odometer / distance mode toggle that swaps which input shows. Submit is
  wired but a no-op for now. *Done when:* `/shifts/new` renders all fields on
  mobile and desktop in dark and light, the mode toggle swaps the input, the
  dashboard still renders identically, and `npm run build` passes.

- [x] **Step 2 - Entry logic, validation, and submit to local state** - Create
  `lib/shift-entry.ts` with pure `validateShiftEntry()` and `buildShift()`
  (odometer back-calc, overnight wraparound, the validation rules below) plus
  `lib/shift-entry.test.ts` covering the validation matrix - the tests ship in
  this same diff and must pass. Wire `ShiftForm` to them: inline errors under
  invalid fields without clearing values; on success prepend the built `Shift`
  (`crypto.randomUUID()` id, mock `userId`, `entrySource: MANUAL`) to the
  session list below the form (date, platform badge, times, trips, km,
  earnings, hours) and reset the form (platform and date kept for fast repeat
  entry). *Done when:* `npm test` is green including the new matrix; a valid
  entry appears in the list with correct derived hours and distance; a
  distance-mode entry back-calculates `startOdometer` correctly; a 6:00 PM -
  1:30 AM entry shows 7.5h; each invalid case (missing required field, negative
  amount, non-integer trips, start odometer >= end odometer, distance >
  end odometer) shows an inline error and adds no row.

- [x] **Step 3 - Polish and verify** - `npm run build && npm run lint` clean.
  Screenshot `/shifts/new` at mobile and desktop widths in dark and light.
  Walk the validation matrix from step 2 in the browser and spot-check the
  arithmetic of two entered shifts. *Done when:* build and lint pass, both
  viewports and both color schemes look right, and every validation case
  behaves as specified.

## Files / areas

| File | Action |
|------|--------|
| `lib/platform.ts` | Create - platform label/badge/fill maps |
| `lib/shift-entry.ts` | Create - pure validation + shift-building logic |
| `lib/shift-entry.test.ts` | Create - unit tests for the validation matrix |
| `app/dashboard/page.tsx` | Edit - import platform maps from lib (no visual change) |
| `app/shifts/new/page.tsx` | Create - server page wrapper |
| `components/shifts/ShiftForm.tsx` | Create - client form + session list |

## Data / contracts

- Reuses the **locked** `Shift`, `Platform`, `EntrySource` from `types/shift.ts`
  - do not modify them.
- Validation rules (the contract features 6 and 7 inherit for their edit/review
  forms):
  - date, platform, start time, end time, end odometer: required
  - amount earned: number >= 0 (0 allowed - a shift can earn nothing)
  - trips completed: integer >= 0
  - start-odometer mode: 0 <= startOdometer < endOdometer
  - distance mode: 0 < distance <= endOdometer (back-calc must not go negative)
  - end time <= start time means the shift ends the next day (max one
    wraparound; multi-day shifts are out of scope)
- Form state shape stays internal to `ShiftForm`; it becomes shared only when
  feature 6/7 reuse it.

## Testing

`npm test` (Vitest) is configured, so the testing gate in `coding-standards.md`
applies: logic-bearing steps ship a passing test in the same diff.

- **In scope for unit tests:** the pure shift-entry logic - odometer
  back-calculation, the overnight wraparound, and the validation rules. Extract
  these into `lib/shift-entry.ts` (e.g. `validateShiftEntry()` +
  `buildShift()`) so they are testable without the DOM, with
  `lib/shift-entry.test.ts` beside it covering the validation matrix from
  step 2.
- **Not unit-tested:** the form component and page rendering - verified with
  screenshots plus the build, per the standards' scope rule.
- Build, lint, and `npm test` must all be green before any step is approved.

## Notes for the AI

- `ShiftForm` is the only client component; the page wrapper stays a server
  component
- Combine the date input and time inputs into local-time ISO strings for
  `startTime`/`endTime`; apply the overnight rule by adding one day to the end
  timestamp when needed
- Use the existing theme tokens and card patterns; no new colors or one-off
  styles
- Platform segmented control defaults to Uber preselected (fast entry beats
  forced choice)
- Number inputs: `inputMode` attributes for mobile keyboards; parse with
  `Number()` and reject `NaN` explicitly
- Keep `computeShiftStats` untouched; this feature doesn't aggregate
- No em dashes in generated content (writing rule in `coding-standards.md`)
