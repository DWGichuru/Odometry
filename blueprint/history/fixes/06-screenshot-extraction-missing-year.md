# Fix: Shift list looks unsorted because extracted dates can get the wrong year

**Type:** Fix

## The problem

The `/shifts` list appears out of chronological order, even though
`app/shifts/page.tsx` queries with `orderBy: { date: "desc" }`.

The sort is actually correct on the true stored `date` value (including year).
The bug is that `components/shifts/ShiftListItem.tsx` never displays the year -
only day-of-month and short month name. So a shift whose stored `date` has the
wrong year sorts into the "wrong" position relative to same-month/day entries
while looking identical to a normal date, making it look like a sort bug when
it's really bad data from an earlier step.

Root cause of the bad year: `lib/openai.ts`'s screenshot-extraction prompt
(used by `actions/import.ts`'s `extractShiftFromScreenshot`, which both the
direct `/import` upload and the odometer-photo end-of-shift chain in
`actions/review-shift.ts` rely on) asked GPT-4o-mini for `"date": "YYYY-MM-DD"`
with zero grounding for "today." Rideshare earnings screenshots (Uber/Lyft/
DoorDash weekly summaries) commonly show a date with no year at all (e.g.
"Thu, Jun 26"), so the model had to guess the year blind and could guess wrong.

## The fix

Give the model grounding for "today" and explicit instructions for resolving a
missing year.

- `lib/openai.ts`: turned the static `SCREENSHOT_EXTRACTION_PROMPT` constant
  into `buildScreenshotExtractionPrompt(today: string)`, which now tells the
  model today's date and instructs it to infer a missing year from today's
  date (current year, or previous year if that would place the date in the
  future).
- `callOpenAIVision`'s default `prompt` parameter now calls this builder with
  `new Date().toISOString().slice(0, 10)`, computed fresh at call time.

Must not break: the odometer-reading extraction path
(`callOpenAIOdometerVision` / `ODOMETER_EXTRACTION_PROMPT`), which is untouched
- it doesn't extract a date at all.

**Caveat:** this only prevents the mistake in *future* screenshot/odometer-photo
imports. It does not retroactively fix any shift already saved with a wrong
year from a past extraction - the user needs to check and correct that shift's
date via the edit form (a real HTML date input, which always shows the year),
since we don't know which row(s), if any, are actually affected without asking.

## Build steps

- [x] **Step 1 - Ground the screenshot-extraction prompt with today's date**
  `lib/openai.ts`: replace the static prompt constant with
  `buildScreenshotExtractionPrompt(today)`, and default `callOpenAIVision`'s
  `prompt` param to `buildScreenshotExtractionPrompt(new Date().toISOString().slice(0, 10))`.
  *Done when:* the prompt sent to the vision model includes today's date and
  year-inference instructions. Build passes.

## Verify

- [x] `npm run build` passes.
- [x] `npm run lint` clean on `lib/openai.ts`.
- [x] `npm test -- --run` - no regressions (one pre-existing, unrelated failure
  in `lib/trends.test.ts`, confirmed present on `main` before this change).
- No unit test added: the actual year resolution happens inside the external
  LLM, not in deterministic code we own, so there's no assertable input/output
  to test per the project's testing scope rule (parsers/formatters/validators,
  not prompts sent to a third-party model).
- Not verified end-to-end against a real screenshot in this session (would
  require a live OpenAI call with a test image). Worth a manual `/import` test
  with a screenshot showing a year-less date when convenient.
