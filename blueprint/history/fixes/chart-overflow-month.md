# Fix: Charts overflow on month tab

**Type:** Fix

## The problem

End labels on the trends page charts (`TrendLineChart`) extend beyond the SVG
viewBox (400px wide). Monthly data produces longer value strings (e.g., "$2,610"
vs "$712") that push past the card boundary, causing horizontal overflow.

## The fix

Add `overflow: hidden` to the `.chart` CSS class so long end labels are clipped
rather than overflowing the container. The viewBox already provides 39px of
padding between the plot right edge (356) and viewBox edge (400), which is
enough for most labels. For the few that extend further, clipping is acceptable
(the alternative is the entire card overflowing).

## Build steps

- [x] **Step 1 - Clip chart overflow**
  Add `overflow: hidden` to the `.chart` CSS rule in `app/globals.css`.
  *Done when:* monthly charts no longer overflow their card containers. Build
  passes.

## Verify

- `npm run build` passes
- Navigate to `/trends`, switch to Month tab -- charts stay within cards
- Week tab still works correctly
