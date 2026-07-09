# Fix: Trends legend spacing and money precision

**Type:** Fix

## The problem

Two cosmetic issues on the Trends page (`/trends`):

1. **Legend chips run together.** `TrendLineChart` renders its legend in
   `<div className="legend">`, but no `.legend` rule existed in `app/globals.css`.
   With no container gap, the `.chip` buttons butted against each other
   ("Per hour $26.47Per trip $10.27...").
2. **Ugly money precision.** `formatTrendTotal` in `lib/trends.ts` formatted dollar
   values with a bare `value.toLocaleString()`, so rate values rendered with raw
   precision like `$10.266` and `$1.983`.

> Note: these surfaced while reviewing the trends screen at mobile width. The
> black-chart / unstyled-toggle rendering seen alongside them was a stale dev
> server (old compiled CSS), not a code defect, and needed no change.

## The fix

- Added a `.legend` rule (`display: flex; flex-wrap: wrap; gap`) so the chips
  space out and wrap.
- Capped the `"$"` branch of `formatTrendTotal` at 2 fraction digits with
  thousands separators (`$10.27`, `$1.98`, `$1,098.50`).
- Did not break: the trends Playwright suite (chip text is matched by series
  name, not value) or non-money units (hours/trips/km).

## Build steps

- [x] Add `.legend` flex/gap rule to `app/globals.css`.
- [x] Cap `formatTrendTotal` money output at 2 decimals in `lib/trends.ts`.

## Verify

- [x] `/trends` renders spaced legend pills and clean money values (verified via
  fresh-server screenshot capture).
- [x] `npm run build` compiles; TypeScript clean.
- [x] `npx playwright test tests/trends.spec.ts` - 14/14 pass.
- [x] `npm run lint` clean (pre-existing `billing.ts` warnings only).
