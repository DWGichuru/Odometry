# Feature: Odometer vision prompt + response parser + plausibility checks

**From build-plan:** feature 12b
**Status:** not started

## Goal

Send an odometer photo to GPT-4o-mini and extract the numeric reading. Parse the response into a typed value, then run plausibility checks: is this a real odometer reading, not a trip meter? Is it consistent with the driver's last known reading? The result feeds `startShiftSession` and `endShiftSession` from 12a, giving 12c a safe reading to present before the driver confirms.

## Design reference

| Mockup | What it pins down |
| --- | --- |
| [prototypes/capture.html](../../prototypes/capture.html) | Processing state, review-confident panel, review-flagged panel -- the reading, unit, confidence badge, continuity context, and warning display that 12c builds from these contracts |
| [prototypes/theme.css](../../prototypes/theme.css) | Theme tokens already ported in 12a, step 1 (no-op for 12b) |

The prototypes are preserved until all of feature 12 is complete. Do not delete `prototypes/` at `/complete` for 12b.

## In scope

- Refactor `lib/openai.ts` to accept a prompt parameter so the same function serves both screenshot extraction and odometer reading
- Odometer-specific vision prompt telling the model to read a single numeric value from a car odometer photo
- `parseOdometerResponse(raw: string)` -- parse the LLM response into `{ reading: number; unit: "km" | "mi" | null }`
- `checkOdometerPlausibility(reading: number, lastEndOdometer: number | null)` -- validate against trip-meter thresholds and the driver's last known end odometer
- Server action `extractOdometerFromPhoto(imageBase64: string)` -- full pipeline: call vision model, parse, run plausibility, return reading + warnings
- Unit tests for the parser and plausibility checks

## Out of scope

- Camera capture or file upload UI (12c)
- Calling `startShiftSession`/`endShiftSession` (12c calls those after the driver confirms)
- Reading continuity against the last `ShiftSession` -- only `Shift` rows are checked, since completed sessions haven't produced shifts yet and the continuity baseline should be the last *saved* shift's end odometer
- Dashboard in-progress banner (12c)
- Creating a `Shift` row (12d)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Refactor `callOpenAIVision` to accept a prompt parameter**
  Add an optional `prompt` parameter to `callOpenAIVision` with the current `EXTRACTION_PROMPT` as the default. Rename the old prompt to `SCREENSHOT_EXTRACTION_PROMPT` so it's clear which prompt is which. No behavior change for existing callers (`actions/import.ts` stays the same).
  *Done when:* `npm run build` passes and existing screenshot import still works (screenshot import is unchanged -- the default parameter ensures backward compat).

- [x] **Step 2 - Odometer vision prompt + `callOpenAIOdometerVision`**
  Add `ODOMETER_EXTRACTION_PROMPT` constant to `lib/openai.ts` instructing the model to read a single odometer reading and return `{ "reading": number, "unit": "km" | "mi" }`. Add `callOpenAIOdometerVision(imageBase64: string)` wrapper that calls `callOpenAIVision` with the odometer prompt.
  *Done when:* `npm run build` passes.

- [x] **Step 3 - Response parser**
  Create `lib/odometer-parser.ts` with `parseOdometerResponse(raw: string): OdometerReading`. Must: strip code fences (reuse pattern from `lib/extract-parser.ts`), parse JSON, extract `reading` as a number and `unit` as `"km" | "mi"`. Return `{ reading: null, unit: null }` on any parse failure or missing/malformed values. Export the `OdometerReading` type.
  *Done when:* Passing unit tests covering: valid JSON, JSON with code fences, missing reading, missing unit, non-numeric reading, empty string, non-JSON string.

- [x] **Step 4 - Plausibility checks**
  Add `checkOdometerPlausibility(reading: number, lastEndOdometer: number | null)` to `lib/odometer-parser.ts`. It must:
  1. Reject `reading <= 0` as invalid.
  2. Flag `reading < 1000` as a probable trip-meter value (warning, not rejection -- some very new cars exist).
  3. If `lastEndOdometer` is provided: if `reading < lastEndOdometer`, flag a continuity warning (odometer went backward). If equal, warn (car didn't move). If greater, passes.
  4. Flag readings > 1,000,000 as suspicious (hallucination guard).
  5. Return `{ valid: boolean, reading: number, confidence: "high" | "low", warnings: string[] }`. `confidence` is `"high"` when no warnings fire, `"low"` when any warning fires.
  No `lastEndOdometer` → skip continuity check. The caller (server action) is responsible for fetching the last shift's `endOdometer`.
  *Done when:* Passing unit tests covering: valid reading, negative/zero rejected, trip-meter warning, continuity failure, continuity pass, no-history (null lastEndOdometer), hallucination guard.

- [x] **Step 5 - Server action `extractOdometerFromPhoto`**
  Create `actions/odometer-extract.ts` with `extractOdometerFromPhoto(imageBase64: string)`. It must:
  1. Authenticate + check subscription access (reuse `checkAccess` pattern from `actions/shift-session.ts:9-25`).
  2. Call `callOpenAIOdometerVision(imageBase64)`.
  3. Parse with `parseOdometerResponse`.
  4. If parsing fails (reading is null), return `{ error: "Could not read the odometer. Try a clearer photo." }`.
  5. Query the user's most recent `Shift` for `endOdometer` (`prisma.shift.findFirst({ where: { userId }, orderBy: { date: "desc" }, select: { endOdometer: true } })`).
  6. Run `checkOdometerPlausibility(reading, lastEndOdometer)`.
  7. If `!result.valid`, return `{ error: "Invalid odometer reading." }`.
  8. Return `{ success: true, data: { reading: result.reading, unit, confidence: result.confidence, warnings: result.warnings, lastEndOdometer } }`.
  *Done when:* `npm run build` passes (the action calls OpenAI which needs a real API key; verify via build + the parser/plausibility tests covering the logic).

## Files / areas

| File | Action |
|------|--------|
| `lib/openai.ts` | Refactor to accept prompt parameter; add `ODOMETER_EXTRACTION_PROMPT` and `callOpenAIOdometerVision` |
| `lib/odometer-parser.ts` | **New.** `parseOdometerResponse`, `checkOdometerPlausibility`, `OdometerReading`, `PlausibilityResult` types |
| `lib/odometer-parser.test.ts` | **New.** Unit tests for parser and plausibility checks |
| `actions/odometer-extract.ts` | **New.** Server action: `extractOdometerFromPhoto` |
| `actions/import.ts` | Unchanged (still calls `callOpenAIVision` without prompt arg -- uses default) |

## Data / contracts

**OdometerReading (load-bearing for 12c):**
```ts
interface OdometerReading {
  reading: number | null;  // null when LLM couldn't read it
  unit: "km" | "mi" | null;
}
```

**PlausibilityResult (load-bearing for 12c):**
```ts
interface PlausibilityResult {
  valid: boolean;      // false only for hard failures (reading <= 0)
  reading: number;
  confidence: "high" | "low";  // high if no warnings, low if any warning fires
  warnings: string[];  // human-readable flags the UI shows before confirm
}
```

**`extractOdometerFromPhoto` return shape (load-bearing for 12c):**
```ts
// Success:
{ success: true, data: { reading: number, unit: "km" | "mi" | null, confidence: "high" | "low", warnings: string[], lastEndOdometer: number | null } }
// Error:
{ error: string }
```

`confidence` is `"high"` when no warnings fire and `"low"` when any warning fires (the `capture.html` prototype shows a `conf.high` / `conf.low` badge). `lastEndOdometer` is the value from the most recent `Shift` row or `null` if the driver has no shift history. 12c uses it to show "Continues from your last shift (048219 km)".

**Plausibility check thresholds (reasoned, not arbitrary):**

| Check | Threshold | Severity |
|-------|-----------|----------|
| reading <= 0 | n/a | Reject (invalid) |
| reading < 1000 | Trip-meter probable | Warning |
| reading > 1,000,000 | Hallucination guard | Warning |
| reading < lastEndOdometer | Odometer went backward | Warning |
| reading === lastEndOdometer | Car didn't move | Warning |

Warnings don't block -- they're shown to the driver before confirming the reading. The driver decides.

**Continuity check design decision:** checks against the last `Shift` row, not the last `ShiftSession`. Why: a completed session hasn't produced a shift yet (that's 12d's job), and the `Shift` table is the canonical record of driven distances. Checking against sessions would mean a started-but-never-saved session could confuse the continuity baseline.

## Testing

`npm test` is configured -- the test gate applies. The parser and plausibility checks are pure or mockable logic and must ship with tests. The vision model call and server action ride on build + the parser/plausibility tests.

- `lib/odometer-parser.test.ts`: tests for `parseOdometerResponse` (valid JSON, code fences, missing/invalid fields, empty/non-JSON input) and `checkOdometerPlausibility` (valid, negative, trip-meter, continuity, no-history, hallucination). The plausibility function takes `lastEndOdometer` as a parameter -- it's pure, no mocks needed.
- `lib/extract-parser.test.ts` and `actions/shift-session.test.ts` must still pass (no regressions).

## Notes for the AI

- Follow the `checkAccess()` pattern from `actions/shift-session.ts:9-25` for the server action.
- Return shapes: `{ success: true, data }` on success, `{ error: string }` on failure. Consistent with existing actions.
- The refactored `callOpenAIVision` keeps backward compat: make the prompt a second parameter with `EXTRACTION_PROMPT` (renamed to `SCREENSHOT_EXTRACTION_PROMPT`) as default. All existing callers need zero changes.
- Reuse the `stripCodeFences` pattern from `lib/extract-parser.ts` for `parseOdometerResponse`.
- The server action queries `prisma.shift.findFirst({ where: { userId }, orderBy: { date: "desc" }, select: { endOdometer: true } })` for the last shift's `endOdometer`, then passes it to `checkOdometerPlausibility`. The plausibility function itself is pure -- it takes `lastEndOdometer` as a parameter.
- The action file is `actions/odometer-extract.ts` (not `actions/shift-session.ts`) -- it's a separate concern from session lifecycle.
- No Prisma enums or new models in this feature.
- Warnings are informational strings, not error codes. Use plain English like `"This looks like a trip meter, not the odometer."`.
- Continuity warning message must make sense to a driver: `"Reading is lower than your last saved shift. Did you reset the trip meter?"`.
- **Preserve `prototypes/`** -- do not delete the prototypes directory at `/complete` for 12b. They persist until feature 12 is fully complete.
