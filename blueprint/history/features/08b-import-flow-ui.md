# Feature: Import flow UI

**From build-plan:** feature 8b
**Status:** not started

## Goal

Build the user-facing screenshot import flow: upload a screenshot, see the AI-extracted data for review on a form with editable odometer fields and computed distance, and save the shift with `entrySource: SCREENSHOT`. This completes the headline feature.

## Design reference

Built from `prototypes/import.html` and `prototypes/theme.css`. The prototype defines all 3 states (input, loading, review), the upload card design, form field layout, distance badge, segmented toggle, button variants, and error state. Match it.

- `prototypes/import.html` -- full 3-state wireframe of the import flow
- `prototypes/theme.css` -- reusable `.btn`, `.input`, `.label`, `.segmented`, `.card` classes (already mirrored in app Tailwind styles)

## In scope

- A `/import` page (client component) with 3 internal states: input, loading, review
- **Input state** (per prototype): page header with back arrow + "Import shift" title + subtitle ("Upload your end-of-shift summary..."), a card containing a file upload area (dashed border, upload SVG icon, "Tap to select a screenshot" text, transitions to filled state with accent border + accent-muted background + filename display + "Tap to choose a different screenshot" subtitle), and an "Import shift data" button (full-width accent, disabled until a file is selected)
- **Loading state** (per prototype): a card with centered CSS spinner (40px, border-based animation), "Extracting shift data..." heading, "Reading earnings, trips and times from your screenshot." subtitle. Error variant: a separate card below with a red alert ("Couldn't read that screenshot...") and a "Try again" button
- **Review state** (per prototype): a card with an extracted-note header (checkmark SVG + "Extracted from FILENAME. Check each field before saving."). Editable form fields: date (date input), platform (segmented toggle: Uber/Lyft/DoorDash, defaults to UBER if AI returned null), start/end time (grid col-2), amount earned ($ prefix) / trips completed (grid col-2), start/end odometer (grid col-2, both editable -- the user fills these in manually since the screenshots lack them). A distance badge below (accent-muted background, "Distance covered" label, computed value in km with 1 decimal). Button row: "Back" (ghost style, returns to input) + "Save shift" (accent, wider)
- Save: validate fields, build FormData, call `createShift` with `EntrySource.SCREENSHOT`, redirect to `/shifts`
- Modify `createShift` in `actions/shifts.ts` to accept optional third parameter `entrySource?: EntrySource` (defaults to `MANUAL`, backward-compatible)
- Protect `/import` route in middleware
- Add an "Import" outlined button on the shifts list page (`/shifts`) next to the "Log shift" button

## Out of scope

- Camera capture (file input's OS picker handles camera + gallery)
- Preview/crop of the uploaded image
- Image/file storage (screenshots are processed then discarded)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Import page + createShift modification** -- Create `app/import/page.tsx` as a client component with 3 states matching the prototype. **Input state**: back-arrow link to `/shifts`, "Import shift" heading, subtitle text, a `<label>` with the file upload card (hidden `<input type="file" accept="image/*">` triggered by clicking the card). Card uses dashed border, upload SVG icon, centered text. After file selection: card transitions to filled state (solid accent border, accent-muted background) showing the filename and "Tap to choose a different screenshot". "Import shift data" button is full-width accent, disabled until a file is selected. **Loading state**: card with CSS spinner (40px circle, border animation), "Extracting shift data..." text, subtitle. On API error: rendering stays in loading state but a second card appears below with red alert text + "Try again" button (returns to input, preserves filename selection). **Review state**: card header with checkmark SVG + "Extracted from FILENAME. Check each field before saving." in a surface-raised note. Then: date input, platform segmented toggle (defaults to UBER), start/end time grid, amount earned ($ prefix) / trips grid, start/end odometer grid (both editable, pre-filled from extraction data or empty), distance badge showing computed km. Button row: "Back" (ghost-style) + "Save shift" (accent, wider). On extract: build FormData with file + startOdometer (send empty string), call `extractShiftFromScreenshot`. On save: build FormData from all fields (odoMode: "odometer", distance: ""), call `createShift` with `EntrySource.SCREENSHOT`, redirect to `/shifts`. Also modify `actions/shifts.ts`: add optional `entrySource?: EntrySource` param to `createShift`, pass to `buildShift`. *Done when:* all 3 states render per the prototype, file upload + extract + review flow works end-to-end, error state with retry works, save creates a shift with entrySource: SCREENSHOT, and build + lint + tests pass.

- [x] **Step 2 - Route protection + navigation wiring** -- Add `/import` to middleware matcher. On `app/shifts/page.tsx`, add an "Import" button (outlined accent style per `prototypes/theme.css` `.btn-outline`) next to the "Log shift" button. *Done when:* `/import` is protected, the Import button appears on the shifts list page, and build + lint + tests pass.

## Files / areas

| File | Action |
|---|---|
| `app/import/page.tsx` | Create -- import page with 3 states (client component) |
| `actions/shifts.ts` | Modify -- add optional `entrySource` param to `createShift` |
| `app/shifts/page.tsx` | Modify -- add Import button next to Log shift |
| `middleware.ts` | Modify -- add `/import` to matcher |

## Data / contracts

### createShift signature change

```ts
export async function createShift(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
  entrySource?: EntrySource,
): Promise<{ error?: string; success?: boolean }>
```

Defaults to `MANUAL`; existing callers unchanged.

### Import page states

```
[ Input ]  -->  [ Loading ]  -->  [ Review ]  -->  [ Save → /shifts ]
                    | error           | back
                    v                 v
             [ Loading + alert ]   [ Input ]
                    |
                    v
               [ Input ]
```

### Review form fields (matching prototype layout)

| Row | Fields | Type |
|---|---|---|
| Header | Extracted from {filename} note | Read-only |
| 1 | Date | `<input type="date">` |
| 2 | Platform | Segmented toggle (Uber/Lyft/DoorDash) |
| 3 | Start time / End time | Grid col-2, `<input type="time">` |
| 4 | Amount earned / Trips completed | Grid col-2, amount has $ prefix |
| 5 | Start odometer / End odometer | Grid col-2, both editable |
| Badge | Distance covered | Computed: end - start |

## Testing

No new pure-logic functions. The import page is UI (client component), verified by build against the prototype. `createShift` change is backward-compatible (existing tests cover `buildShift` behavior). Test suite must stay green.

## Notes for the AI

- Import `EntrySource` from `@/types/shift` in both `actions/shifts.ts` and the import page.
- `useRef<HTMLInputElement>` for the hidden file input, triggered by the upload card's `onClick`.
- Three states: `type Step = "input" | "loading" | "review"`. Store the selected `File` object and its name in state.
- On extract: build FormData with `formData.set("file", file)` and `formData.set("startOdometer", "")`. Call `extractShiftFromScreenshot(formData)`.
- Loading spinner: 40px, `border: 3px solid var(--border)`, `border-top-color: var(--accent)`, `border-radius: 999px`, CSS `animate-spin`. Or use Tailwind's `animate-spin` with custom border styling.
- Error state: a boolean `extractError` that, when true, shows the alert card below the spinner. "Try again" resets to input state.
- Review form: `reviewData` state of type `ExtractedShiftFields`. Map null values to empty strings `""` for text inputs and `"0"` for number inputs. Platform defaults to `UBER` if null.
- Start/end odometer fields: convert number to string for input value. If null from extraction, show empty placeholder.
- Distance badge: compute `Number(endOdometer) - Number(startOdometer)`. If either is NaN or result is negative, show "— km". Otherwise show to 1 decimal with "km" suffix. Recompute on every keystroke (use onChange to update distance).
- On save: validate that at minimum `date`, `platform`, `amountEarned`, `startOdometer`, and `endOdometer` are non-empty. Build FormData following the `ShiftFormData` shape. Use `odoMode: "odometer"`, `distance: ""` (buildShift calculates it). Call `createShift(undefined, fd, EntrySource.SCREENSHOT)`.
- After save: `router.push("/shifts")`.
- "Back" button in review: resets `step` to `"input"`, preserves the selected file.
- Upload card: Tailwind classes matching prototype -- `border-dashed border-2` (when empty), `border-solid border-accent bg-accent-muted` (when filled). Upload icon SVG from prototype (arrow-up-from-tray, 26x26).
- Page header: back arrow `←` linking to `/shifts`, "Import shift" in 24px bold, subtitle in muted 13px.
- The Import button on `/shifts` page: use outline style (`border border-accent text-accent hover:bg-accent-muted`) per prototype's `.btn-outline`.
