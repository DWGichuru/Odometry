# Feature: Bottom navigation

**From build-plan:** feature 7
**Status:** not started

## Goal

Give drivers a persistent, mobile-first tab bar at the bottom of the screen for one-tap navigation between Dashboard, Shifts, New Shift (+), and Profile. This replaces the header nav links and matches the fast-between-trips mobile UX the app is designed for.

## Design reference

Built from prototypes in `prototypes/`. The mockups define the exact layout, icons, and visual treatments.

- `prototypes/theme.css` -- design tokens (already in sync with `app/globals.css`; no port needed)
- `prototypes/dashboard.html` -- bottom nav with Dashboard active, plus the full userbar treatment
- `prototypes/shifts.html` -- bottom nav with Shifts active
- `prototypes/profile.html` -- bottom nav with Profile active, plus the full profile page layout

## In scope

- A fixed bottom navigation bar with 4 tabs: **Dashboard**, **Shifts**, **Profile**, and a **New Shift FAB** (floating action button at the trailing edge)
- The New Shift tab is a raised circle FAB that floats above the nav bar (accent background, plus icon, with a colored drop shadow), not an inline tab
- Glass-effect nav background (`backdrop-filter: blur(12px)` over a semi-transparent surface)
- Active-tab highlighting using the `--accent` token; inactive tabs use `--muted`
- Tab icons from the prototypes as inline SVGs (no icon library installed)
- A `/profile` page matching the prototype: avatar initials, name/email header, info-card rows (Name, Email, Currency with tag chip, Member since), and a full-width sign out button with log-out icon
- Bottom nav visible only for authenticated users, hidden on sign-in/sign-up pages (no flash during session loading)
- Bottom padding on the layout content so it doesn't sit under the nav
- iOS safe-area inset support (`env(safe-area-inset-bottom)`)
- Simplify `UserHeader` to the prototype's userbar: user name + email on the right, sign out button on the left, no nav links

## Out of scope

- Profile editing (name, email, currency) -- this is account management, not navigation
- Billing/subscription info on the profile page -- that's feature 9
- Animations or transitions on tab switch
- Any icon library installation
- Desktop-only behavior (the bottom nav is always shown for authenticated users)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Bottom nav component + layout integration** -- Create `components/layout/BottomNav.tsx` as a client component. It uses `useSession()` from `next-auth/react` to gate visibility (return `null` when `status === "loading"` or `status === "unauthenticated"`, render the nav when `status === "authenticated"`). Uses `usePathname()` to determine the active tab. Renders a fixed bar at the bottom of the viewport matching the prototype design: 3 normal tabs (Dashboard, Shifts, Profile -- each `flex: 1`) plus a trailing New Shift FAB (`flex: 0 0 auto`). The FAB is a `<Link>` wrapping a 52px circle with accent background, white plus icon, and a colored drop shadow (`0 6px 16px color-mix(in srgb, var(--accent) 45%, transparent)`), positioned to float above the nav bar with negative margin. The nav background uses `color-mix(in srgb, var(--surface) 88%, transparent)` with `backdrop-filter: blur(12px)` and a top border. Tab icons are exact SVGs from the prototypes (house, list, person, plus-in-circle). Integrate into `app/layout.tsx`: wrap `children` in a `<main className="flex-1">` with bottom padding to clear the nav plus safe area, render `<BottomNav />` after `{children}`. *Done when:* the bottom nav appears on authenticated pages matching the prototype's layout, tab order, FAB style, and glass effect; active-state highlighting is correct; tabs navigate to their routes; sign-in/sign-up pages show no nav (no flash); and build + lint + tests pass.

- [x] **Step 2 - Profile page + UserHeader simplification** -- Create `app/profile/page.tsx` as a server component matching the prototype. Read session via `auth()`, redirect unauthenticated users. Fetch `prisma.user.findUnique()` for `name`, `email`, `currency`, and `createdAt`. Render: an avatar circle with the user's initials (first letters of first and last name, sized per prototype: 72px, accent-muted background, accent text, 28px font), name and email centered below, an info-card (`card` class, rounded, border) with rows for Name, Email, Currency (showing the ISO code in a raised tag chip plus the currency name like "US Dollar"), and Member since (formatted as "Mon YYYY" from createdAt). Below the card, a full-width sign out button (danger-colored text, log-out SVG icon, border, matching prototype). Protect `/profile` by adding it to the middleware matcher. Simplify `UserHeader` to match the prototype userbar: remove Dashboard/Shifts links, keep user name + email (right-aligned) and sign out button (left side). *Done when:* the Profile tab navigates to `/profile`, the page matches the prototype layout (avatar, info card, sign out), the middleware protects `/profile`, the header matches the prototype userbar, and build + lint + tests pass.

## Files / areas

| File | Action |
|---|---|
| `components/layout/BottomNav.tsx` | Create -- fixed bottom tab bar with FAB (client component) |
| `app/layout.tsx` | Modify -- import and render BottomNav, add bottom padding to content |
| `app/profile/page.tsx` | Create -- profile page matching prototype (server component) |
| `middleware.ts` | Modify -- add `/profile` to protected matcher |
| `components/auth/UserHeader.tsx` | Modify -- simplify to userbar (name, email, sign out; no nav links) |

## Data / contracts

No new types or schema changes. The profile page reads from the session (`auth()`) and fetches `prisma.user.findUnique({ where: { id }, select: { name, email, currency, createdAt } })`.

Tab routes:

| Tab | SVG icon | Route | Active match |
|---|---|---|---|
| Dashboard | House (home) | `/dashboard` | Starts with `/dashboard` |
| Shifts | Three lines + bullets | `/shifts` | Starts with `/shifts`, not `/shifts/new` |
| Profile | Person silhouette | `/profile` | Starts with `/profile` |
| New Shift | + in circle (FAB) | `/shifts/new` | Exact match `/shifts/new` |

## Testing

No new pure-logic functions are introduced. The bottom nav and profile page are UI components (client and server respectively), verified by build + screenshot evidence against the prototypes. The existing test suite (`npm test`) must stay green.

## Notes for the AI

- `usePathname()` and `useSession()` are client-only hooks; `BottomNav.tsx` must be `"use client"`.
- Use `useSession()` from `next-auth/react` to gate visibility -- return `null` when `status === "loading"` or `status === "unauthenticated"`. Once `status === "authenticated"`, render the tab bar.
- The layout is a server component that renders `BottomNav` (client) as a child -- fine in App Router.
- Use `signOut` from `@/auth` for the profile page sign out button, following the existing server-action-in-a-form pattern from `UserHeader`.
- SVG icons: copy the exact `viewBox="0 0 24 24"` paths from the prototypes. All use `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"` (FAB uses `stroke-width="2.5"`), inheriting color via `currentColor`.
- Bottom nav height: `h-16` (64px) plus `pb-[env(safe-area-inset-bottom)]` for iOS.
- FAB: 52x52px circle, `mt-[-22px]`, accent background, white icon, box-shadow with accent tint.
- Nav background: `bg-[color-mix(in_srgb,var(--surface)_88%,transparent)]` with `backdrop-blur-xl` and `border-t border-border`.
- Tab labels are 10px, font-weight 600, letter-spacing 0.01em.
- Active tabs use `text-accent`; inactive use `text-muted`.
- The Shifts tab should NOT be active on `/shifts/new` (the FAB is active there instead). Use exact path check: active when path starts with `/shifts` AND path does not equal `/shifts/new`.
- The `middleware.ts` matcher: update to `["/dashboard", "/shifts/:path*", "/profile"]`.
- Profile page avatar initials: split name by space, take first char of first and last word, uppercase.
- Currency display: use a lookup map for full currency names (e.g. `{ USD: "US Dollar", EUR: "Euro" }`), fall back to the ISO code.
