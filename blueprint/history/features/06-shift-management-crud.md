# Feature: Shift management (CRUD)

**From build-plan:** feature 6
**Status:** not started

## Goal

Let drivers browse all their past shifts in one list, edit any shift's details, and delete shifts they no longer need. This closes the CRUD loop: create exists (`/shifts/new`), and this adds read-list, update, and delete.

## Design reference

None -- this is data CRUD following the existing dark-mode, mobile-first conventions already established by the dashboard and shift form. No design mockup needed.

## In scope

- A `/shifts` list page showing all shifts scoped to the signed-in user, ordered by date descending
- An edit page at `/shifts/[id]/edit` that reuses the existing `ShiftForm` component pre-filled with the shift's current values
- A `deleteShift` server action with authorization guard (shift must belong to the user)
- Delete button on each shift card in the list, with a confirmation step
- Extract the dashboard's inline shift card markup into a shared `ShiftListItem` component used by both the dashboard and the shifts list page
- Reusable navigation: add a "Shifts" link to `UserHeader` so drivers can move between dashboard and shift list
- Wire edit/delete links from dashboard shift cards as well

## Out of scope

- Account/profile editing (name, email, currency) -- the build plan mentions "account data" but that's a separate feature; this is purely shift CRUD
- Pagination or infinite scroll on the shift list -- early-MVP users will have < 100 shifts
- Filtering by platform or date range on the list page
- Bulk delete
- Sorting options (date-descending is fixed for now)
- Reusing the edit page to also show a read-only shift detail view (the list card + edit page cover it)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Shift list page + shared ShiftListItem** -- Create the `/shifts` page (server component) that fetches all shifts for the signed-in user via Prisma, ordered by date descending. Extract the inline shift card JSX from `app/dashboard/page.tsx:338-377` into a new `components/shifts/ShiftListItem.tsx` client component. The list page renders `ShiftListItem` cards in a stack with edit/delete action buttons (edit links, delete wired in step 3). Include an empty state ("No shifts yet" with a link to `/shifts/new`) and a header row with a "Log shift" button. Add a "Shifts" nav link in `UserHeader` (visible when signed in, next to the user name). Update the dashboard to import and render `ShiftListItem` instead of its inline card markup. *Done when:* `/shifts` loads and shows all user shifts ordered by date descending, empty state appears when no shifts exist, each card shows date/platform/time/trips/distance/earnings, dashboard still renders shift cards identically, the "Shifts" link appears in the header for signed-in users, and build + lint + tests pass.

- [x] **Step 2 - Edit shift page + updateShift action** -- Create `app/shifts/[id]/edit/page.tsx` (server component) that fetches the shift by id, verifies it belongs to the signed-in user (return `notFound()` if the shift doesn't exist or belongs to another user), and renders `ShiftForm` pre-filled with the shift's existing values. Modify `ShiftForm` to accept an optional `shift` prop of type `Shift`; when present: (a) initialize all local state from the shift's stored values (date/platform/startTime/endTime/amountEarned/tripsCompleted/startOdometer/endOdometer, with odoMode defaulting to `"odometer"` since both readings are stored), (b) call a new `updateShift` server action on submit instead of `createShift`, (c) show "Save changes" as the button text instead of "Add shift", (d) on success redirect to `/shifts` instead of clearing fields. Create the `updateShift` action in `actions/shifts.ts` reusing `validateShiftEntry` and `buildShift` (the action re-validates, re-builds, then runs `prisma.shift.update`). Add a "Cancel" link on the edit page that goes back to `/shifts`. Wire edit links from the shift list cards to `/shifts/[id]/edit`. Also wire edit links from the dashboard's `ShiftListItem` instances (now that it's a shared component). *Done when:* clicking Edit on any shift card opens the pre-filled form with all fields populated correctly, submitting calls `updateShift` and persists changes to the database, accessing a non-existent or another user's shift triggers `notFound()`, the cancel link navigates back, button text reads "Save changes" in edit mode, and build + lint + tests pass.

- [x] **Step 3 - Delete shift** -- Create a `deleteShift` server action in `actions/shifts.ts` that verifies the shift belongs to the signed-in user then deletes it, returning `{ success: true }` or `{ error: string }`. Add a delete button to `ShiftListItem` that opens an inline confirmation (a small confirm/cancel button pair that replaces the delete button on click). On confirm, call `deleteShift` and remove the card from the UI (optimistic removal, with error recovery if the server call fails). Also add a delete button to the edit page (top-right) with same confirmation pattern, redirecting to `/shifts` on success. *Done when:* clicking delete shows confirm/cancel, confirming removes the shift and the card disappears from the list, rejecting keeps it, deleting from the edit page redirects to `/shifts`, unauthorized delete attempts are rejected, and build + lint + tests pass.

## Files / areas

| File | Action |
|---|---|
| `app/shifts/page.tsx` | Create -- shift list page (server component) |
| `app/shifts/[id]/edit/page.tsx` | Create -- edit shift page (server component) |
| `components/shifts/ShiftListItem.tsx` | Create -- shared shift card (client component, for the inline confirm state) |
| `components/shifts/ShiftForm.tsx` | Modify -- accept optional `shift` prop for edit mode |
| `actions/shifts.ts` | Modify -- add `updateShift` and `deleteShift` actions |
| `components/auth/UserHeader.tsx` | Modify -- add "Shifts" nav link |
| `app/dashboard/page.tsx` | Modify -- replace inline shift card markdown with `ShiftListItem` |

## Data / contracts

No new types or schema changes. The existing `Shift` type (`types/shift.ts`), `ShiftFormData` + `ShiftEntryErrors` (`lib/shift-entry.ts`), and Prisma `Shift` model are the contracts.

- `updateShift(shiftId: string, formData: FormData)` -- validates with `validateShiftEntry`, builds with `buildShift`, updates with `prisma.shift.update({ where: { id, userId }, data: {...} })`. Returns `{ error?: string; success?: boolean }`.
- `deleteShift(shiftId: string)` -- checks `prisma.shift.findUnique({ where: { id } })` to verify ownership by userId, then `prisma.shift.delete`. Returns `{ success?: boolean; errors?: Record<string, string> }`.
- `ShiftListItem` props: the denormalized shift shape already used by the dashboard (date/startTime/endTime as strings, platform/trips/distance/earnings as numbers), plus optional `showActions?: boolean` to control edit/delete button visibility.

All queries filter by `userId` (from `auth()`) to scope shifts to the signed-in user.

## Testing

The existing test suite (`lib/shift-entry.test.ts`, `lib/mock-data.test.ts`) already covers `validateShiftEntry`, `buildShift`, `getShiftHours`, and `isValid`. The new `updateShift` and `deleteShift` actions reuse these pure functions. No new pure-logic functions are introduced -- the server actions delegate validation/build to the tested library and add Prisma calls + auth checks, which are integration-level (verified by the build and browser check). The test command (`npm test`) must stay green through all three steps.

## Notes for the AI

- All queries must filter by `userId` from `auth()`. Never trust a client-supplied user id.
- Server components fetch data directly with Prisma; client components (ShiftForm, ShiftListItem) use server actions.
- The `ShiftForm` already handles odometer/distance mode toggle and overnight shift detection. Edit mode must not break these.
- The dashboard date mapping (lines 94-101 in dashboard page.tsx) serializes Prisma Date objects to ISO strings. The shared `ShiftListItem` component should accept the same serialized shape so it's drop-in compatible.
- The existing test runner is Vitest: `npm test`.
- Follow the `{ error?: string; success?: boolean }` return pattern in server actions, consistent with the existing `createShift` action.
- The "Shifts" link in `UserHeader` should use a simple `<Link>` to `/shifts`, following the same minimal style as the existing header.
- For the delete confirmation, use local component state in `ShiftListItem` (it becomes a client component). Show "Delete" button normally; on click replace it with "Cancel | Confirm" buttons. No modal overlay needed for mobile-first UX.
