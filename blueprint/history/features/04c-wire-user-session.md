# Feature: Wire user session to app code

**From build-plan:** feature 4c
**Status:** not started

## Goal

Replace the hardcoded `"mock-user-1"` userId with the real authenticated user's ID from the session. The shift entry form stores the real user ID, the dashboard reads per-user stats. Also adds the user's name to the UserHeader display (already present) and ensures the header is solid across all protected pages.

## Design reference

No visual change. Existing theme and patterns apply.

## In scope

- `ShiftForm`: replace `"mock-user-1"` with the real `userId` from the session (passed as a prop from the server page)
- `app/shifts/new/page.tsx`: read session via `auth()`, pass `userId` to `ShiftForm`
- `app/dashboard/page.tsx`: read session via `auth()`, pass `userId` for future DB queries (feature 5)
- Verify `UserHeader` shows user name after sign-in (already works -- smoke test)
- Remove any remaining `"mock-user-1"` references in app code

## Out of scope

- Reading shifts from the database (feature 5)
- Persisting form entries to the database (feature 5)
- Profile or settings page
- User menu or avatar in header (post-MVP)

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Wire userId to ShiftForm** -- In `app/shifts/new/page.tsx`, call `auth()` and pass `userId` as a prop to `ShiftForm`. In `ShiftForm`, accept `userId` as a prop and use it in `buildShift()` instead of the hardcoded `"mock-user-1"`. *Done when:* `npm run build` passes, submitting a shift uses the real user ID from the session.

- [x] **Step 2 - Wire userId to dashboard and verify** -- In `app/dashboard/page.tsx`, call `auth()` and pass `userId` for readiness (feature 5 will use it for scoped DB queries). Grep for any remaining `"mock-user-1"` and remove them. *Done when:* `npm run build && npm run lint && npm test` all green, no `"mock-user-1"` string remains in app code.

## Files / areas

| File | Action |
|------|--------|
| `app/shifts/new/page.tsx` | Edit -- call auth(), pass userId |
| `components/shifts/ShiftForm.tsx` | Edit -- accept userId prop |
| `app/dashboard/page.tsx` | Edit -- call auth(), pass userId |
| `lib/mock-data.ts` | Check -- already uses `"mock-user-1"` for mock data (keep until feature 5) |

## Data / contracts

Session shape (established in 4a):
```typescript
{ user: { id: string; name?: string; email?: string; image?: string } }
```

The `userId` is passed as a string prop from server components to client components. No new types needed.

## Testing

No logic-bearing additions (just prop threading). Build + lint + existing test suites must pass.

## Notes for the AI

- The mock data in `lib/mock-data.ts` still uses `"mock-user-1"` -- that's fine, it gets replaced in feature 5 when the dashboard reads from the database.
- `auth()` is a server-only function. Pages that call it must stay server components.
- `ShiftForm` is already a client component. Adding a `userId` prop to it doesn't need `'use client'` changes.
- After this feature, the only `"mock-user-1"` references should be in `lib/mock-data.ts` (mock data module) and the seed (which uses `seed-user-001`).
