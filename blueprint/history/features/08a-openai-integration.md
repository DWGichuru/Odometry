# Feature: OpenAI GPT-5.4 Nano integration

**From build-plan:** feature 8a
**Status:** not started

## Goal

Build the backend integration that calls OpenAI GPT-5.4 Nano (vision model) to extract shift statistics from a rideshare earnings screenshot. This creates the extract capability with a testable parser and a server action. The import UI (8b) builds on this.

## Design reference

Real Uber earnings screenshots in `blueprint/reference/` (IMG_3941, IMG_3944, IMG_3945, IMG_3946). These are the actual screenshot formats the AI must parse. Key observation: none of the screenshots contain odometer readings -- `endOdometer` will always be null from extraction. The user enters odometer manually during the review step (feature 8b).

## In scope

- A `lib/openai.ts` module that calls the OpenAI API with a base64-encoded image and a structured extraction prompt, returning the raw API response
- A `lib/extract-parser.ts` module containing a pure function `parseExtractionResponse(rawJson: string)` that parses the OpenAI response into typed `ExtractedShiftFields` (date, platform, startTime, endTime, amountEarned, tripsCompleted, endOdometer) with nulls for unextractable fields
- A `actions/import.ts` server action `extractShiftFromScreenshot(formData: FormData)` that receives a screenshot file + start odometer, calls OpenAI, parses the response, and returns `{ success, data }` or `{ error }`
- Modify `buildShift` in `lib/shift-entry.ts` to accept an optional `entrySource` parameter (defaults to `MANUAL` so existing callers are unaffected)
- Add `OPENAI_API_KEY` to `.env.example` and note it in the spec
- Unit tests for `parseExtractionResponse` covering valid responses, partial responses, malformed JSON, and edge cases

## Out of scope

- The import UI, file upload component, review/edit form, and save flow -- these are 8b
- Any `/import` route or page
- Middleware protection for `/import`
- Navigation links to the import page

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Response parser + tests** -- Create `lib/extract-parser.ts` with the `ExtractedShiftFields` type and `parseExtractionResponse(rawJson: string)` function. The function parses a JSON string from the AI model, validates field types (date as string, platform as one of UBER/LYFT/DOORDASH/null, times as strings, amounts as numbers, etc.), and returns `ExtractedShiftFields` with null for any field that is missing, malformed, or unparseable. Create `lib/extract-parser.test.ts` with tests covering: fully valid response, response with all fields null, response with some nulls, completely invalid JSON, valid JSON with wrong types, and an empty response. Also modify `lib/shift-entry.ts`: add optional `entrySource` parameter to `buildShift` (default `EntrySource.MANUAL`). Update existing tests to pass unchanged. *Done when:* all new parser tests pass, existing tests pass, and build + lint pass.

- [x] **Step 2 - OpenAI API call + server action** -- Create `lib/openai.ts` with a function `callOpenAIVision(imageBase64: string): Promise<string>` that sends the base64 image to the OpenAI API (`https://api.openai.com/v1/chat/completions`) using the vision format with a structured extraction prompt. Uses `OPENAI_API_KEY` from `process.env`. Model: `gpt-5.4-nano`. Create `actions/import.ts` with `extractShiftFromScreenshot(formData: FormData)` server action: auth guard, extracts the file + startOdometer from FormData, converts file to base64, calls `callOpenAIVision`, runs `parseExtractionResponse`, returns `{ success: true, data: ExtractedShiftFields & { startOdometer: string } }` or `{ error: string }`. Handle errors at each stage: no file, file too large (>10MB), non-image type, API failure, parse failure. Add `OPENAI_API_KEY` to `.env.example`. *Done when:* the server action compiles, the action properly guards auth and validates input, build + lint + all tests pass.

## Files / areas

| File | Action |
|---|---|
| `lib/extract-parser.ts` | Create -- types and parse function |
| `lib/extract-parser.test.ts` | Create -- unit tests for the parser |
| `lib/openai.ts` | Create -- OpenAI API call |
| `actions/import.ts` | Create -- extractShiftFromScreenshot server action |
| `lib/shift-entry.ts` | Modify -- add optional `entrySource` param to `buildShift` |
| `.env.example` | Modify -- add `OPENAI_API_KEY` |

## Data / contracts

### ExtractedShiftFields (lib/extract-parser.ts)

```ts
interface ExtractedShiftFields {
  date: string | null;           // "YYYY-MM-DD"
  platform: Platform | null;     // "UBER" | "LYFT" | "DOORDASH"
  startTime: string | null;      // "HH:MM"
  endTime: string | null;        // "HH:MM"
  amountEarned: number | null;
  tripsCompleted: number | null;
  endOdometer: number | null;
}
```

### OpenAI API contract

- Endpoint: `POST https://api.openai.com/v1/chat/completions`
- Model: `gpt-5.4-nano`
- Auth: `Authorization: Bearer ${OPENAI_API_KEY}`
- Request body: OpenAI chat completions with vision content array
- Response: `{ choices: [{ message: { content: "..." } }] }`

### extractShiftFromScreenshot return shape

```ts
{ success: true, data: ExtractedShiftFields & { startOdometer: string } }
// or
{ error: string }
```

### buildShift signature change

```ts
// Before:
export function buildShift(data: ShiftFormData, userId: string): Shift
// After:
export function buildShift(data: ShiftFormData, userId: string, entrySource?: EntrySource): Shift
```

## Testing

The parser (`parseExtractionResponse`) is pure logic -- it must ship with tests in step 1. The reference screenshots (`blueprint/reference/IMG_394*.jpeg`) are real Uber earnings screenshots that inform the test fixtures.

Cover:
- Fully valid response with all fields populated (simulating a clear, well-structured screenshot)
- Response with `endOdometer: null` (the common case -- Uber screenshots don't show odometer readings)
- Response with some fields null (partial extraction -- e.g. missing `tripsCompleted`, missing `startTime`)
- Response with all fields null (extraction failed entirely)
- Invalid JSON (the model returned text, not JSON)
- Valid JSON with wrong types (e.g. `date` as a number)
- Response wrapped in markdown code fences (` ```json ... ``` `)
- Empty string / whitespace-only input
- Platform normalization: "uber" → UBER, "Uber" → UBER, "UBER" → UBER, "unknown" → null

The OpenAI API call and server action are integration-level (external API + file I/O), verified by build + lint evidence. The existing test suite must stay green.

## Notes for the AI

- `parseExtractionResponse` should strip markdown code fences before parsing (`\`\`\`json`, `\`\`\``) since the AI may wrap the response. Extract the content between fences, or fall back to the raw string.
- `ExtractedShiftFields.platform` should accept `Platform | null`. The parser validates against the `Platform` enum values; anything unrecognized becomes `null`. Do a case-insensitive check: "uber" → UBER, "Uber" → UBER, "unknown" → null.
- The OpenAI API key stays server-side: `process.env.OPENAI_API_KEY`, never sent to the client.
- For file-to-base64 conversion: `Buffer.from(await file.arrayBuffer()).toString("base64")`.
- File validation in the server action: reject if `file.size > 10 * 1024 * 1024` (10MB limit). If `file.type` is set and doesn't start with `"image/"`, reject. If `file.type` is empty (some mobile browsers don't set it), accept the file.
- The extraction prompt should instruct the model to return ONLY a JSON object with the specified fields, no surrounding text. The prompt should ask for all fields (date, platform, startTime, endTime, amountEarned, tripsCompleted, endOdometer) but note that some fields may not be visible in the screenshot (e.g. Uber screenshots lack odometer). Return `null` for any field that can't be found.
- Reference screenshots are in `blueprint/reference/IMG_394*.jpeg` -- real Uber earnings screenshots. These show what the AI must parse. Key observation: none contain odometer readings; `endOdometer` will always be `null` from extraction. The review step (feature 8b) must let users enter odometer manually.
- After JSON.parse, coerce types: `Number(value)` for numeric fields, check `!isNaN()`.
- The `buildShift` change is backward-compatible: the new `entrySource` param defaults to `EntrySource.MANUAL`. Update the function body to use the parameter instead of the hardcoded value. Existing callers don't need changes; existing tests pass as-is.
