# Feature: Landing page

**From build-plan:** feature 11
**Status:** not started

## Goal

Replace the Next.js starter page at `/` with a public marketing landing page
that sells the product. Built to match `prototypes/landing.html` exactly.

## Design reference

- `prototypes/landing.html` -- the full landing page (hero, content sections,
  pricing, CTA, footer). The visual source of truth.
- `prototypes/theme.css` -- marketing-only design tokens to port into
  `app/globals.css` (`--hero-wash`, `--accent-gradient`, `--platform-gradient`,
  `--display-xl`, `--display-lg`, `--radius-xl`).
- `prototypes/screens/*.png` -- real app screenshots for phone mockups. Copy to
  `public/screens/`.

## In scope

- Public landing page at `/` replacing the starter page in `app/page.tsx`
- Root layout tweak: make `<main>` bottom padding conditional (only when a
  session exists, since UserHeader and BottomNav already return null when signed
  out). The landing page needs no bottom spacer.
- Sticky nav bar: brand logo, "Sign in" link, theme toggle, "Start free" CTA
- Hero section: headline with gradient text, subtext, two CTAs, phone mockup
  with floating badges
- Content sections:
  - **Two ways to log**: duo cards with phone mockups
  - **Multi-platform**: split layout (phone left, copy right)
  - **Trends**: reversed split layout (copy left, phone right)
- Pricing section: single price card with ribbon
- Final CTA section + footer
- Shared `PhoneFrame` client component (used 5 times across the page)
- Theme toggle: dark-first with manual toggle (`data-theme` attribute), persists
  via localStorage
- "Start free" CTAs link to `/sign-up` when signed out, `/dashboard` when signed in

## Out of scope

- Animated scroll or parallax effects
- Privacy/Terms page content (links are placeholders)
- Cookie consent, waitlist, blog, contact form
- No route group needed (landing page uses the existing root layout; UserHeader
  and BottomNav already return null when signed out)

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Port marketing CSS tokens**
  Add marketing-only variables and utility classes from `prototypes/theme.css`
  into `app/globals.css`:
  - In `:root`: add `--hero-wash`, `--accent-gradient`, `--platform-gradient`
    (radial/linear gradients from theme.css). Add dark variants in the existing
    `@media (prefers-color-scheme: dark)` block.
  - In `@theme inline`: add `--radius-xl: 24px`
  - Add `[data-theme="dark"]` variants that mirror the dark mode block (the
    theme toggle uses `data-theme` attribute instead of `prefers-color-scheme`).
    Copy the dark `:root` values into a `:root[data-theme="dark"] { ... }` block.
  - Add utility classes (standalone CSS below the `@theme` block): `.eyebrow`,
    `.btn-primary`, `.btn-ghost`, `.device` + `.screen` + `.notch` +
    `.statusbar`, `.float-badge`, `.section-head` + `.center`, `.duo`, `.way`,
    `.split` + `.rev`, `.feature-list`, `.price-wrap`, `.price-card` +
    `.ribbon`, `.price-amount`, `.price-list`, `.final`, footer styles.
    Match the prototype's exact values for each class.
  *Done when:* `npm run build` passes, all prototype-matching classes defined.

- [x] **Step 2 - Layout tweak + copy screenshots**
  - Modify `app/layout.tsx`: wrap the bottom padding on `<main>` in a
    conditional. The session is already available. Change:
    `className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]"`
    to conditionally include `pb-*` only when `session?.user?.id` exists:
    `className={`flex-1 ${session?.user?.id ? 'pb-[calc(4rem+env(safe-area-inset-bottom,0px))]' : ''}`}`
  - Copy `prototypes/screens/*.png` to `public/screens/`.
  *Done when:* navigating to `/` shows no bottom padding; navigating to
  `/dashboard` when signed in still shows the correct bottom padding.
  `npm run build` passes.

- [x] **Step 3 - Nav bar + replace starter page**
  Replace `app/page.tsx` with the landing page, starting with the nav bar:
  - Brand: `◐ Shift Recorder` (no image, text character)
  - "Sign in" link → `/sign-in`
  - Theme toggle: create `components/landing/ThemeToggle.tsx` (`'use client'`):
    sets `data-theme` on `<html>`, toggles dark/light, reads initial value from
    localStorage (default "dark"). Renders ☀️/🌙 based on current theme.
  - "Start free" CTA → `/sign-up` (or `/dashboard` if authenticated, checked
    via `auth()` at the page level and passed to nav)
  - Sticky positioning, backdrop blur, border-bottom
  Call `auth()` at the page level; pass session to nav for conditional CTA link.
  *Done when:* nav bar renders at `/`, sticky on scroll, "Start free" links to
  `/sign-up` when signed out, `/dashboard` when signed in. Theme toggle switches
  dark/light. Build passes.

- [x] **Step 4 - Hero section + PhoneFrame**
  Add hero section below the nav:
  - Eyebrow: "◐ For Uber · Lyft · DoorDash drivers"
  - Headline: "Every shift. Every platform. / One number." with gradient text
    on the last part (use `style={{ backgroundImage: 'var(--platform-gradient)' }}`
    + `bg-clip-text text-transparent`)
  - Subtext paragraph
  - CTA row: "Start free →" (primary) + "See how it works" (ghost, links to
    `#two-ways` with smooth scroll)
  - Note: "Free for your first month. No card required."
  - Phone mockup + floating badges
  Create `components/landing/PhoneFrame.tsx` (`'use client'`): wraps an `<img>`
  in `.device > .screen` with notch and status bar. Props: `src`, `alt`,
  optional `className`.
  *Done when:* hero renders matching prototype, phone shows
  `screens/dashboard.png`, floating badges appear. Build passes.

- [x] **Step 5 - Content sections**
  Add three content sections below the hero:
  - **Two ways to log** (`id="two-ways"`): section head + `.duo` grid. Left card
    ("Headline feature / From a screenshot") with import phone mockup. Right
    card ("Or by hand / Type it in") with new-shift mockup.
  - **Multi-platform**: `.split` layout (phone left, copy right). Section head
    "One place / Three apps. One honest total." Feature list with 3 items.
    Phone shows `screens/shifts.png`.
  - **Trends**: `.split.rev` layout (copy left, phone right). Section head
    "Track your progress / Watch your real rate climb." Feature list with 3
    items. Phone shows `screens/trends.png`.
  All use CSS classes from Step 1. Sections delimited by `border-t`.
  *Done when:* all 3 sections render with correct phone mockups and layout,
  build passes.

- [x] **Step 6 - Pricing, final CTA, and footer**
  Add remaining sections:
  - **Pricing**: centered section head + `.price-card` with ribbon, "Pro"
    heading, `$3.99/mo` price, subtext, feature checklist, CTA.
  - **Final CTA**: `.final` section with heading, subtext, CTA.
  - **Footer**: brand + "Privacy" / "Terms" / "Sign in" links.
  CTAs link to `/sign-up` (or `/dashboard` if authenticated, same logic as nav).
  *Done when:* pricing, CTA, and footer render matching prototype. Build passes.

- [x] **Step 7 - Polish**
  - Add `scroll-behavior: smooth` to `html` in globals.css (so "See how it
    works" anchor scrolls smoothly)
  - Add `html { scroll-padding-top: 80px }` so section anchors account for the
    sticky nav height
  - Ensure theme toggle default matches dark-first: read localStorage, default
    to "dark" on first visit
  - Verify UserHeader/BottomNav don't render on `/` (already handled by their
    existing null-return logic)
  - Add `<title>` and `<meta description>` to the page (or use the existing
    metadata from root layout)
  *Done when:* smooth scroll works, theme toggle persists across reloads, build
  passes.

## Files / areas

| File | Action |
|------|--------|
| `app/globals.css` | Modify (marketing tokens + classes, data-theme block, smooth scroll) |
| `app/layout.tsx` | Modify (conditional bottom padding) |
| `app/page.tsx` | Modify (replace starter page with landing page) |
| `components/landing/PhoneFrame.tsx` | Create (`'use client'`) |
| `components/landing/ThemeToggle.tsx` | Create (`'use client'`) |
| `public/screens/*.png` | Copy from `prototypes/screens/` |

## Data / contracts

- No new database schema, API routes, or server actions.
- Session check via `auth()` at the page level (passed to nav for CTA link).
  The landing page is a server component; only PhoneFrame and ThemeToggle are
  `'use client'`.
- No route group changes. The existing root layout already works: UserHeader
  and BottomNav return null when signed out. The conditional bottom padding
  (Step 2) is the only layout change needed.

## Testing

No logic-bearing code. All verification is UI: build + manual check against the
prototype. Playwright tests can be added for: nav renders, theme toggle changes,
CTA destinations, sections render.

## Notes for the AI

- **No route group**: The existing root layout works for the landing page
  because UserHeader and BottomNav already return null when signed out. Only the
  `pb-[...]` on `<main>` needs to be conditional.
- **Theme toggle vs prefers-color-scheme**: The landing page toggle uses
  `data-theme` attribute (manual control). The existing app uses
  `prefers-color-scheme` media query. Both coexist via separate CSS blocks:
  `@media (prefers-color-scheme: dark)` for the existing app,
  `:root[data-theme="dark"]` for the toggle. The toggle's CSS block copies the
  same variable values. Default on first visit is dark (matching the app's
  dark-first default).
- **Gradient text**: Use `bg-clip-text text-transparent` Tailwind classes with
  an inline `style={{ backgroundImage: 'var(--platform-gradient)' }}`.
- **Phone mockups**: Use `<img>` (not `next/image`) for prototype screenshots
  since they're static and benefit from the `.device` container styling. The
  `PhoneFrame` component wraps the image in the prototype's exact device frame
  markup.
- **Standalone CSS classes**: The prototype uses standalone CSS classes
  (`.hero`, `.device`, etc.), not Tailwind utilities for these specific
  elements. Port them as-is into globals.css and use `className` with these
  class names directly. Use Tailwind utilities only for layout tweaks within
  these classes.
- **Font**: The root layout already loads Geist/Geist Mono via `next/font`.
  No additional font loading needed.
