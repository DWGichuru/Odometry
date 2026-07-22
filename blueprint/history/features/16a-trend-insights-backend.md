# Feature: AI trend insights - data model, AI call, and server action

**From build-plan:** feature 16a (part of 16, split from the original single item)
**Status:** not started

## Goal

On request, a driver gets an AI-generated read on their own shift history: the
best times/days to work, how long a shift should run to earn well, and what
isn't working for them. This step builds the storage, the AI call, and the
capped server action; 16b wires it to the trends page UI.

## In scope

- `Insight` Prisma model + migration: stores each generated insight (three text
  fields) with a timestamp, scoped to a user.
- A text-only OpenAI chat completion helper in `lib/openai.ts` (the existing
  helper is vision-only, built for image input), plus a prompt builder there
  that turns a user's shift history into a compact table the model reasons
  over - mirroring how `buildScreenshotExtractionPrompt` already sits next to
  `callOpenAIVision` in that file.
- A parser that validates the model's JSON response.
- `generateTrendInsights()` server action: enforces auth + subscription access
  (existing `checkAccess` pattern), enforces the 5-per-calendar-month cap,
  requires a minimum shift history to generate anything useful, calls the
  model, parses and stores the result.
- `getInsightsStatus()` server action: returns remaining quota this month and
  the most recent stored insight, with no AI call - this is what 16b's page
  load reads.

## Out of scope

- Any UI (button, result panel, loading/error states) - that's 16b.
- Editing or deleting past insights.
- Insight history browsing beyond "the most recent one."
- Configurable cap (5/month is a constant, not a per-user setting).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `Insight` model + migration** - add to `prisma/schema.prisma`:
  `id`, `userId` (FK to `User`, cascade on delete), `bestTimes` (String),
  `idealShiftLength` (String), `notWorking` (String), `createdAt`. Run
  `prisma migrate dev`. *Done when:* migration applies cleanly and
  `prisma migrate status` is in sync.
- [x] **Step 2 - text completion helper + prompt builder** - add
  `callOpenAIChat(prompt: string): Promise<string>` to `lib/openai.ts`, sibling
  to `callOpenAIVision`: same endpoint and model, a single text-only user
  message, no `image_url` content block. Add
  `buildInsightsPrompt(shifts): string` alongside it (same file, matching where
  `buildScreenshotExtractionPrompt` already lives): formats each shift's
  weekday, start time, duration, earnings, trips, distance, and platform into a
  compact table, plus instructions to return
  `{ bestTimes, idealShiftLength, notWorking }` as JSON. Instruct the model to
  fold platform comparison into `notWorking` when one platform earns
  meaningfully less per hour or per trip than another, and to fold earnings
  trend direction (improving/declining over the window) into `bestTimes` when
  the data shows a clear trend - both as free text within the existing three
  fields, no new output fields or schema. *Done when:* both functions compile
  and are exported; no caller yet.
- [x] **Step 3 - response parser, with tests** - add `lib/insights-parser.ts`
  (`parseInsightsResponse(raw: string)`, mirrors `lib/odometer-parser.ts`'s
  tolerance for stray markdown/whitespace, rejects empty or missing fields).
  *Done when:* `insights-parser.test.ts` covers a well-formed response, a
  markdown-fenced response, and a malformed/missing-field response; `npm test`
  passes.
- [x] **Step 4 - `generateTrendInsights` server action, with tests** - add
  `actions/insights.ts`. Reuses the `checkAccess` pattern (auth + `hasAccess`
  subscription check) from `actions/shift-session.ts`. Before calling the
  model: count `Insight` rows for the user with `createdAt >= start of current
  calendar month` (UTC month boundary); if `>= 5`, return
  `{ error: "You've used all 5 insight requests this month. They reset next month." }`.
  Require at least 5 shifts on file; if fewer, return
  `{ error: "Log a few more shifts before requesting insights." }`. Otherwise
  fetch the user's shifts (scoped by `userId`), build the prompt, call
  `callOpenAIChat`, parse the response, `alertOnFailure` and return a friendly
  `{ error }` on any AI/parse failure, then create the `Insight` row and return
  `{ success: true, data: { bestTimes, idealShiftLength, notWorking, remaining, createdAt } }`.
  *Done when:* `insights.test.ts` covers the cap-reached path, the
  too-few-shifts path, and the happy path (mocking `callOpenAIChat` and
  Prisma); `npm test` passes.
- [x] **Step 5 - `getInsightsStatus` server action, with tests** - add to
  `actions/insights.ts`: no AI call, just `checkAccess` + a count of this
  month's `Insight` rows for `remaining` (`5 - count`, floored at 0) + the most
  recent `Insight` row (or `null`). *Done when:* a test covers zero-insights,
  some-insights, and cap-reached cases; `npm test` passes.

## Files / areas

- `prisma/schema.prisma`, `prisma/migrations/` - new `Insight` model
- `lib/openai.ts` - new text-completion helper + prompt builder
- `lib/insights-parser.ts` - new
- `actions/insights.ts` - new (`generateTrendInsights`, `getInsightsStatus`)
- `lib/insights-parser.test.ts`, `actions/insights.test.ts` - new

## Data / contracts

`Insight` model (new, load-bearing for 16b):

```prisma
model Insight {
  id               String   @id @default(cuid())
  userId           String
  bestTimes        String
  idealShiftLength String
  notWorking       String
  createdAt        DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`generateTrendInsights()` return shape (load-bearing for 16b):

```ts
type InsightData = {
  bestTimes: string;
  idealShiftLength: string;
  notWorking: string;
  remaining: number; // requests left this calendar month, after this one
  createdAt: string; // ISO
};
type GenerateResult = { success: true; data: InsightData } | { error: string };
```

`getInsightsStatus()` return shape (load-bearing for 16b):

```ts
type StatusData = {
  remaining: number;
  latest: InsightData | null; // null if no insight generated yet
};
type StatusResult = { success: true; data: StatusData } | { error: string };
```

## Testing

Test command is configured (`npm test`, Vitest) - this feature is entirely
server-side logic, so the gate applies to every step:

- `insights-parser.test.ts` - well-formed JSON, markdown-fenced JSON, and
  malformed/missing-field input.
- `insights.test.ts` - cap-reached, too-few-shifts, and happy-path generation;
  `getInsightsStatus` for zero/some/capped insight counts. Mock Prisma and
  `callOpenAIChat` per the existing pattern in `shifts.test.ts` /
  `shift-session.test.ts`.

No UI in this step, so no browser verification yet - 16b covers that.

## Notes for the AI

- Follow the `checkAccess()` pattern from `actions/shift-session.ts` /
  `actions/odometer-extract.ts` exactly (auth session, then subscription
  `hasAccess` check) rather than inventing a new shape.
- Scope every query by `userId` from the authenticated session - never trust a
  client-supplied id.
- The calendar-month boundary must be computed in UTC to match how the rest of
  the app stores `createdAt` (`DateTime @default(now())` is UTC).
- Keep the prompt data minimal: weekday, start time, duration, earnings,
  platform per shift - no need to send `id`, raw odometer readings, or other
  fields the model doesn't need.
- `alertOnFailure` on any unexpected DB or OpenAI error, matching
  `actions/odometer-extract.ts`; return a user-friendly `{ error }` string
  either way, never a raw exception message.
- Round nothing here - `bestTimes`, `idealShiftLength`, `notWorking` are prose
  strings from the model, not numeric fields.
