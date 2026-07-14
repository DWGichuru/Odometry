import { NextResponse } from "next/server";

// Served from a route instead of public/sw.js so the cache name can carry a
// real per-deploy version: a hardcoded version string is easy to forget to
// bump, which leaves the cache-first branch below serving whatever JS chunk
// it first saved, forever - across every future deploy, not just this one.
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
const IS_DEV = process.env.NODE_ENV !== "production";

const SOURCE = `
const SHELL_CACHE = "odometry-shell-${VERSION}";
const IS_DEV = ${IS_DEV};

const STATIC_PATH_PREFIXES = ["/_next/static/", "/icons/"];
const STATIC_EXACT_PATHS = ["/manifest.webmanifest", "/favicon.ico"];

// Only these routes render without embedding per-user data, so only these
// are safe to snapshot for offline use. Every authenticated route is
// server-rendered with real shift/earnings data baked into the HTML and
// must never be cached.
const CACHEABLE_NAVIGATION_PATHS = ["/", "/sign-in", "/sign-up"];

function isStaticAsset(pathname) {
  if (STATIC_EXACT_PATHS.includes(pathname)) return true;
  return STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (isStaticAsset(url.pathname)) {
    // Dev static asset URLs aren't content-hashed the same stable way a
    // production build's are, so cache-first here would keep serving JS
    // from a previous rebuild across dev-server restarts.
    event.respondWith(IS_DEV ? networkFirst(request) : cacheFirst(request));
    return;
  }

  if (request.mode === "navigate" && CACHEABLE_NAVIGATION_PATHS.includes(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline and no cached response for " + request.url);
  }
}
`;

export async function GET() {
  return new NextResponse(SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
