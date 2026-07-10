# Feature: Camera capture page

**From build-plan:** feature 12c-2
**Status:** not started

## Goal

A full-bleed camera page at `/capture?type=start|end` that lets the driver photograph the odometer. The page has four states: framing (live camera with guide frame), processing (spinner while the vision model reads the photo), review-confident (reading looks good, ready to confirm), and review-flagged (warnings, editable input). Confirming calls `startShiftSession` or `endShiftSession` from 12a and navigates back.

## Design reference

| Mockup | What it pins down |
| --- | --- |
| [prototypes/capture.html](../../prototypes/capture.html) | All four states: framing viewfinder with guide frame and scrim, processing spinner panel, review-confident panel (reading, confidence badge, confirm button), review-flagged panel (warnings, editable input). Start/end variants differ only in header text and confirm action. |

Theme tokens were ported in 12a. Prototypes preserved until feature 12 is fully complete.

## In scope

- New route `app/capture/page.tsx` -- `"use client"` component, reads `searchParams.type` for start vs end
- Camera viewfinder: `getUserMedia` video stream with `facingMode: "environment"`, guide frame overlay using `--guide-stroke` and `--overlay-scrim` tokens
- Shutter button captures current video frame to canvas → base64
- Gallery fallback: file input (`accept="image/*"`) for devices without camera or when permission is denied
- Processing state: full-width spinner panel with "Reading the odometer..." and "Checking the number against your last shift." subtext
- Calls `extractOdometerFromPhoto(imageBase64)` from 12b
- Review-confident panel: shows reading (mono font, large digits), unit, confidence badge (`conf.high`), meta text ("Continues from your last shift (048219 km). Shift starts at 9:41 AM."), retake + confirm buttons
- Review-flagged panel: shows reading with warnings (trip-meter warning, continuity warning), editable odometer input, retake + confirm buttons
- Confirm start: calls `startShiftSession(reading)` → navigates to `/dashboard`
- Confirm end: calls `endShiftSession(reading)` → navigates to `/dashboard` (placeholder; 12d chains the screenshot later)
- Error handling: camera permission denied, extraction failure, session action failure

## Out of scope

- The dashboard in-progress banner (12c-3)
- Chaining into the earnings screenshot (12d)
- The FAB entry sheet or BottomNav (already built in 12c-1)
- Persisting or caching the captured image (processed then discarded)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Page shell + camera viewfinder**
  Create `app/capture/page.tsx` as a `"use client"` component. Read `searchParams.type` from props (`"start"` | `"end"`, default `"start"`). States: `"framing"` (initial). Render:
  - Full-bleed dark background (`#0a0c0f`)
  - Live video stream via `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` in a `useEffect` (cleanup on unmount)
  - Guide frame overlay: scrim with a cutout rectangle, blue corner brackets using `--guide-stroke`, "Line up the odometer inside the frame" hint using `--overlay-ink`
  - Status bar area (top, white text): time placeholder, signal icons
  - Header: close button (back navigation), title ("Start odometer" / "End odometer")
  - Footer: gallery picker button (file input, `accept="image/*"`), shutter button (large circle), flash toggle placeholder
  - Gallery fallback: when camera permission is denied or on desktop, skip video stream and show only the file input (centered picker button with camera icon). Detect via `MediaDevices.getUserMedia` rejection or `!navigator.mediaDevices`.
  Match `capture.html` lines 407-436 (viewfinder + overlay + header + footer) for layout.
  *Done when:* `npm run build` passes. Page renders at `/capture?type=start` and `/capture?type=end` with different header titles. Camera stream shows on mobile with permission. Gallery fallback renders when camera is unavailable.

- [x] **Step 2 - Capture flow + processing state**
  Add the `"processing"` state and the capture pipeline:
  - Shutter tap or file selection → capture the image. For video: draw current frame to a hidden `<canvas>`, call `canvas.toBlob()`, convert to base64 via `FileReader`. For file input: `FileReader.readAsDataURL`, strip the `data:image/...;base64,` prefix.
  - Transition to `"processing"` state
  - Call `extractOdometerFromPhoto(imageBase64)` server action
  - On success: transition to `"review"` sub-state (`"confident"` or `"flagged"` based on `result.confidence`)
  - On error: show error message with retake button
  - Processing panel: centered spinner (CSS animation), "Reading the odometer..." heading, "Checking the number against your last shift." subtext, `var(--surface)` background rounded top, matches `capture.html` lines 439-447.
  *Done when:* `npm run build` passes. Taking a photo transitions to processing, then to review. Error state shows retake.

- [x] **Step 3 - Review panels + session actions**
  Add the two review sub-states:
  - **Review-confident** (`confidence === "high"`):
    - Small thumbnail of the captured image (top-left, rounded, border)
    - Confidence badge: green background (`--confidence-high-muted`), "✓ Read clearly" text (`--confidence-high`)
    - Large reading display: mono font, tabular-nums, `--foreground`, with unit
    - Meta text: "Continues from your last shift (048219 km). Shift starts at 9:41 AM." (use `result.lastEndOdometer` and current time). For end of shift: "288.0 km covered since 9:41 AM. Shift ends at 4:07 PM." (use session startOdometer + startedAt)
    - Two buttons: "Retake" (quiet, returns to framing) and "Start shift" / "Confirm and continue" (accent)
    - Confirm calls `startShiftSession(result.reading)` or `endShiftSession(result.reading)`, then `router.push("/dashboard")`
    Match `capture.html` lines 449-467.
  - **Review-flagged** (`confidence === "low"`):
    - Same thumbnail + reading display
    - Confidence badge: amber background (`--confidence-low-muted`), "! Check this reading" text (`--confidence-low`)
    - Warning box: amber tinted background, `--warning` border, warning text from `result.warnings`
    - Editable input field: shows the reading, driver can correct it, `inputmode="decimal"`, mono font
    - Two buttons: "Retake" (quiet) and "Use this reading" (accent)
    - Confirm uses the edited value (if changed) or the original reading
    Match `capture.html` lines 469-498.
  *Done when:* `npm run build` passes. Review panels render correctly for confident and flagged states. Confirm calls the correct session action and navigates to dashboard.

## Files / areas

| File | Action |
|------|--------|
| `app/capture/page.tsx` | **New.** The camera capture page with all four states |
| `actions/odometer-extract.ts` | Called (unchanged from 12b) |
| `actions/shift-session.ts` | Called (unchanged from 12a) |
| `actions/session.ts` | Called for end-of-shift meta (to get session startOdometer + startedAt) |

## Data / contracts

**Route:** `/capture?type=start|end` -- `type` defaults to `"start"`. The route is load-bearing: 12c-1's live FAB navigates to `/capture?type=end`.

**`extractOdometerFromPhoto` return (from 12b):**
```ts
{ success: true, data: { reading: number, unit: "km" | "mi" | null, confidence: "high" | "low", warnings: string[], lastEndOdometer: number | null } }
```

**Session actions (from 12a):**
- `startShiftSession(startOdometer)` -- returns `{ success: true, data: ShiftSession }`
- `endShiftSession(endOdometer)` -- returns `{ success: true, data: EndSessionData }`

**End-shift meta:** for the review-confident panel's end-of-shift variant, call `getOpenSession()` (from 12c-1) to get `startOdometer` and `startedAt` for the "X km covered since Y" display.

## Testing

`npm test` is configured. This feature is entirely UI/integration (camera, server action calls, navigation) -- no new pure logic. Rides on build + screenshot evidence. Use `/check` or manual browser verification against `capture.html`.

Existing tests (session, odometer-parser, shift-session, extract-parser) must still pass.

## Notes for the AI

- The page is entirely client-side (`"use client"`). Camera access, canvas capture, and file reading all require browser APIs.
- `searchParams` is accessed via the page component's props, not `useSearchParams()` (Next.js App Router passes search params to the page component).
- Camera stream cleanup: store the `MediaStream` in a ref, call `stream.getTracks().forEach(t => t.stop())` on unmount.
- Gallery fallback detection: wrap `getUserMedia` in try/catch. If it rejects (NotAllowedError, NotFoundError) or `!navigator.mediaDevices?.getUserMedia`, show the file picker fallback.
- Canvas capture: create an offscreen `<canvas>`, set dimensions to video resolution, `ctx.drawImage(video, 0, 0)`, `canvas.toBlob(blob => reader.readAsDataURL(blob))`. Strip the data URL prefix before passing to the server action.
- Base64 size: use `canvas.toBlob` with `"image/jpeg", 0.85` to keep payloads manageable.
- The thumbnail in the review panel is the captured frame itself (a small `<img>` with the base64 data URL).
- Meta text formatting: use `toLocaleString` or manual formatting for the last end odometer and timestamps. For the continuity line, format as "Continues from your last shift (LAST_ODO km)."
- Status bar: use a simple static display (current time via `new Date().toLocaleTimeString`), no real signal icons needed.
- The flash toggle is a placeholder (no-op). Most mobile browsers don't support torch control via getUserMedia reliably.
- On confirm error (session action fails): show the error message inline with a retry option, don't navigate away.
- Prototypes are preserved. Do not delete `prototypes/` at `/complete` for 12c-2.