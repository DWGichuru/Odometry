# Feature: ShiftSession model + start/end server actions

**From build-plan:** feature 12a
**Status:** not started

## Goal

Add a `ShiftSession` model that represents an in-progress shift, plus server actions to start and end one. A driver starts a shift by recording the odometer reading; the session persists in the database so it survives an app close. Ending the session takes a second odometer reading and computes distance. No camera, no vision API, no UI -- just the data layer and typed actions that 12b/12c/12d will build on.

## Design reference

`/prototype` has run, so `prototypes/` is the design reference for feature 12 as a
whole, and `prototypes/theme.css` is the source of truth for colors, type, and
spacing.

| Mockup | What it pins down |
| --- | --- |
| [prototypes/entry-sheet.html](../../prototypes/entry-sheet.html) | FAB opens a choice sheet; the live-FAB state |
| [prototypes/capture.html](../../prototypes/capture.html) | Camera, four states, start/end variants |
| [prototypes/dashboard-live.html](../../prototypes/dashboard-live.html) | In-progress banner; per-shift origin tags |
| [prototypes/end-chain.html](../../prototypes/end-chain.html) | End odometer, screenshot hand-off, populated summary |

12a builds none of these screens, but they constrain its contracts. The banner runs
its elapsed timer off `startedAt`. The end chain assumes a session row still exists
between "end odometer confirmed" and "shift saved", which the `COMPLETED` status
already provides. And the shift rows in `dashboard-live.html` tag each shift by
origin, which the current `EntrySource` enum cannot express (see Data / contracts).

`theme.css` is otherwise a faithful mirror of the app's `@theme` in
[app/globals.css](../../app/globals.css). It carries five token groups the app does
not have yet; porting them is Step 1 so 12c finds them waiting and no later step has
to touch the global stylesheet mid-feature. The HTML mockups are throwaway and get
discarded at the parent feature's `/complete`.

## In scope

- Port the new theme tokens from `prototypes/theme.css` into `app/globals.css`
- `ShiftSession` Prisma model with `startOdometer`, `startedAt`, `endOdometer`, `endedAt`, and `OPEN | COMPLETED | CANCELLED` status
- `EntrySource.ODOMETER` enum value, in the same migration
- `startShiftSession` server action -- creates an OPEN session, enforcing at most one OPEN session per user
- `endShiftSession` server action -- closes an OPEN session with an end odometer, validates reading > start, returns computed distance
- `cancelShiftSession` server action -- cancels an OPEN session (so a wrong odometer entry doesn't lock the user)
- TypeScript types for the session and its status enum
- Unit tests for all three server actions

## Out of scope

- Camera capture or file upload (12c)
- Odometer vision prompt + plausibility checks, including reading continuity against the driver's last shift (12b)
- Dashboard in-progress banner UI (12c)
- Review/confirm UI (12c)
- FAB choice sheet, and the `BottomNav` change it requires (12c)
- Chaining earnings screenshot into end-of-shift flow (12d)
- Creating a `Shift` row from session data (12d)
- The `.btn-primary` contrast bug in `globals.css` -- real, pre-existing, unrelated to this feature

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [ ] **Step 1 - Port the new theme tokens**
  Add the token groups `prototypes/theme.css` holds that the app lacks: `--overlay-scrim` / `--overlay-chrome` / `--overlay-ink` / `--overlay-ink-muted`, `--guide-stroke`, `--live` / `--live-muted`, `--confidence-high` / `--confidence-low` (plus their `-muted` pairs), and `--accent-gradient-strong`. Follow the existing three-place pattern in `globals.css`: `:root`, the dark blocks, and `@theme inline`.
  *Done when:* `npm run build` passes, and an element using `bg-live` renders `#10b981` in both themes.

- [ ] **Step 2 - ShiftSession model + migration**
  Add the `ShiftSession` model and `SessionStatus` enum to `prisma/schema.prisma`, add `ODOMETER` to the existing `EntrySource` enum, run `prisma migrate dev`, and `prisma generate`. Register the `ShiftSession` relation on the `User` model.
  *Done when:* `prisma migrate status` shows the migration applied, `prisma generate` succeeds, and the generated client includes `shiftSession` methods.

- [ ] **Step 3 - TypeScript types**
  Create `types/shift-session.ts` with the `SessionStatus` enum and a `ShiftSession` interface matching the Prisma model. Add `ODOMETER` to the `EntrySource` enum mirror in `types/shift.ts`. These are load-bearing: 12c and 12d will import them.
  *Done when:* The file compiles without errors (`npx tsc --noEmit`).

- [ ] **Step 4 - startShiftSession server action**
  Create `actions/shift-session.ts` with `startShiftSession(startOdometer: number)`. It must: authenticate the user, check subscription access (reuse the `checkAccess` pattern from `actions/shifts.ts`), reject if an OPEN session already exists for that user, validate `startOdometer >= 0`, create the row with `status: OPEN` and `startedAt: now()`, and return `{ success, data }` or `{ error }`.
  *Done when:* Passing unit test covering: creates a session, rejects negative odometer, rejects duplicate OPEN session, rejects unauthenticated calls.

- [ ] **Step 5 - endShiftSession server action**
  Add `endShiftSession(endOdometer: number)` to `actions/shift-session.ts`. It must: authenticate + check access, find the user's OPEN session (error if none), validate `endOdometer > startOdometer`, compute `distanceKm = endOdometer - startOdometer`, update the row with `endOdometer`, `endedAt: now()`, `status: COMPLETED`, and return `{ success, data: { startOdometer, startedAt, endOdometer, endedAt, distanceKm } }`. The return shape is load-bearing for 12d.
  *Done when:* Passing unit test covering: ends a session with valid odometer, rejects end <= start, rejects no OPEN session, returns correct distance.

- [ ] **Step 6 - cancelShiftSession server action**
  Add `cancelShiftSession()` to `actions/shift-session.ts`. It must: authenticate + check access, find the user's OPEN session (error if none), update status to `CANCELLED`, and return `{ success }`.
  *Done when:* Passing unit test covering: cancels an OPEN session, rejects when no OPEN session exists, and a new session can be started after cancellation.

## Files / areas

| File | Action |
|------|--------|
| `app/globals.css` | Port the new theme tokens from `prototypes/theme.css` |
| `prisma/schema.prisma` | Add `SessionStatus` enum and `ShiftSession` model; add `ODOMETER` to `EntrySource`; add `shiftSessions ShiftSession[]` to `User` |
| `prisma/migrations/` | New migration (auto-generated by `prisma migrate dev`) |
| `types/shift.ts` | Add `ODOMETER` to the `EntrySource` enum mirror |
| `types/shift-session.ts` | **New.** `SessionStatus` enum and `ShiftSession` interface |
| `actions/shift-session.ts` | **New.** Three server actions: start, end, cancel |
| `actions/shift-session.test.ts` | **New.** Unit tests for all three actions |

## Data / contracts

**ShiftSession model:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | PK |
| `userId` | String | FK to User, cascade delete |
| `startOdometer` | Float | Reading at shift start |
| `startedAt` | DateTime | Timestamped server-side on create |
| `endOdometer` | Float? | Null until session ends |
| `endedAt` | DateTime? | Null until session ends |
| `status` | SessionStatus | `OPEN` (default), `COMPLETED`, or `CANCELLED` |
| `createdAt` / `updatedAt` | DateTime | Auto-managed |

**Invariant:** at most one OPEN `ShiftSession` per user. Enforced at the application level (check before insert). A DB-level partial unique index would be stronger but requires raw SQL; flagged as a future hardening item. The TOCTOU window is narrow enough for single-driver mobile use.

**`startedAt` / `endedAt` are the shift's clock.** The build-plan line says the app timestamps the reading when the photo is processed, so in 12d these become the `Shift`'s `startTime` and `endTime`. That is the entire reason the driver never types a time, and why `end-chain.html` can show `9:41 AM -> 4:07 PM` with no input.

**`EntrySource.ODOMETER` (new).** `dashboard-live.html` tags each shift row by origin (`Odometer`, `Screenshot`, `Manual`), and a shift born from two odometer photos is neither `MANUAL` nor `SCREENSHOT`. It ships in this migration because adding one enum value later costs a second migration. Both `prisma/schema.prisma` and the `types/shift.ts` mirror need it. 12d writes it; the shift list reads it.

**endShiftSession return shape (load-bearing for 12d):**
```ts
{ success: true, data: { startOdometer: number, startedAt: string, endOdometer: number, endedAt: string, distanceKm: number } }
```

**Why the `COMPLETED` row is not deleted.** `end-chain.html` puts a screenshot upload and a review screen between "end odometer confirmed" and "shift saved". Keeping the `COMPLETED` session means a driver who closes the app mid-review does not lose a reading they can no longer retake, because the car has since moved. 12d reads the most recent `COMPLETED` session and deletes nothing.

## Testing

The project has `npm test` (Vitest) configured -- the test gate applies. Each of the three server actions (steps 4-6) is in-scope logic and must ship with a passing test. Tests live in `actions/shift-session.test.ts`, co-located with the actions file.

Steps 1-3 add no logic: Step 1 is styling (rides on `npm run build` plus a screenshot in both themes), Step 2 is schema (verified by `prisma migrate status`), Step 3 is types (verified by `tsc --noEmit`).

Mock strategy: mock `@/auth` to return a session with a known `userId`, mock `@/lib/prisma` and `@/lib/subscription` where needed. Follow the existing pattern from `lib/shift-entry.test.ts`.

No UI exists until 12c, so `/check` has nothing to click here. Drive the actions from a scratch server component or the Vitest run.

## Notes for the AI

- Follow the `checkAccess()` helper pattern from `actions/shifts.ts:10-26` -- same auth + subscription gating.
- Return shapes: `{ success: true, data }` on success, `{ error: string }` on failure. Consistent with existing actions.
- The `userId @unique` constraint is deliberately NOT used on `ShiftSession` -- we want to allow multiple historical (COMPLETED/CANCELLED) sessions per user. The "one open" rule is enforced in application code.
- `@db.Date` is not needed on `startedAt`/`endedAt` -- these are full timestamps.
- All three actions are `"use server"` directives at the top of the file.
- No Prisma enums on `SessionStatus` unless the DB-native enum pattern from the existing schema is followed. Check existing enums (`Platform`, `EntrySource`, `SubscriptionStatus`) -- they are all Prisma enums, so follow suit.
- Odometer values are `Float`, matching `Shift.startOdometer`. Round to 2 decimals the way `buildShift` does.
- Do not add continuity or trip-meter checks here. Comparing a reading against the driver's last shift is 12b's job; doing it now would split that logic across two sub-features.
- `prisma migrate dev` for the schema change, never `db push`.
