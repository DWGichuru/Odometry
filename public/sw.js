const SHELL_CACHE = "odometry-shell-v1";

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
    event.respondWith(cacheFirst(request));
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
