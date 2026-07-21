# current-feature

**Title:** Export page download buttons are unstyled

**Type:** Fix

## The problem

`app/export/page.tsx` renders the "Download PDF summary" and "Download CSV"
actions (lines ~146-172) with `className="btn btn-accent"` and `className="btn
btn-quiet"`. None of `.btn`, `.btn-accent`, or `.btn-quiet` are defined anywhere
in `app/globals.css` or elsewhere in the repo, so these `<Link>`/`<span>`
elements render with no styling at all: no background, no padding beyond
whatever the icon/text gap gives them, no rounded corners.

## The fix

Replace the dead `btn`/`btn-accent`/`btn-quiet` classes with the app's existing
primary/secondary button convention (already used in
`components/auth/SignInForm.tsx`, `components/auth/SignUpForm.tsx`, and
`app/import/page.tsx`):

- **Download PDF summary** (primary) - `inline-flex w-full items-center
  justify-center gap-2 rounded-md bg-accent py-3 font-semibold text-accent-ink
  transition-opacity hover:opacity-90`.
- **Download CSV** (secondary/quiet) - `inline-flex w-full items-center
  justify-center gap-2 rounded-md bg-surface-raised py-3 font-semibold
  text-text-secondary transition-opacity hover:opacity-85`.
- Keep the disabled (`!populated`) `<span>` variants, but apply the same base
  classes so they look like disabled versions of the same buttons (the existing
  `opacity-45 cursor-not-allowed` modifiers stay).

Must not change: the download URLs/query string, the icon, or any non-button
markup on the page.

## Build steps

1. [x] Update the four button elements in `app/export/page.tsx` (populated PDF
   link, populated CSV link, disabled PDF span, disabled CSV span) to use real
   Tailwind utility classes instead of the undefined `btn`/`btn-accent`/`btn-quiet`
   classes, matching the primary/secondary convention above.
   Done when: no reference to `btn`, `btn-accent`, or `btn-quiet` remains in
   `app/export/page.tsx`, and both buttons visibly render with a background,
   padding, and rounded corners matching the rest of the app.

## Verify

Visit `/export` with a populated period (so the enabled buttons render) and
confirm "Download PDF summary" looks like the accent primary button used on
`/sign-in`/`/import`, and "Download CSV" looks like a quieter secondary button.
Then pick an empty period and confirm the disabled state still looks like a
faded version of the same buttons instead of plain text.
