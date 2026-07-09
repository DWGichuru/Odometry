# Feature: Connect pages to database

**From build-plan:** feature 5
**Status:** not started

## Goal

Replace all mock data with real database reads and writes. The shift form persists entries to the `Shift` table scoped to the authenticated user. The dashboard reads the user's real shifts and computes live stats. After this feature, the app is fully data-backed (no mock data in UI).

## Design reference

No visual change. Existing theme and patterns apply. The dashboard and shift form keep their current layout -- only the data source changes.

## In scope

- Create `actions/shifts.ts` with `createShift()` server action: validates with existing `validateShiftEntry()`, builds the shift, inserts into DB via Prisma, returns `{ success, shift } | { error }`
- Wire `ShiftForm` to call `createShift()` on submit instead of adding to local state; show loading state; clear form on success; show error on failure
- Replace dashboard `mockShifts` with `prisma.shift.findMany({ where: { userId: session.user.id } })`
- Replace `computeShiftStats(mockShifts)` with server-computed stats from real shifts
- Keep the week bar chart and platform breakdown on the dashboard -- recompute from real data
- Empty state: dashboard shows zero stats plus "No shifts yet. Log your first shift." message when user has no shifts
- Remove mock data imports from dashboard and shift form
- Keep `lib/mock-data.ts` for tests (used by `mock-data.test.ts`)

## Out of scope

- Shift edit or delete (feature 6)
- Screenshot import (feature 7)
- Pagination or infinite scroll on the shift list (single user, few shifts at MVP -- simple query is fine)
- Redesigning the dashboard layout
- The "Recent shifts" list on dashboard already reads from the same query -- no separate shift listing page needed (that's feature 6)

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Create shift server action** -- Create `actions/shifts.ts` with `createShift()`: a `"use server"` action that calls `auth()` for the session, validates form data with the existing `validateShiftEntry()`, builds the shift with `buildShift(data, userId)`, inserts via `prisma.shift.create()`, and returns `{ success: true, shift }` or `{ error: string }`. *Done when:* `npm run build` and `npm test` pass.

- [x] **Step 2 - Wire ShiftForm to server action** -- Replace the local state (`useState<Shift[]>([])`) submission in `ShiftForm` with a call to `createShift()`. The submit handler becomes async: call server action, on success reset form fields (keep date and platform for repeat entry), on failure show inline error. Remove the "Entered shifts / Not saved yet" section below the form. After a successful save, show a brief confirmation then allow entering another shift. *Done when:* `npm run build` passes, submitting a shift persists it to the database, the form resets on success, errors display on failure.

- [x] **Step 3 - Replace dashboard mock data with real queries** -- In `app/dashboard/page.tsx`, replace `computeShiftStats(mockShifts)` with a Prisma query: `prisma.shift.findMany({ where: { userId } })` + recompute stats inline. Replace the mock shift rows with the real shift list. Add an empty state when no shifts exist ("No shifts yet." with a link to `/shifts/new`). The week bar chart and platform breakdown must recalculate from real data (compute the same derived values from the query). Keep the existing chart/badge visuals unchanged. *Done when:* a signed-in user with shifts sees their real data on the dashboard. A user with no shifts sees the empty state. No mock data appears on the page.

- [x] **Step 4 - Polish and verify** -- `npm run build && npm run lint && npm test` all green. Test flow: sign in, log a shift at `/shifts/new` → redirect or see confirmation → navigate to `/dashboard` → see the shift in the stats and recent list. Verify stats are correct. Verify week chart and platform breakdown reflect real data. Verify empty state for a new user. Verify another user (different session) sees only their own shifts. *Done when:* build/lint/tests green, full end-to-end flow works.

## Files / areas

| File | Action |
|------|--------|
| `actions/shifts.ts` | Create -- `createShift()` server action |
| `components/shifts/ShiftForm.tsx` | Edit -- wire to server action, remove local state list |
| `app/dashboard/page.tsx` | Edit -- replace mock data with Prisma queries |
| `lib/mock-data.ts` | Keep -- still needed for tests |

## Data / contracts

The `createShift()` action return type:
```typescript
type CreateShiftResult =
  | { success: true; shift: { id: string; date: string; platform: string } }
  | { error: string }
```

Dashboard query always filters by `userId` from the session -- never trust client input. Every Prisma query includes `where: { userId }`.

## Testing

Vitest is configured. In-scope logic:
- The `createShift()` server action has pure validation logic (reuses `validateShiftEntry`) and DB writes. No unit test (DB-dependent server actions aren't unit-testable without mocking Prisma). Verify manually.
- Existing `lib/shift-entry.test.ts` and `lib/mock-data.test.ts` must remain green.
- UI verification: build + end-to-end manual walkthrough.

## Notes for the AI

- `prisma` is imported from `@/lib/prisma`. Use it server-side only.
- `auth()` is called in server components and server actions to get the session. In `createShift()`, call `auth()` to get the userId.
- The dashboard queries must be in the server component (not a client component). The stats computation stays server-side.
- `prisma.shift.findMany` returns Prisma Shift types, not the TS `Shift` type. They're compatible shape-wise but the date fields are `Date` objects from Prisma vs `string` in the TS type. Convert dates to ISO strings for the UI helpers that expect strings (`formatTime`, `shiftHours`). Or update those helpers to accept both.
- When switching the dashboard from mock data to real data, keep the existing chart/badge rendering code -- just change the data source array.
- Remove `import { mockShifts }` from the dashboard after the switch. Remove the `computeShiftStats` call if no longer needed (compute inline from the query array).
- The `ShiftForm` currently has a session list below the form. Replace it with a simple success message or toast after save. No need for a list when data's in the DB.
- `useActionState` can be used for the form submission with the server action, like the sign-up form. But the ShiftForm is more complex (uncontrolled inputs, mode toggle). Keep the current `onSubmit` handler approach but make it async.
