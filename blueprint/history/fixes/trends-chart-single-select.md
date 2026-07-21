# current-feature

**Title:** Trends charts: single-select series toggle with full redraw, populated y-axis, and descriptive weekly x-axis labels

**Type:** Fix

## The problem

`components/trends/TrendLineChart.tsx` renders both trend charts (rates and
totals) on `/trends`. Two issues:

1. **Multi-select toggles distort the y-axis.** The legend chips
   (`TrendLineChart.tsx:220-236`) toggle series on/off independently
   (`toggleSeries`, lines 59-64), and multiple series can be visible at once.
   For the rates chart, `sharedMax` is computed once in
   `app/trends/page.tsx:106-112` from **all three** series' raw data,
   regardless of which are toggled on/off - so hiding series never rescales
   the y-axis to what's actually visible. For the totals chart, each series
   already computes its own independent max (`TrendLineChart.tsx:110`,
   `Math.max(...s.data, 0.01)`), so several series can be on simultaneously
   with mismatched scales sharing one set of unlabeled gridlines. Toggling is
   also just a CSS opacity fade (`.series-off` in `globals.css:267-270`), not
   a real redraw.

2. **The y-axis has no value labels at all.** The 5 gridlines
   (`TrendLineChart.tsx:89-92`) are purely decorative - there's no way to read
   an approximate value off either chart without hovering every point. The
   left plot margin (`PLOT_L = 34`) is blank space apparently reserved for
   this and never used.

3. **Weekly x-axis labels are terse.** `formatWeekLabel` in `lib/trends.ts:50-52`
   renders periods like `2/18`. A more descriptive format (`formatWeekTip`,
   `lib/trends.ts:54-56`) already exists and is used for the hover tooltip
   only (`Feb 18`) - the axis should use the same descriptive style.

## The fix

**Single-select (radio) series toggle, full redraw:**

- In `TrendLineChart.tsx`, replace the multi-toggle `on` boolean per series
  with a single `selectedKey` state - exactly one series selected per chart
  at all times.
- Legend chips become a radio group: wrap in `role="radiogroup"`, each chip
  `role="radio"` `aria-checked={s.key === selectedKey}`, clicking a chip sets
  `selectedKey` (no toggling off the only selected one).
- Render only the selected series' line/area/dots/end-label - drop the
  `series-off` opacity-fade approach now that at most one series is ever
  shown. Hover crosshair/dots and the tooltip likewise reference only the
  selected series.
- Key the chart's SVG (or its containing element) on `selectedKey` so React
  remounts it on selection change, producing a full redraw instead of an
  animated cross-fade.
- Y-axis scale (`maxVal`) is computed purely from the selected series' own
  `data` - remove the cross-series `sharedMax` prop/plumbing from
  `TrendLineChart.tsx` and its computation in `app/trends/page.tsx:106-112`,
  since with one series visible at a time there's nothing left to share the
  scale with.
- Each chart needs exactly one default-selected series: keep "Per hour"
  (`hour`) and "Earnings" (`earn`) as the defaults, matching today's primary
  `on: true` series for each chart. The now-unused `on` field on `ChartSeries`
  is removed (or repurposed as `defaultSelected`) along with the dead
  `.series-off` CSS rule once nothing references it.

**Populated y-axis:**

- Both charts currently draw 5 unlabeled horizontal gridlines
  (`TrendLineChart.tsx:89-92`) with no value text - the left margin
  (`PLOT_L = 34`, `TrendLineChart.tsx:6`) is blank space already reserved for
  this but unused.
- Once each chart shows exactly one series (single-select, above), label each
  gridline with the value it represents for the selected series: `maxVal` at
  the top line down to `0` at the bottom, evenly stepped across the 5 lines
  (mirroring the `yAt`/gridline math already in `TrendLineChart.tsx:18-21,89-92`).
  Format with the series' `unit` (reuse `formatTrendTotal`, or a more compact
  rounded variant if the existing 2-decimal currency format is too wide for
  repeated axis ticks - implementer's call).
- Right-align the labels in the reserved left margin, sized to not collide
  with the plot area or the existing end-of-line value label on the right.
- Because the axis is now per-series, changing the selected series changes
  both the line and its axis labels together as part of the same redraw.

**Descriptive weekly x-axis labels:**

- Change `formatWeekLabel` (`lib/trends.ts:50-52`) to render the same style
  as `formatWeekTip` (`Feb 18` instead of `2/18`). Leave month-mode labels
  (`formatMonthLabel`/`formatMonthShort`) untouched.
- Longer labels take more horizontal space than `2/18` did. If a user with
  many weeks of data causes visible overlap in the axis text
  (`TrendLineChart.tsx:94-107`), thin the rendered labels (e.g. show every
  Nth tick) rather than shrinking font size below legibility. Only add this
  if overlap actually shows up when checking with a few weeks of data.

**Must not break:** the drag-to-scrub hover/tooltip behavior, the pill
week/month period switch, or the end-of-line value labels for the currently
selected series.

## Build steps

1. [x] **Weekly x-axis labels.** Update `formatWeekLabel` in `lib/trends.ts` to
   match `formatWeekTip`'s format. Check the rendered `/trends` page in week
   mode for label overlap across a few data volumes; add tick-thinning only
   if overlap actually appears.
   - Done when: the weekly rates/totals charts show labels like `Feb 18`
     instead of `2/18`, with no overlapping axis text.

2. [x] **Single-select radio toggle with full redraw and per-series y-axis.** In
   `TrendLineChart.tsx`, replace multi-toggle `on` state with single
   `selectedKey` state, radio-group legend semantics, rendering only the
   selected series, and a `key`-forced remount on selection change. Remove
   `sharedMax` from `TrendLineChart.tsx` and `app/trends/page.tsx`, and drop
   the now-dead `.series-off` CSS rule if nothing else uses it.
   - Done when: on `/trends`, clicking a chip in either chart selects only
     that series (radio-style - previous selection deselects), the chart
     redraws fully, the y-axis visibly rescales to the new series' own value
     range, and exactly one line is ever shown per chart.

3. [x] **Populated y-axis.** Add value labels to the 5 gridlines in
   `TrendLineChart.tsx`, computed from the selected series' `maxVal` down to
   `0` and formatted with the series' unit, right-aligned in the reserved
   left margin. Depends on step 2 (per-series scale).
   - Done when: both charts show numeric labels beside each gridline for the
     currently selected series, and the labels update correctly when a
     different series is selected.

## Verify

- On `/trends` (week and month period), click through each chip in the
  **rates** chart and the **totals** chart: confirm only one series is ever
  highlighted/visible at a time, and that switching between a
  small-magnitude series (e.g. "Per km") and a large-magnitude one (e.g.
  "Per hour") visibly rescales the y-axis instead of flattening the small
  series against a shared scale.
- Confirm hover/drag tooltip still works and reflects only the selected
  series.
- Confirm each chart's y-axis shows readable numeric gridline labels for
  whichever series is currently selected, and that they change when the
  selection changes.
- Switch to week mode and confirm x-axis dates read like `Feb 18`; switch to
  month mode and confirm month labels are unchanged.
- Run the build (`npm run build`) clean.
