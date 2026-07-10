# Feature: FAB entry sheet + live FAB

**From build-plan:** feature 12c-1
**Status:** not started

## Goal

Replace the FAB's direct navigation to `/shifts/new` with a choice sheet. Tapping the FAB raises a bottom sheet with three entry methods: start a live shift via the odometer camera, import a screenshot, or enter manually. When a shift is in progress (an OPEN `ShiftSession` exists), the FAB switches to a green live button showing elapsed time with a pulsing dot.

## Design reference

| Mockup | What it pins down |
| --- | --- |
| [prototypes/entry-sheet.html](../../prototypes/entry-sheet.html) | The choice sheet (scrim + bottom sheet with three options, primary accent gradient on "Start live shift", "Fastest" badge), the idle FAB (+ button), the live FAB (green, dot-live pulse, elapsed timer), and the transition between them |

Theme tokens were already ported in 12a, step 1 (no-op here). Prototypes preserved until feature 12 is fully complete.

## In scope

- Server action `getOpenSession()` that returns the user's OPEN `ShiftSession` (or `null`)
- `EntrySheet` component -- scrim + bottom sheet with three navigation options, matching the prototype
- Modify `BottomNav` FAB slot: idle state opens the sheet, live state shows a green FAB with elapsed timer
- Elapsed timer display in the live FAB (reads `startedAt` from the session, updates every second)
- Live pulse dot animation (already defined in `globals.css` from 12a)

## Out of scope

- Building the camera capture page (`/capture`) -- 12c-2
- Building the dashboard in-progress banner -- 12c-3
- Calling `startShiftSession` or `endShiftSession` -- already built in 12a, but not called from here
- The end-shift flow from the live FAB tap -- navigation target is a placeholder until 12c-2 builds `/capture?type=end`
- The manual entry form or import flow -- unchanged, just accessed through the sheet now

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Server action `getOpenSession`**
  Create `actions/session.ts` with `getOpenSession()`. Authenticate the user (reuse pattern: auth check, no subscription check needed -- reading session state is not a paid action). Query `prisma.shiftSession.findFirst({ where: { userId, status: "OPEN" } })`. Return `{ session: ShiftSession | null }` or `{ error: string }` on auth failure. The return shape is load-bearing: 12c-3's dashboard banner also calls this.
  *Done when:* Passing unit test covering: returns session when OPEN exists, returns null when no OPEN session, rejects unauthenticated.

- [x] **Step 2 - `EntrySheet` component**
  Create `components/layout/EntrySheet.tsx` -- a `"use client"` component. Props: `open: boolean`, `onClose: () => void`. When open, renders:
  - A scrim overlay (uses `--overlay-scrim` token, similar to `capture.html` scrim) -- tap to close
  - A bottom sheet (`rounded-t-[var(--radius-xl)]`, border, shadow, `var(--surface)` background)
  - Grabber handle at top
  - "Log a shift" heading + subtext
  - Primary option: "Start live shift" with camera icon, "Fastest" badge, accent gradient background (`--accent-gradient-strong`), "Snap the odometer. We do the rest." subtitle
  - Divider "or log it the old way"
  - Secondary option: "Import screenshot" with image icon, navigates to `/import`
  - Tertiary option: "Enter manually" with edit icon, navigates to `/shifts/new`
  - All three options navigate via `useRouter().push()`. Closing the sheet is onClose.
  Match `entry-sheet.html` lines 294-345 for layout and styling.
  *Done when:* `npm run build` passes, component renders in both themes (`/check` or screenshot).

- [x] **Step 3 - Modify `BottomNav` FAB slot**
  Change the FAB slot in `components/layout/BottomNav.tsx`:
  - On mount, call `getOpenSession()` to check for an OPEN session
  - **Idle state** (no session): render current + FAB button (not a Link). On click, toggle sheet open. Include the `EntrySheet` component.
  - **Live state** (session exists): render a green FAB button with:
    - `bg-live` background, `text-[#05271c]` text
    - Pulsing dot (`dot-live` class from `globals.css`)
    - Elapsed time display (calculated from `startedAt`, updating every second via `useEffect` + `setInterval`)
    - `font-variant-numeric: tabular-nums` for stable digit width
    - Shadow: `shadow-[0_6px_16px_rgba(16,185,129,0.42)]`
    - On tap: navigate to `/capture?type=end` (placeholder until 12c-2 builds the page)
  Match `entry-sheet.html` lines 348-367 for the FAB states.
  *Done when:* `npm run build` passes. In the running app: tapping the idle FAB opens the sheet; when an OPEN session exists in the DB, the live FAB shows instead. `/check` or screenshot.

## Files / areas

| File | Action |
|------|--------|
| `actions/session.ts` | **New.** Server action `getOpenSession` |
| `actions/session.test.ts` | **New.** Unit test for `getOpenSession` |
| `components/layout/EntrySheet.tsx` | **New.** The choice sheet component |
| `components/layout/BottomNav.tsx` | Modify FAB slot: idle/live state logic, mount EntrySheet |
| `components/layout/AppShell.tsx` | Unchanged (BottomNav signature doesn't change) |

## Data / contracts

**`getOpenSession` return shape (load-bearing for 12c-3):**
```ts
// Success:
{ session: ShiftSession | null }  // null when no OPEN session exists
// Error:
{ error: string }
```

**EntrySheet props:**
```ts
interface EntrySheetProps {
  open: boolean;
  onClose: () => void;
}
```

**Live FAB tap:** navigates to `/capture?type=end` -- 12c-2 builds this page. The route and query param are load-bearing for 12c-2.

## Testing

`npm test` is configured. The server action has auth logic → test required.

- `actions/session.test.ts`: tests for `getOpenSession` (returns session, returns null, unauthenticated). Mock `@/auth`, `@/lib/prisma`.
- Steps 2 and 3 are UI components → build + screenshot evidence. Use `/check` or manual browser verification.

## Notes for the AI

- The `EntrySheet` calls `useRouter().push()` for navigation, not `<Link>`. The three options are buttons that programmatically navigate.
- Live FAB elapsed timer: calculate initial elapsed as `(Date.now() - new Date(session.startedAt).getTime()) / 1000` seconds. Update every second with `setInterval`. Format as `H:MM` (e.g. "2:14") or `M:SS` for under an hour.
- The `dot-live` CSS class is already defined in `app/globals.css` (pulse animation on `--live`). Use it as-is.
- The `EntrySheet` primary option uses `--accent-gradient-strong` (deeper ramp from 12a, step 1). The regular options use `var(--background)` background.
- `getOpenSession` does NOT check subscription -- reading session state is not a paid action. Auth is the only gate.
- The live FAB shadow uses `rgba(16, 185, 129, 0.42)` explicitly (Tailwind arbitrary value), matching the prototype's `.fab.live` rule.
- The previous FAB Link target (`/shifts/new`) is removed from BottomNav; access to manual entry is now only through the sheet.
- Prototypes are preserved. Do not delete `prototypes/` at `/complete` for 12c-1.