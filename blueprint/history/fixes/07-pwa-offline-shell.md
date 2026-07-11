# Fix: Installable PWA with offline app shell + online/offline indicator

**Type:** Fix

## The problem

Odometry has no PWA scaffolding: no web manifest, no icon set (only a favicon.ico),
no service worker, and no signal to the user about connectivity. Drivers use this
between trips on a phone; they want to install it to the home screen like a native
app, have it open instantly even on a spotty connection, and know when they've lost
or regained signal (since shift actions - camera capture, screenshot import, saving
a shift - all require network and will otherwise fail silently or confusingly).

## The fix

Three additive pieces, none of which touch existing data flow or server actions:

1. **Manifest + icons + meta tags** - `app/manifest.ts` (Next.js typed manifest
   route) declaring name, short_name, theme/background colors (from the existing
   `--accent` / `--background` tokens in `app/globals.css`), display: `standalone`,
   and an icon set generated from the current favicon source. Add
   `themeColor`/`viewport` exports to `app/layout.tsx` metadata so mobile browsers
   pick up the install prompt and status-bar tinting.
2. **Service worker for the app shell only** - a hand-written `public/sw.js`
   (no library) registered from a small client component, caching just the static
   shell: the app icons, manifest, and Next's static build assets
   (`/_next/static/...`). Strategy: cache-first for static assets. For
   navigation/document requests, network-first with a cache fallback applies
   **only to the public, non-personalized routes** (`/`, `/sign-in`, `/sign-up`) -
   those are the only pages Next renders without embedding per-user data, so
   they're the only ones safe to snapshot. Every authenticated route
   (`/dashboard`, `/shifts`, `/trends`, `/profile`, `/billing`, `/import`,
   `/capture`, `/review-shift`) is server-rendered with real per-user data baked
   into the HTML, so those navigations are **never cached** - the service worker
   does not intercept them at all, and offline behavior there is unchanged from
   today (the browser's normal offline error). Explicitly **not** caching API
   routes, server action POSTs, or anything under `/api/`. No background sync, no
   write queue - data actions still require network and fail normally (existing
   error handling) when offline.
3. **Online/offline UI** - a small client component (e.g.
   `components/layout/ConnectionStatus.tsx`) using the `online`/`offline` window
   events and `navigator.onLine`, mounted once in `AppShell`. Shows a persistent
   small banner/pill while offline ("You're offline - some actions won't work"),
   and a brief toast ("Back online") when connectivity returns. Matches the
   existing dark-mode-first, minimal visual language (reuse `--warning`/`--success`
   tokens already in `globals.css`).

Must not break: existing navigation, server actions, camera capture flow, or the
build. Must not cache anything user-specific or auth-sensitive.

## Build steps

- [x] **Step 1 - Manifest, icons, meta tags.** Add `app/manifest.ts`, generate a
      PWA icon set (192x192, 512x512, maskable variant) from the existing icon
      source into `public/icons/`, wire `themeColor`/`viewport`/`manifest` into
      `app/layout.tsx` metadata. Done when: Chrome DevTools > Application >
      Manifest shows a valid manifest with no errors, and the install icon appears
      in the browser address bar / mobile "Add to Home Screen" is available.
- [x] **Step 2 - Service worker + registration.** Add `public/sw.js` implementing
      cache-first for static assets and network-first-with-fallback for
      navigations to `/`, `/sign-in`, `/sign-up` only, scoped to exclude `/api/*`,
      any POST, and every authenticated route. Add a small client component that
      registers it on mount, included once in `app/layout.tsx` (or `AppShell`).
      Done when: after a first visit, DevTools > Application > Service Workers
      shows it activated; reloading `/` or `/sign-in` with DevTools' "Offline"
      network throttling still renders that page instead of the browser's offline
      error page; reloading an authenticated page (e.g. `/dashboard`) offline
      shows the normal browser offline error, unchanged from before this fix
      (confirming no per-user data was cached).
- [x] **Step 3 - Online/offline indicator.** Add `ConnectionStatus.tsx`, mount in
      `AppShell`. Done when: toggling DevTools network to "Offline" shows the
      offline banner within ~1s, and switching back to "Online" shows a "back
      online" toast that auto-dismisses.

## Testing

`navigator.onLine`/event-listener wiring in `ConnectionStatus` is UI/browser
integration, not pure logic, so per `coding-standards.md` it rides on browser
verification (Playwright is already installed), not a unit test. No new
logic-bearing pure functions are introduced (manifest and service worker are
declarative/config), so no unit test is required for this fix.

## Verify

- `npm run build` succeeds.
- In a real or DevTools-emulated mobile browser: install prompt / "Add to Home
  Screen" is offered, launching from the home screen opens without browser chrome.
- With DevTools Network set to "Offline": a previously-visited public page (`/`
  or `/sign-in`) still renders; an authenticated page (e.g. `/dashboard`) shows
  the browser's normal offline error, unchanged from before this fix; the offline
  banner is visible throughout.
- Switching back online shows the "back online" toast; no console errors from the
  service worker in either state.
