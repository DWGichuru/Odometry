# Fix: personalize the trend insights tone

**Type:** Fix

## The problem

`generateTrendInsights` (16a, `actions/insights.ts` + `lib/openai.ts`) produces
insights that read like a third-person analytics report ("This driver earns
the most on..." style phrasing driven by the prompt's own wording) rather than
advice written to the driver. Two causes in `lib/openai.ts`:

- `buildInsightsPrompt` (line 105) frames every field around "this driver" in
  the third person, and never has access to the driver's name.
- `callOpenAIChat` (line 148) calls the model at `temperature: 0.3`, which
  favors the same templated phrasing on every request.

## The fix

- `buildInsightsPrompt(shifts, driverName?)` - add an optional second
  parameter. Rewrite the prompt to instruct the model to write directly to the
  driver in second person ("you"/"your"), in a warm, conversational,
  encouraging tone (like a coach, not an analyst) that is also honest and
  critical - the coach calls out what's underperforming or costing the driver
  money directly, not just what's going well, so the driver gets maximum
  value out of their history rather than a pep talk. When `driverName`
  is provided, tell the model to address them by name at least once; when it
  isn't, the second-person framing still works with no name needed. Keep the
  existing constraints: grounded only in the supplied data, no invented
  numbers, 1-3 sentences per field, JSON-only output matching the current
  `{ bestTimes, idealShiftLength, notWorking }` shape (the response parser and
  `InsightData` contract are unchanged).
- `callOpenAIChat` - raise `temperature` from `0.3` to `0.65` for more natural
  variation between requests. `max_tokens` stays at 500.
- `actions/insights.ts` (`generateTrendInsights`) - fetch the signed-in
  driver's `name` (a small `prisma.user.findUnique` alongside the existing
  shifts query) and pass it as `buildInsightsPrompt`'s second argument. Handle
  a null/missing name by omitting it (no placeholder like "Driver").
- Must not break: the JSON contract `parseInsightsResponse` expects, the
  5-per-month cap, the 5-shift minimum, or any existing 16a/16b behavior.
  `getInsightsStatus` is untouched.

## Build steps

- [x] **Step 1 - rewrite the prompt, wire the driver's name through, add
  tests** - update `buildInsightsPrompt` and `callOpenAIChat` in
  `lib/openai.ts`; update `generateTrendInsights` in `actions/insights.ts` to
  fetch and pass the driver's name; update `actions/insights.test.ts`'s mocked
  `prisma` to include a `user.findUnique` mock so existing tests keep passing;
  add `lib/openai.test.ts` covering `buildInsightsPrompt`'s pure-logic
  behavior: includes the driver's name when provided, doesn't break or emit a
  placeholder when the name is absent, and still embeds every shift row.
  *Done when:* `npm run build` and `npm test` both pass, and a manual
  `generateTrendInsights()` call (via the running `/trends` page, same as
  16b's manual verification) returns insights that read as direct,
  personalized advice rather than third-person analysis.

## Verify

- `npm test` - new `lib/openai.test.ts` cases pass, `actions/insights.test.ts`
  still passes with the added `user.findUnique` mock.
- `npm run build` passes.
- Manual: on `/trends` with a signed-in user who has 5+ shifts and a `name`
  set, click "Get insights" and confirm the result addresses the driver in
  second person (and by name), reads as encouraging/conversational rather than
  clinical, is honest/critical about what's underperforming rather than only
  praising, and still only reports numbers present in the shift data.
