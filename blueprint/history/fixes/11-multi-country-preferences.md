# Fix: Multi-country support - stateful currency + distance-unit preferences

**Type:** Fix

## Design reference

`prototypes/profile-preferences.html` (approved). Reuses the app's existing
theme tokens as-is; it's the visual target for Step 2 - Currency and Distance
unit become inline `<select>` pill chips in the existing settings-list card
(not a separate modal), each saving immediately on change with a small
auto-dismissing "Saved" confirmation pill. Everything else on the profile page
is unchanged.

## The problem

`User.currency` already exists in the schema and is shown on the profile page,
but it's read-only - there's no UI to change it, and it's never actually used:
money is formatted with a hardcoded `$` in three separate local `formatMoney`
helpers (`app/dashboard/page.tsx`, `components/shifts/ShiftListItem.tsx`,
`lib/trends.ts`) plus a hardcoded `unit: "$"` in `app/trends/page.tsx`'s chart
series. There's no distance-unit preference at all - every distance is always
labeled and treated as km.

There's also a latent, separate bug this fix corrects as a side effect: the
odometer-photo vision model already detects and returns a per-photo
`unit: "km" | "mi"` (`lib/openai.ts`'s prompt, `lib/odometer-parser.ts`'s
`parseOdometerResponse`), but `app/capture/page.tsx` only *displays* that unit
as a label next to the reading - it never converts the value before calling
`startShiftSession`/`endShiftSession`. A US driver's miles-denominated odometer
is silently stored as if it were km today.

## The fix

**Data reality check that simplifies the migration**: `currency` has never been
set to anything but `"USD"` anywhere in this codebase (no editor exists yet, and
seed scripts hardcode `"USD"`) - so every existing row is USD. That makes
"backfill distanceUnit based on currency" and "just default the new column to
MI" identical in practice today. No conditional SQL backfill is needed; a plain
Prisma default suffices and stays correct for future signups too (which are
also always created with `currency: "USD"` today, via schema default, in both
`actions/auth.ts` and the Google OAuth path in `auth.ts`).

Six pieces:

1. **Schema + conversion utilities.**
   - `prisma/schema.prisma`: add `enum DistanceUnit { KM MI }` and
     `User.distanceUnit DistanceUnit @default(MI)` (see reality check above for
     why `MI` is the correct flat default, not `KM`). Migrate with
     `prisma migrate dev`.
   - `lib/units.ts` (new): `kmToMiles`, `milesToKm`, `formatDistance(km,
     unit)`. Pure, unit-tested (`lib/units.test.ts`).
   - `lib/currency.ts` (new): `formatMoney(value, currencyCode)` using
     `Intl.NumberFormat`, `currencySymbol(currencyCode)`. Pure, unit-tested
     (`lib/currency.test.ts`).
2. **Profile page: stateful preferences.** `actions/profile.ts` (new) -
   `updateProfilePreferences` server action validating `currency` (one of the 5
   in `CURRENCY_NAMES`) and `distanceUnit` (`KM`/`MI`), updating
   `prisma.user.update`. `components/profile/PreferencesForm.tsx` (new, client)
   - two selects wired to the action. Replaces the read-only currency row in
   `app/profile/page.tsx` and adds a new distance-unit row.
3. **Display propagation - money.** Replace the three hardcoded `formatMoney`
   duplicates and the chart's hardcoded `"$"` with `lib/currency.ts`, driven by
   the signed-in user's stored `currency`: `app/dashboard/page.tsx`,
   `components/shifts/ShiftListItem.tsx` (needs a new `currency` prop from
   `app/shifts/page.tsx`), `lib/trends.ts`'s `formatTrendTotal`/
   `formatTrendRate` (take a currency symbol param instead of assuming `$`),
   `app/trends/page.tsx` (passes the real symbol instead of literal `"$"`).
4. **Display propagation - distance.** Convert `distanceKm`/`startOdometer`/
   `endOdometer` to the user's preferred unit for display and relabel
   accordingly: `app/dashboard/page.tsx` (shift rows, and "Avg per km" becomes a
   genuinely recomputed "Avg per mi", not just relabeled), 
   `components/shifts/ShiftListItem.tsx`, `components/dashboard/LiveBanner.tsx`
   (start-odometer/distance-so-far chips), `lib/trends.ts` (`earningsPerKm` ->
   computed per-mile when applicable) + `app/trends/page.tsx` ("Per km" -> "Per
   mi" series label).
5. **Input propagation - manual entry & screenshot import.**
   `components/shifts/ShiftForm.tsx` (odometer/distance field labels reflect the
   user's unit; `$` prefix becomes the user's currency symbol) and
   `app/import/page.tsx` (review form's end-odometer field and `$` prefix, same
   treatment). Conversion to canonical km happens server-side in
   `actions/shifts.ts` (`createShift`/`updateShift`) and `actions/import.ts`,
   driven by the authenticated user's stored `distanceUnit` - not trusted from
   the client - consistent with this project's existing pattern of server-side
   validation in these actions.
6. **Odometer photo capture: fix the latent unit bug.** In
   `actions/odometer-extract.ts` (or `app/capture/page.tsx`'s call site),
   convert the extracted reading to canonical km before it reaches
   `startShiftSession`/`endShiftSession`: use the photo-detected `unit` when
   non-null (ground truth for that specific car), otherwise fall back to the
   signed-in user's stored `distanceUnit` preference (manual entry / detection
   failure). Fix `checkOdometerPlausibility` in `lib/odometer-parser.ts` (or its
   call site) to run against the already-converted km reading, not the raw
   photo reading, so the trip-meter/continuity thresholds stay meaningful.
   Update `app/review-shift/page.tsx`'s displayed odometer values to show the
   user's preferred unit (display-only conversion; the save path already
   receives canonical km from step 6's fix).

Must not break: existing stored `Shift`/`ShiftSession` data (all remains
canonical km in the DB; only display and entry points change), the Stripe
subscription price display in `components/billing/PlanCard.tsx` (that's a fixed
USD subscription price, unrelated to the driver's earnings currency - out of
scope, must not be touched).

## Build steps

- [x] **Step 1 - Schema + conversion utilities.** Add the `DistanceUnit` enum +
      `User.distanceUnit` field + migration, `lib/units.ts` +
      `lib/units.test.ts`, `lib/currency.ts` + `lib/currency.test.ts`. Done
      when: `npx prisma migrate dev` succeeds, `npm test` passes with new cases
      green for both new lib files.
- [x] **Step 2 - Profile page: stateful preferences.** Add
      `actions/profile.ts`, `components/profile/PreferencesForm.tsx`, wire into
      `app/profile/page.tsx`. Done when: changing currency or distance unit in
      the profile UI persists (verified via a DB read/reload), with validation
      rejecting an unsupported code.
- [x] **Step 3 - Display propagation: money.** Replace hardcoded `$`/local
      `formatMoney` duplicates per the file list above. Done when: a user with
      `currency: "EUR"` sees `€` (not `$`) on dashboard totals, shift list
      amounts, and trends chart labels/tooltips.
- [x] **Step 4 - Display propagation: distance.** Convert + relabel per the
      file list above. Done when: a user with `distanceUnit: "MI"` sees miles
      (not km) on dashboard shift rows, the "Avg per mi" stat (a real
      recomputation, not a relabel), the live banner, and trends' "Per mi"
      series - and the underlying numbers are mathematically converted, not
      just relabeled.
- [x] **Step 5 - Input propagation: manual entry & screenshot import.** Update
      `ShiftForm.tsx`/`import/page.tsx` labels and symbols, add server-side
      conversion in `actions/shifts.ts`/`actions/import.ts`. Done when: a
      `distanceUnit: "MI"` user entering "100" in "Distance covered (mi)" saves
      a `Shift.distanceKm` of ~160.9, verified via a DB read.
- [x] **Step 6 - Odometer photo capture: fix the latent unit bug.** Add
      conversion in `actions/odometer-extract.ts`/capture call site, fix
      `checkOdometerPlausibility`'s unit assumption, update
      `review-shift/page.tsx` display. Done when: a simulated `unit: "mi"`
      photo response with reading `100000` produces a canonical
      `ShiftSession.endOdometer` of ~160934 (not `100000`), and plausibility
      warnings are evaluated against that converted value.

## Testing

- `lib/units.ts` and `lib/currency.ts` are pure logic with real edge cases (0,
  rounding, unsupported currency codes) - ship with unit tests per
  `coding-standards.md`'s Testing gate.
- The conversion fix in Step 6 (`checkOdometerPlausibility`'s new unit-aware
  call site) is logic-bearing - add a focused test case for the
  mi-input-produces-km-output path in `lib/odometer-parser.test.ts`.
- Steps 2-5 are primarily UI/server-action integration (forms, DB round-trips) -
  ride on browser verification (Playwright is installed) plus a direct DB read
  to confirm persisted/converted values, per `coding-standards.md`.

## Verify

- `npm run build` and `npm test` both pass.
- Profile: changing currency and distance unit persists across a reload.
- Dashboard/shifts/trends reflect the stored currency symbol and distance unit,
  with genuinely recomputed per-unit rates, not just relabeled numbers.
- Manual entry, screenshot import, and odometer-photo capture all produce
  canonical km in the database regardless of the unit the user saw/entered.
- A pre-existing user (currency `"USD"`, no explicit distanceUnit set before
  this migration) reads as `distanceUnit: "MI"` after migration.
