/**
 * Vesper service worker.
 *
 * The point of this file is narrow: make the app *open* with no connection.
 * Before it existed, `offline.tsx` queued writes to localStorage — which only
 * helps if the tab is already open. Reload on a plane and you got the browser's
 * dinosaur. Every route is `force-dynamic`, so there was nothing on disk to
 * serve.
 *
 * Three caches, three different jobs:
 *
 *   static  — the build's own JS/CSS. Immutable, hashed filenames, so
 *             cache-first forever. This is what makes a reload instant.
 *   shell   — the offline fallback page. Precached at install.
 *   data    — GET responses from /api/*. Network-first: online you always get
 *             fresh data, offline you get the last thing we saw.
 *
 * Deliberately NOT cached:
 *   - Any non-GET request. Writes belong to the outbox in `offline.tsx`, which
 *     already handles ordering and replay. Two queues would fight.
 *   - Auth routes and server actions. Serving a stale session is a security
 *     bug, not a feature.
 *   - HTML documents, beyond the fallback. These are per-user rendered pages;
 *     caching them risks showing one account's data to whoever logs in next on
 *     a shared machine. We serve the shell instead and let the client refetch.
 */

const VERSION = "v1";
const STATIC_CACHE = `vesper-static-${VERSION}`;
const DATA_CACHE = `vesper-data-${VERSION}`;
const SHELL_CACHE = `vesper-shell-${VERSION}`;
const OFFLINE_URL = "/offline";

const OWNED = [STATIC_CACHE, DATA_CACHE, SHELL_CACHE];

/* --------------------------------- install -------------------------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // `reload` bypasses the HTTP cache so we never precache a stale shell.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      await self.skipWaiting();
    })(),
  );
});

/* -------------------------------- activate -------------------------------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous versions so a deploy can't resurrect old JS.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("vesper-") && !OWNED.includes(k)).map((k) => caches.delete(k)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

/* -------------------------------- helpers --------------------------------- */

/** Requests that must never be served from cache. */
function isSensitive(url) {
  return (
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/api/account") ||
    url.pathname.startsWith("/api/integrations") ||
    url.pathname === "/login" ||
    url.pathname === "/signup" ||
    url.pathname === "/logout" ||
    url.pathname.startsWith("/reset-password") ||
    url.pathname.startsWith("/forgot-password") ||
    url.pathname.startsWith("/verify-email")
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

/** Cache-first. Static assets are content-hashed, so a hit is always correct. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // Same-origin is already guaranteed by the fetch handler, so the only things
  // worth excluding here are opaque responses (status 0 — you can't tell a
  // success from a failure) and 206 partials, which are fragments of a file.
  if (response.ok && response.type !== "opaque" && response.status !== 206) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Network-first with a cache fallback, for GET /api/*.
 *
 * Online behaviour is unchanged — you always get live data. The cached copy
 * only surfaces when the network genuinely fails, and it's tagged with
 * `X-Vesper-Cache: hit` so the UI can tell the user what they're looking at
 * rather than silently presenting stale numbers as current.
 */
async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("X-Vesper-Cache", "hit");
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    // Shape matches the app's error envelope so callers can parse it normally.
    return new Response(JSON.stringify({ error: "offline", offline: true }), {
      status: 503,
      headers: { "Content-Type": "application/json", "X-Vesper-Cache": "miss" },
    });
  }
}

/**
 * Navigations: try the network, fall back to the offline shell.
 *
 * We don't cache the real HTML — it's user-specific and dynamically rendered.
 * The shell is a static page that boots the client, which then pulls from the
 * data cache. That keeps per-user content out of a shared disk cache.
 */
async function handleNavigation(event) {
  try {
    const preload = await event.preloadResponse;
    if (preload) return preload;
    return await fetch(event.request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const shell = await cache.match(OFFLINE_URL);
    return (
      shell ??
      new Response("<h1>Offline</h1>", { status: 503, headers: { "Content-Type": "text/html" } })
    );
  }
}

/* --------------------------------- fetch ---------------------------------- */

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never touch cross-origin, non-GET, or auth-bearing traffic.
  if (url.origin !== self.location.origin) return;
  if (request.method !== "GET") return;
  if (isSensitive(url)) return;

  // Server actions are POSTs, but Next also sends RSC GETs with this header;
  // those are per-user payloads and must not be cached.
  if (request.headers.get("RSC") === "1" || request.headers.get("Next-Router-Prefetch")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
  }
});

/* -------------------------------- messages -------------------------------- */

self.addEventListener("message", (event) => {
  if (event.data === "vesper:skip-waiting") self.skipWaiting();

  // Signing out must purge cached personal data from disk. Without this, the
  // next person to use the machine could read the previous user's entries.
  if (event.data === "vesper:clear-data") {
    event.waitUntil(caches.delete(DATA_CACHE));
  }
});
