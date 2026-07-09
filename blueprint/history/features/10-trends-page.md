# Feature: Trends page

**From build-plan:** feature 10
**Status:** not started

## Goal

A dedicated trends page (`/trends`) with chart visualizations showing the driver's
earnings, hours, trips, and distance trends over time. Seven metrics tracked per
period (week or month): total earnings, total hours, total trips, total distance
km, earnings/hour, earnings/trip, and earnings/km.

## Design reference

- `prototypes/theme.css` -- design tokens (chart color variables, card styles, legend chips, tooltip)
- `prototypes/trends-week.html` -- weekly view with data, the primary visual target
- `prototypes/trends-month.html` -- monthly view (same layout, different data/period)
- `prototypes/trends-empty.html` -- empty state (no shifts yet)

The prototypes use **custom SVG charts** (same approach as the dashboard's
CSS bar chart, extended to line/area charts). No charting library. All
interaction (legend toggles, drag-to-scrub tooltip) is hand-built.

## In scope

- `/trends` page accessible to signed-in users (auth gate only; paywall middleware handles subscription)
- Port chart design tokens from `prototypes/theme.css` into `app/globals.css`
- Period selector: pill toggle (Week | Month) matching prototype style
- Two chart sections (matching prototype layout):
  - **Your rates** (top card): 3 toggleable line series -- Per hour (accent), Per trip (warning), Per km (success). Shared $0-22 y-axis. All 3 on by default, all with end labels.
  - **Totals** (bottom card): 4 toggleable series -- Earnings (accent, area+line), Hours (warning, line), Trips (success, line), Distance (faint, line). Only Earnings and Hours on by default. Each series normalized to its own max. Only Earnings gets end label.
- Toggleable legend chips with `aria-pressed` for each chart
- Drag-to-scrub: crosshair line + hover dots + floating tooltip with period label and series values
- End-of-line labels on the rightmost data point
- Server-side aggregation utility: groups shifts by ISO week or calendar month
- Empty state: "No shifts yet." card with link to `/shifts/new`
- Navigation: Trends tab in `BottomNav` between Shifts and Profile, matching prototype 5-item layout

## Out of scope

- Drill-down into a specific period
- Export/print charts
- Annotations or goal markers
- Platform-specific trend breakdowns
- Date range picker
- Comparison to previous period

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Port chart design tokens**
  Add chart-related CSS variables and utility classes from `prototypes/theme.css`
  to `app/globals.css`:
  - `--chart-earnings` (maps to `--accent`), `--chart-hours` (`--warning`),
    `--chart-trips` (`--success`), `--chart-km` (`--faint`)
  - `.pill-toggle`, `.pill-toggle a`, `.pill-toggle a.active` classes (period
    selector, matching prototype lines 114-143)
  - `.chip`, `.chip .dot`, `.chip[aria-pressed="false"]` classes (legend chips,
    prototype lines 189-220)
  - `.end-label` class (prototype lines 408-413)
  - `.crosshair` class (prototype lines 396-401)
  - `.chart-tip`, `.chart-tip.show`, `.chart-tip .tip-period`,
    `.chart-tip .tip-row`, `.chart-tip .tip-row .tip-val` (tooltip,
    prototype lines 416-461)
  - `.chart svg`, within that: `.grid line`, `.series-line`, `.series-area`,
    `.series-off`, `.dot-marker` (prototype lines 228-269)
  These are pure CSS additions; no functional change to existing styles.
  *Done when:* `npm run build` passes, all CSS classes defined in globals.css.

- [x] **Step 2 - Trend aggregation utility + tests**
  Create `lib/trends.ts` exporting:
  - `TrendPoint { period, periodLabel, totalEarnings, totalHours, totalTrips, totalDistanceKm, earningsPerHour, earningsPerTrip, earningsPerKm }`
  - `aggregateTrends(shifts, period: 'week' | 'month'): TrendPoint[]` -- groups
    shifts by ISO week (Mon-Sun) or calendar month. Sums totals, derives per-unit
    ratios. Omits periods with no shifts. Sorted oldest-first. Defaults to
    `'week'` for any unrecognized period value.
  - `formatTrendTotal(series: { unit?: string }, value: number): string` -- "$" +
    locale for earnings, value + suffix for others (matching prototype fmtTotal).
  - `formatTrendRate(value: number): string` -- "$" + 2 decimal places.
  Create `lib/trends.test.ts` covering: weekly grouping, monthly grouping, empty
  input, single shift, multi-period sort/labels, zero-hours → earningsPerHour=0,
  zero-trips → earningsPerTrip=0, ratio precision, format functions.
  *Done when:* `npm run build` and `npm test` pass, all tests green.

- [x] **Step 3 - TrendLineChart client component**
  Create `components/trends/TrendLineChart.tsx` (`'use client'`) -- a reusable
  chart engine that powers both "Your rates" and "Totals" charts.
  Props:
  ```ts
  interface ChartSeries {
    key: string;
    name: string;
    color: string;
    unit?: string;
    area?: boolean;
    on: boolean;
    end?: boolean;
    data: number[];
  }

  interface TrendLineChartProps {
    labels: string[];
    tipLabels: string[];
    series: ChartSeries[];
    formatTotal: (s: ChartSeries, i: number) => string;
    sharedMax?: number;  // if set, all series share this y-max (rates chart)
    height?: number;
  }
  ```
  Renders:
  - **Legend**: `<button class="chip">` chips with `aria-pressed`, `.dot` color
    dot, series name, and latest value. Click toggles `on` state, toggles
    `.series-off` class on matching SVG elements via state.
  - **SVG chart** with fixed `viewBox="0 0 400 200"`, CSS class `.chart svg`:
    - Grid lines (4 horizontal, `.grid line`)
    - X-axis labels (`<text class="axis-label">`, one per data point)
    - For each enabled series: line path (`<path class="series-line">`), area
      fill if `area: true` (`<path class="series-area">`), dot markers
      (`<circle class="dot-marker">`), end label if `end: true`
      (`<text class="end-label">`)
    - Elements get `data-key={series.key}` for legend toggle targeting
  - **Hover layer**: `<g class="hover-layer">` populated on pointermove/pointerdown
    with a vertical crosshair line (`<line class="crosshair">`) and hover dots
    (`<circle class="hover-dot">`) at each visible series' y-value for the
    nearest data point.
  - **Tooltip**: `<div class="chart-tip">` positioned relative to the chart
    container. Shows period label + one row per visible series (dot + name +
    formatted value). Shown on pointermove/pointerdown, hidden on pointerleave.
  Match the prototype's plot area (`l:34, r:356, t:16, b:170` on a 400x200
  viewBox) and tooltip positioning logic (left-edge, center, right-edge
  alignment at 28%/72% thresholds).
  *Done when:* component renders in isolation (can test via a temporary
  page or by importing it), build passes with no unused-variable warnings.

- [x] **Step 4 - Trends page**
  Create `app/trends/page.tsx` as an async server component:
  - Auth gate: `auth()`, redirect to `/sign-in` if no session
  - Query all shifts for the signed-in user (ordered by date asc)
  - Read `period` from `searchParams`, accept `"week"` or `"month"`, default to
    `"week"` for any unrecognized value
  - Call `aggregateTrends()` with the period
  - Compute `sharedMax` for rates: `Math.ceil(maxRate / 2) * 2 + 2`
    (ceiling to next even number + 2, so data never touches the chart top)
  - Build label arrays for both views:
    - Weekly: short date labels (e.g., "5/12", "5/19") and long tip labels
      (e.g., "May 12", "May 19")
    - Monthly: short month labels (e.g., "Feb", "Mar") and long tip labels
      (e.g., "February", "March")
  - Compute card subtitles from data point count:
    - Weekly: "Last N weeks" (e.g., "Last 8 weeks")
    - Monthly: "Last N months" (e.g., "Last 6 months")
  - Build series configs matching the prototypes exactly:
    - **Rates**: 3 series (Per hour/accent, Per trip/warning, Per km/success),
      all `on: true`, all `end: true`, `sharedMax` from computed ceiling
    - **Totals**: 4 series (Earnings/accent/area/on/end, Hours/warning/on,
      Trips/success/off, Distance/faint/off), no sharedMax (each normalized)
  - Render:
    - **Header**: "Trends" title + `.pill-toggle` with Week/Month `<Link>`s
      using `searchParams.period`
    - **Empty state**: if no shifts exist → `.empty` card per prototype:
      "No shifts yet." + link to `/shifts/new`
    - If shifts exist → two `<TrendLineChart>` instances inside `.card` wrappers,
      "Your rates" first, "Totals" second (matching prototype order).
      Include instructional hint text below each card title matching the
      prototype: "Tap a rate to hide it · drag across the chart for any week."
      (adjusting "week"/"month" based on selected period).
  *Done when:* `/trends` renders with real data, period toggle switches
  between week/month, empty state appears for no-shift users, `npm run build`
  passes.

- [x] **Step 5 - Bottom nav Trends tab**
  Add Trends tab to `components/layout/BottomNav.tsx`:
  - Insert between Shifts and Profile tabs (matching prototype: Home, Shifts,
    Trends, Profile, + FAB)
  - Icon: trending-up chart SVG (matching prototype: `<path d="M3 17l6-6 4 4 7-8"/><path d="M17 7h4v4"/>`)
  - Active when pathname starts with `/trends`
  - Label: "Trends"
  *Done when:* Trends tab appears in bottom nav on all authenticated pages,
  navigates to `/trends`, highlights correctly, `npm run build` passes.

## Files / areas

| File                                   | Action                                        |
| -------------------------------------- | --------------------------------------------- |
| `app/globals.css`                      | Modify (add chart tokens and utility classes) |
| `lib/trends.ts`                        | Create                                        |
| `lib/trends.test.ts`                   | Create                                        |
| `components/trends/TrendLineChart.tsx` | Create (`'use client'`)                       |
| `app/trends/page.tsx`                  | Create (server component)                     |
| `components/layout/BottomNav.tsx`      | Modify (add Trends tab)                       |

## Data / contracts

- **TrendPoint** (load-bearing):

```ts
interface TrendPoint {
  period: string;       // "2025-W27" or "2025-07"
  periodLabel: string;  // "5/12" or "Feb" (short label for x-axis)
  tipLabel: string;     // "May 12" or "February" (long label for tooltip)
  totalEarnings: number;
  totalHours: number;
  totalTrips: number;
  totalDistanceKm: number;
  earningsPerHour: number;
  earningsPerTrip: number;
  earningsPerKm: number;
}
```

- **Shift fields used**: `date`, `startTime`, `endTime`, `amountEarned`,
  `tripsCompleted`, `startOdometer`, `endOdometer`
- **aggregateTrends**: `(shifts: Shift[], period: 'week' | 'month') => TrendPoint[]`
- **No new database schema or API routes**

## Testing

Test runner configured (Vitest, `npm test`). Step 2 (aggregation utility) ships
with `lib/trends.test.ts` covering:

| Scenario          | Assertion                                            |
| ----------------- | ---------------------------------------------------- |
| Weekly grouping   | Shifts in same ISO week land in one TrendPoint       |
| Monthly grouping  | Shifts in same calendar month land in one TrendPoint |
| Empty input       | Returns `[]`                                         |
| Single shift      | One TrendPoint, ratios computed correctly            |
| Multi-period sort | Oldest first                                         |
| Zero hours        | earningsPerHour = 0                                  |
| Zero trips        | earningsPerTrip = 0                                  |
| Ratio precision   | Correct floating point                               |
| formatTrendTotal  | $ earnings, h hours, km distance, raw trips          |
| formatTrendRate   | $x.xx format                                         |

Steps 1, 3, 4, and 5 are UI/integration -- verified by build + screenshot.

## Notes for the AI

- **Chart rendering**: Custom SVG (React JSX elements inside `<svg>`), not
  Recharts. Match the prototype's plot area, grid lines, axis labels, line
  paths, area fills, dot markers, end labels, crosshair, and tooltip exactly.
- **No charting library**: Do not install Recharts, chart.js, or any charting
  package. The prototypes prove custom SVG is the design target.
- **Chart colors**: Use the semantic CSS variables from Step 1. Pass color values
  as inline styles (e.g., `style={{ color: 'var(--chart-earnings)' }}`) so CSS
  variable resolution works in both dark and light mode.
- **Server component pattern**: `app/trends/page.tsx` is a server component.
  `TrendLineChart` is `'use client'` (needs state for legend toggles + pointer
  events for crosshair/tooltip). Data flows server → client via props.
- **Period toggle**: `<Link>` with `searchParams.period`, no client state.
  Match the `.pill-toggle` CSS from Step 1 exactly.
- **Tooltip positioning**: Follow prototype logic -- position at percentage
  along chart width, offset left/center/right based on thresholds (28%/72%).
- **End labels**: Show at `PLOT.r + 5` x-position, vertically aligned to last
  data point's y. Only for series with `end: true`.
- **Totals chart**: no y-axis labels (each series normalized independently).
  x-axis labels use short period labels. Only horizontal grid lines.
