# Feature: Earnings export

**From build-plan:** feature 15
**Status:** not started

## Goal

Let a driver download their earnings data for a period they choose, either as a PDF summary (the headline totals and rates) or a CSV of every shift in that period (raw + calculated fields). Lives on its own `/export` page, linked from `/trends`.

## Design reference

- **`prototypes/export.html`** - the `/export` page: segmented Month/Year/Custom picker (pill toggle + swapping inline fields), a dashboard-style hero (period label, big total-earnings number, "N shifts logged" pill) followed by a 3x2 stat grid (hours, trips, distance, $/hr, $/trip, $/km-or-mi), then the two download buttons (PDF primary/accent, CSV secondary/quiet, each with the download-arrow icon). Toggle "Empty period" in the mockup for the zero-shift state: all-zero stats, an inline "No shifts in this period" note, both buttons disabled.
- **`prototypes/trends-export-link.html`** - the one change to the existing `/trends` page: a download-icon link added to its header, next to the week/month pill toggle. Toggle "Before/After" to see exact placement. The chart cards below are placeholders only - `/trends` itself is unchanged.
- **Theme tokens:** `prototypes/theme.css` already mirrors `app/globals.css` (confirmed - `--radius-sm`, `--surface-raised`, `--accent-muted`, `--card-shadow` etc. all already exist there). No porting step needed; build directly against the app's existing Tailwind `@theme` tokens using the mockups' class names as a guide (`card`, `btn`/`btn-accent`/`btn-quiet`, `pill`) where the app has equivalent utility classes, or matching Tailwind classes where it doesn't.
- The download icon is the Feather-style `download` glyph (tray + arrow), matching the sign-out icon already in `app/profile/page.tsx` (`viewBox="0 0 24 24"`, `stroke-width={2}`, round caps) - reuse that exact icon style for both the button icons and the Trends header link.

## In scope

- A period picker with three modes: a specific month, a specific year, or a custom date range.
- A summary preview on the page showing the same totals the PDF will contain, for the selected period, before downloading anything.
- CSV download: one row per shift in the period, including calculated fields (hours worked, distance), scoped to the signed-in user, in the user's currency and distance unit.
- PDF download: one-page summary with total earnings, total hours, total distance, total trips, earnings/hour, earnings/trip, earnings/km (or /mi), for the selected period.
- A link from the `/trends` page header to `/export`.
- Empty-period handling: a period with zero shifts shows a zero-value preview, not an error.

## Out of scope

- Emailing or scheduling recurring exports.
- An export history/audit log.
- Exporting anything other than `Shift` rows (no `ShiftSession` data).
- Currency conversion - values export as stored, in the user's current `currency` setting.
- Pagination or row limits for very large ranges (no driver will plausibly exceed what fits in one CSV).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Export period & summary logic (`lib/export.ts`)** - Pure functions: `resolveExportPeriod(searchParams)` turns `{period: "month", year, month}` / `{period: "year", year}` / `{period: "range", start, end}` query params into `{ start: Date; end: Date; label: string; filenameSuffix: string }` or an error, using UTC date math (mirror `lib/trends.ts`'s `Date.UTC` approach to avoid timezone drift at month/year boundaries); `summarizeShifts(shifts)` reduces a shift list to `{ totalEarnings, totalHours, totalTrips, totalDistanceKm, earningsPerHour, earningsPerTrip, earningsPerKm, shiftCount }`, returning zeros (not `NaN`) when `shiftCount` is 0; `shiftsToCsv(shifts, distanceUnit, currencyCode)` builds a CSV string (header row + one row per shift: date, platform, start time, end time, hours, amount earned, trips, distance, entry source) with correct quoting/escaping for any field containing a comma, quote, or newline. *Done when:* `npm test` passes, covering month/year/range resolution (including Feb in a leap year and a Dec-to-Jan year boundary), invalid input (bad month number, end before start, non-numeric year) returning an error, `summarizeShifts` with zero shifts, and `shiftsToCsv` escaping and a multi-row happy path.

- [x] **Step 2 - CSV export route (`app/api/export/csv/route.ts`)** - `GET` handler: 401 if signed out; parse `request.nextUrl.searchParams` via `resolveExportPeriod`, 400 with the error message if invalid; fetch the signed-in user's `currency`/`distanceUnit` and their `Shift` rows in range (scoped by `userId`, never a client-supplied id); build the CSV via `shiftsToCsv`; respond with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="..."` using the resolved period's `filenameSuffix`. *Done when:* signed in, visiting `/api/export/csv?period=year&year=2026` downloads a CSV with a header row and one row per 2026 shift for that user only; signed out returns 401; `/api/export/csv?period=month&year=2026&month=13` returns 400.

- [x] **Step 3 - PDF export route (`app/api/export/pdf/route.ts`)** - Add the `pdf-lib` dependency. `GET` handler mirrors step 2's auth/period/access logic, calls `summarizeShifts`, and renders a one-page PDF (title, resolved period label, generated-on date, then each metric formatted with the user's currency symbol via `lib/currency.ts` and distance unit via `lib/units.ts`). Responds with `Content-Type: application/pdf` and the same `Content-Disposition` convention as step 2. *Done when:* signed in, visiting `/api/export/pdf?period=month&year=2026&month=7` downloads a PDF that opens and shows totals matching the database for that month; signed out returns 401; an invalid period returns 400.

- [x] **Step 4 - `/export` page, period picker, and Trends link** - `app/export/page.tsx` (server component) reads the same query-param contract as steps 2-3 from `searchParams`, defaulting to the current month when absent; fetches the user's shifts in range and renders the hero + stat-grid preview via `summarizeShifts` matching the PDF's metrics, per `prototypes/export.html`; renders two download links (PDF primary, CSV secondary, download-arrow icon on both) pointing at the CSV/PDF routes with the matching query string, disabled when `shiftCount` is 0. `components/export/PeriodForm.tsx` (client component, radio-driven visibility only) renders the three input groups - month+year selects, year select, start/end date inputs - swapping visibility exactly as the mockup's mode toggle does, and submits via a plain `GET` form to `/export` (no fetch/JS state beyond toggling which group is visible), so the server component re-renders with the new period. Add the download-icon link in the `/trends` header per `prototypes/trends-export-link.html` (same position, same icon as the mockup) pointing to `/export`. *Done when:* `/export` loads with the current month selected and a real preview matching the mockup's layout; switching to Year or Custom Range and submitting shows that period's totals; both download links trigger a browser download of the currently selected period; the `/trends` icon link navigates to `/export` from the same header position shown in the mockup; a period with zero shifts shows an all-zero preview with disabled download buttons, not an error.

## Files / areas

| File | Action |
| --- | --- |
| `lib/export.ts` | **Create** - `resolveExportPeriod`, `summarizeShifts`, `shiftsToCsv` |
| `lib/export.test.ts` | **Create** |
| `app/api/export/csv/route.ts` | **Create** |
| `app/api/export/pdf/route.ts` | **Create** |
| `app/export/page.tsx` | **Create** |
| `components/export/PeriodForm.tsx` | **Create** |
| `app/trends/page.tsx` | Modify - add export icon link in header |
| `package.json` | Modify - add `pdf-lib` dependency |

## Data / contracts

- **Query param contract** (shared by both routes and the page - load-bearing, keep in sync):
  - `?period=month&year=YYYY&month=M` (`M` is 1-12)
  - `?period=year&year=YYYY`
  - `?period=range&start=YYYY-MM-DD&end=YYYY-MM-DD` (inclusive both ends)
- **`ResolvedPeriod`**: `{ start: Date; end: Date; label: string; filenameSuffix: string }`
- **`ExportSummary`**: `{ totalEarnings: number; totalHours: number; totalTrips: number; totalDistanceKm: number; earningsPerHour: number; earningsPerTrip: number; earningsPerKm: number; shiftCount: number }`
- No schema changes - reads the existing `Shift` model only.

## Testing

- Test command is declared (`npm test`, Vitest) - the gate applies. `lib/export.ts` is pure logic (date-range resolution, aggregation, CSV formatting/escaping) and ships tests in step 1, per the cases listed in that step's done-when.
- Route handlers and the page are integration/UI surfaces - verify with the running app: `curl` or a signed-in browser hit against both routes (check headers, filename, and content), and a manual click-through of the period picker + downloads on `/export` and the new link on `/trends`.

## Notes for the AI

- No paywall check on the export routes/page - `/trends` (its sibling analytics page) only checks `auth()`, not `hasAccess()`; match that precedent for consistency rather than introducing a new gating rule here.
- Scope every query by `session.user.id`, never a client-supplied id (existing convention in `actions/shifts.ts`).
- Reuse `formatMoney`/`currencySymbol` (`lib/currency.ts`) and `kmToMiles`/`formatDistance` (`lib/units.ts`) rather than reimplementing formatting.
- The mockups are throwaway once step 4 lands - discard `prototypes/export.html` and `prototypes/trends-export-link.html` at `/complete` along with the rest of this feature's archiving.
- `Shift.date` is a `@db.Date` column - compare it the same UTC-safe way `lib/trends.ts` already does, to avoid off-by-one-day bugs at period boundaries.
- Route handlers, not server actions, per `coding-standards.md`'s Next.js guidance ("specific HTTP status codes or headers") - both downloads need `Content-Disposition`.
