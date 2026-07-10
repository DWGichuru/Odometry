# Feature: Chain earnings screenshot into end-of-shift flow

**From build-plan:** feature 12d
**Status:** not started

## Goal

After the driver confirms the end odometer (12c-2), chain directly into the earnings screenshot upload instead of dumping them on the dashboard. The flow has three steps: review the completed odometer data, upload/import the earnings screenshot, then review a populated summary with every `Shift` field filled. Saving creates the `Shift` row with `entrySource: ODOMETER`. The driver types nothing.

## Design reference

| Mockup | What it pins down |
| --- | --- |
| [prototypes/end-chain.html](../../prototypes/end-chain.html) | Three-step flow: done-cap showing completed session (time, distance, odometer), screenshot upload step (picker + loading + skip link), summary step (all fields tagged by source: 📷 odometer, 🖼 screenshot, ⏱ timestamped, ∑ derived). "Nothing left to type" pill. |

Theme tokens ported in 12a. Prototypes preserved until feature 12 is fully complete.

## In scope

- Server action `createShiftFromSession(sessionId, extractedFields)` -- creates a `Shift` row merging session data (odometer, timestamps, distance) with extracted data (earnings, trips, platform, date). Returns `{ success, shiftId }` or `{ error }`.
- New route `app/review-shift/page.tsx` -- `"use client"` page with three steps:
  1. **Screenshot step:** displays the completed session data (done-cap: "Shift closed · 6h 26m · 288.0 km", time and odometer range), screenshot upload picker (reuse pattern from `/import`), "Import shift data" button, skip link
  2. **Loading step:** spinner with "Extracting shift data..." and subtext
  3. **Summary step:** hero amount (total earned), field rows tagged by source (📷 for odometer, 🖼 for screenshot, ⏱ for timestamps, ∑ for derived distance), source key legend, "Something wrong? Edit fields" link, "Save shift" button
  - Queries the most recent `COMPLETED` `ShiftSession` on mount to get session data
  - Calls `extractShiftFromScreenshot` (existing action from feature 8) for screenshot extraction
  - Calls `createShiftFromSession` on save, then navigates to `/dashboard`
- Wire the end capture page: change confirm navigation from `/dashboard` to `/review-shift` (for `captureType === "end"`)
- Skip path: if the driver taps "Enter earnings by hand", navigate to a manual entry form pre-populated with odometer data (or skip to summary with empty earnings fields to edit)

## Out of scope

- The manual entry fallback page (reuse existing `/shifts/new` route as-is; the skip link navigates there)
- The "Something wrong? Edit fields" link (navigates to `/shifts/[id]/edit` after save, or inlines editable fields -- defer to a follow-up)
- Modifying the `/import` page or its standalone flow (unchanged)
- The start-of-shift flow (only the end-of-shift chains into this)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Server action `createShiftFromSession`**
  Create `actions/review-shift.ts` with `createShiftFromSession(sessionId: string, extractedFields: ExtractedShiftFields)`. Authenticate + check subscription access. Fetch the `COMPLETED` session by ID, verify ownership (session.userId === userId). Reject if session not found or not owned. Create a `Shift` row with:
  - `date`: from extracted fields (or `new Date()` if null)
  - `platform`: from extracted fields
  - `startTime` / `endTime`: from session (`startedAt` / `endedAt` -- server-timestamped, no client clock)
  - `amountEarned` / `tripsCompleted`: from extracted fields
  - `startOdometer` / `endOdometer`: from session
  - `distanceKm`: computed from session (`endOdometer - startOdometer`)
  - `entrySource`: `ODOMETER`
  - `userId`: authenticated user
  Return `{ success: true, shiftId: string }` or `{ error: string }`.
  The session's odometer and timestamp data comes from the database, never from the client. The client only supplies `sessionId` + the screenshot-extracted fields.
  *Done when:* Passing unit test covering: creates shift with correct fields, rejects unauthenticated, rejects invalid session ownership, rejects non-COMPLETED session.

- [x] **Step 2 - Review shift page (screenshot + loading steps)**
  Create `app/review-shift/page.tsx` -- `"use client"` component. On mount:
  - Query the most recent `COMPLETED` `ShiftSession` via a new `getCompletedSession()` server action (or reuse pattern from `actions/session.ts`). If no completed session, redirect to `/dashboard`.
  - Display the "done-cap": green checkmark in circle, "Shift closed · Xh Xm · XXX.X km", time range ("9:41 AM → 4:07 PM"), odometer range ("048231 km → 048519 km")
  - Step indicator: four segments, "Odometer read" done → "Earnings" active → "Save"
  - Screenshot upload picker: file input, same styling as the prototype. Stores the file in state.
  - "Import shift data" button: calls `extractShiftFromScreenshot` with the file. On success, transitions to summary step with `reviewData`. On error, shows error.
  - Loading step: spinner + "Extracting shift data..." + subtext.
  - "Don't have one? Enter earnings by hand" skip link → navigates to `/shifts/new`.
  Match `end-chain.html` lines 415-482 for layout.
  *Done when:* `npm run build` passes. Page renders with completed session data. Screenshot upload and extraction works. Loading state shows.

- [x] **Step 3 - Summary step + save + wire the end capture**
  Add the summary step to the review page:
  - Hero amount: "Earned this shift" eyebrow, large "$198.40", green "Nothing left to type" pill
  - Field rows: each with source emoji, field name, value. Date (🖼), Platform (🖼), Start time (⏱), End time (⏱), Amount earned (🖼), Trips completed (🖼), Start odometer (📷), End odometer (📷), Distance covered (∑, derived, accent row)
  - Source key legend: 📷 Odometer photo, 🖼 Screenshot, ⏱ Timestamped
  - "Something wrong? Edit fields" link → placeholder (navigates to `/shifts/new` for now)
  - "Save shift" button: calls `createShiftFromSession`, navigates to `/dashboard` on success
  Match `end-chain.html` lines 485-575 for layout.
  Then modify `app/capture/page.tsx`: in `handleConfirm`, when `captureType === "end"`, change navigation from `/dashboard` to `/review-shift`.
  *Done when:* `npm run build` passes. Full flow works: end odometer → review page → upload screenshot → summary → save → dashboard.

## Files / areas

| File | Action |
|------|--------|
| `actions/review-shift.ts` | **New.** `createShiftFromSession` server action |
| `actions/review-shift.test.ts` | **New.** Unit tests |
| `actions/session.ts` | Add `getCompletedSession()` query (or reuse `getOpenSession` pattern for COMPLETED) |
| `app/review-shift/page.tsx` | **New.** Three-step review page |
| `app/capture/page.tsx` | Change end confirm to navigate to `/review-shift` |

## Data / contracts

**`createShiftFromSession` params:**
```ts
interface SessionShiftData {
  sessionId: string;
  fields: ExtractedShiftFields & {
    startOdometer: number;
    endOdometer: number;
    distanceKm: number;
    startTime: string;
    endTime: string;
  };
}
```

Return: `{ success: true, shiftId: string } | { error: string }`

**Completed session query:** `prisma.shiftSession.findFirst({ where: { userId, status: "COMPLETED" }, orderBy: { endedAt: "desc" } })` -- most recently completed session.

**Route:** `/review-shift` -- no search params needed. The page queries the most recent COMPLETED session.

## Testing

`npm test` is configured. The server action has logic → test required.

- `actions/review-shift.test.ts`: tests for `createShiftFromSession` (creates shift, rejects unauthenticated, rejects invalid session ownership). Mock `@/auth`, `@/lib/prisma`, `@/lib/subscription`.
- The review page is UI → build + screenshot evidence.

Existing tests must still pass.

## Notes for the AI

- The completed session query lives in `actions/session.ts` as a new export `getCompletedSession()` (same pattern as `getOpenSession`, different status filter).
- `createShiftFromSession` reuses the same pattern as `actions/shifts.ts:createShift` -- it just takes pre-computed values instead of FormData.
- The screenshot upload reuses `extractShiftFromScreenshot` from `actions/import.ts` (already built in feature 8). No changes to that action.
- Summary field row format: each row has a source emoji icon, a field label, and a value. Distance row gets the `derived` class (accent background, bold).
- The "Nothing left to type" pill uses `--live-muted` background and `--live` text (emerald, same semantic as live shift).
- When the driver skips the screenshot ("Enter earnings by hand"), navigate to `/shifts/new` -- the existing manual entry form. A future improvement could pre-fill odometer data.
- `entrySource: ODOMETER` is already added to the Prisma schema and types in 12a, step 2.
- Prototypes are preserved. Do not delete `prototypes/` at `/complete` for 12d.