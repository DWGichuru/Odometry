# Partial `PATCH /shifts/{id}` breaks

**Type:** Fix

Source: `blueprint/ios-conversion/server-fix-queue.md` item 1 (guide refs K1, K2).

## The problem

`handleUpdateShift` in `app/api/v1/shifts/[id]/route.ts` fills omitted fields from
the stored row, but the stored values are in the wrong shape for
`validateShiftEntry` / `buildShift` (`lib/shift-entry.ts`):

- **Times (K1):** an omitted `startTime`/`endTime` falls back to
  `existing.startTime.toISOString()` (`2026-10-30T17:00:00.000Z`). `buildShift`
  splits on `:` expecting `HH:MM`, gets `NaN`, builds an Invalid Date, Prisma throws,
  and the client gets `500 INTERNAL_ERROR`.
- **Odometer (K2):** omitted `startOdometer`/`endOdometer` fall back to the stored
  **km** values, which then pass through `convertOdometerFieldsToKm`. For `MI` users
  they are multiplied by 1.60934 again, so the stored odometer and `distanceKm` grow
  silently on every partial update.

## The fix

Move the "body + stored row -> `ShiftFormData`" merge out of the route into a pure,
testable function, and make the fallbacks match the input shape:

- **New `lib/shift-update.ts`** exporting `mergeShiftUpdate(body, existing, unit)`,
  returning the `ShiftFormData` to validate plus a flag for whether any time-defining
  field (`date`, `startTime`, `endTime`) was sent.
- **Odometer:** run `convertOdometerFieldsToKm` only over the fields the client
  actually sent (`startOdometer`, `endOdometer`, `distance`). Stored fallbacks are
  already km and pass through unconverted. A mixed request (only `endOdometer` sent)
  converts just that field.
- **Times, one sent:** an omitted `startTime`/`endTime` falls back to the stored
  instant formatted as `HH:MM` in UTC (stored manual/screenshot times are floating
  UTC; see queue item 3).
- **Times, none sent:** if the body has none of `date`, `startTime`, `endTime`, the
  route writes `existing.startTime`/`existing.endTime` back unchanged instead of the
  rebuilt values. Without this, an amount-only PATCH on an `ODOMETER` shift (real
  instants, seconds included) would be rewritten as floating time and lose seconds.
- **Route:** `handleUpdateShift` calls `mergeShiftUpdate`, keeps the existing
  validation, `buildShift`, and `prisma.shift.update`, and applies the time
  preservation above.

**Must not break:**

- Full-payload PATCH (what the iOS guide tells clients to send today) produces the
  same row as before: all fields sent means every value is converted and rebuilt
  exactly as now.
- `odoMode: "distance"` with `distance` still back-calculates `startOdometer`.
- 404 for another user's shift and 403 without a subscription, unchanged.
- The web edit path (`actions/shifts.ts`) is untouched; it always posts full forms.

**Out of scope:** the floating-vs-instant meaning of the time columns (queue item 3),
and the existing default of `odoMode` to `"odometer"` when omitted.

## Build steps

- [x] **Step 1 - `mergeShiftUpdate` + tests.** Add `lib/shift-update.ts` and
  `lib/shift-update.test.ts`. Cases: `MI` user, body `{ amountEarned: 50 }` keeps
  stored km odometer values and `HH:MM` UTC times; `MI` body with only `endOdometer`
  converts that field only; `KM` user unchanged; only `endTime` sent keeps start
  time as stored `HH:MM`; full payload matches today's conversion; `odoMode:
  "distance"` path.
  **Done when:** `npm test` is green with the new suite.
- [x] **Step 2 - wire it into the route + route test.** Replace the inline merge in
  `handleUpdateShift`, add the time preservation, and add
  `app/api/v1/shifts/[id]/route.test.ts` (mock `@/lib/prisma` and `requireAuth`,
  following `actions/shifts.test.ts`).
  **Done when:** tests show a `MI` user PATCHing `{ "amountEarned": 50 }` gets `200`
  with `startTime`, `endTime`, `startOdometer`, `endOdometer`, `distanceKm`
  unchanged in the `prisma.shift.update` call; `{ "endTime": "23:00" }` keeps the
  start time; a full-payload PATCH writes the same data as before; `npm test`,
  `npm run lint`, and `npm run build` pass.

## Verify

- `npm test`: the cases above.
- Optional manual check against the dev server: sign in through `/api/v1/auth`, then
  `curl -X PATCH /api/v1/shifts/<id>` with `{"amountEarned": 50}` as a `MI` user.
  Expect `200` and, via `GET`, identical times and odometer values.

## After `/complete`

Per the queue's checklist:

1. Tick item 1 in `blueprint/ios-conversion/server-fix-queue.md` with the history
   file name.
2. In `api-implementation-guide.md`: delete K1/K2 from section 9, relax "Always send
   every field" in 6.3 (around line 452), the `PATCH` row near line 42, and the
   checklist line near 1222.
