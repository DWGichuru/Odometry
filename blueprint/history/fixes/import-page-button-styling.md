# current-feature

**Title:** Import page buttons don't match sign-in/sign-up button styling

**Type:** Fix

## The problem

`app/import/page.tsx` styles its buttons (`Import shift data`, `Try again`,
`Back`, `Save shift`) with a hardcoded `text-[14px]`, while the sign-in/sign-up
primary buttons (`components/auth/SignInForm.tsx`, `components/auth/SignUpForm.tsx`)
set no text size at all, so they render at the browser default (16px). This makes
the import page's buttons look visibly smaller/lighter than the rest of the app's
primary action buttons. There's also a stray `disabled:opacity-55` on the "Import
shift data" button versus `disabled:opacity-60` everywhere else.

The "Try again" button is additionally not full-width and uses `py-2` instead of
`py-3`, unlike every other primary button on the page and in auth.

## The fix

Bring all four buttons in `app/import/page.tsx` in line with the auth button
styling:

- Drop `text-[14px]` from all four buttons so they render at the same size as
  the sign-in/sign-up buttons.
- Change `disabled:opacity-55` to `disabled:opacity-60` on "Import shift data".
- Make "Try again" full-width with `py-3` and `mt-1`, matching the other primary
  buttons on the page instead of standing out as a small pill.
- Keep the `Back`/`Save shift` flex-ratio layout (`flex-1` / `flex-[2]`) as is —
  that's a deliberate two-button layout, not a styling bug.

Must not change: form logic, validation, save behavior, or any non-button
styling.

## Build steps

1. [x] Update button classes in `app/import/page.tsx` (4 buttons: "Import shift
   data", "Try again", "Back", "Save shift") to match sign-in/sign-up sizing and
   opacity conventions.
   Done when: none of the buttons on the import page set an explicit
   `text-[14px]`, `disabled:opacity-55` is gone, and "Try again" is a full-width
   `py-3` button.

## Verify

Visit `/import`, `/sign-in`, and `/sign-up` side by side (or in quick
succession) and confirm the primary buttons look the same size/weight. Trigger
the "Try again" state (fail a screenshot extract) and confirm it's now a
full-width button like the others.
