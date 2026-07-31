/**
 * Offline mode tests.
 *
 * The service worker is the difference between "the app works offline" and
 * "the app works offline as long as you never reload", so it deserves real
 * coverage rather than a manual click-through.
 *
 * Service workers can't be instantiated in Node — there's no ServiceWorker
 * global, no `caches`, no `clients`. Rather than mock the whole thing and test
 * the mock, this builds a minimal but faithful harness: a real `Cache`
 * implementation backed by a Map, real `Request`/`Response` objects (Node 22
 * has both), and a fake `fetch` whose failures are indistinguishable from a
 * dropped connection. The actual `public/sw.js` is then loaded and executed
 * against it, so these tests exercise the shipped file rather than a copy.
 *
 * What's checked:
 *   - install precaches the offline shell
 *   - activate evicts caches from older versions
 *   - static assets are served cache-first, and survive the network dying
 *   - GET /api/* is network-first, falls back to cache, tags stale responses
 *   - navigations fall back to the shell
 *   - writes, auth routes and RSC payloads are never cached
 *   - sign-out purges the data cache
 *
 * Run with: npm run test:offline
 */
import "./_shim";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

let pass = 0;
let fail = 0;
function t(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? " " + detail : ""}`);
}

/* ------------------------- a real-enough Cache API ------------------------ */

/**
 * Keyed by URL, which is what the spec does for same-method GET requests.
 * Good enough: the worker only ever caches GETs.
 */
/**
 * The real Cache API resolves a bare string against the worker's base URL, so
 * `cache.put(new Request("/offline"))` and `cache.match("/offline")` hit the
 * same entry. Normalising here keeps the harness honest — without it the tests
 * would fail on a difference browsers don't have.
 */
function cacheKey(req: Request | string): string {
  return typeof req === "string" ? new URL(req, ORIGIN).toString() : req.url;
}

class FakeCache {
  store = new Map<string, Response>();
  /** Injected so `add()` uses the harness's fake network, never the real one. */
  constructor(private fetcher: (req: Request) => Promise<Response>) {}

  async put(req: Request | string, res: Response) {
    this.store.set(cacheKey(req), res);
  }
  async match(req: Request | string) {
    const hit = this.store.get(cacheKey(req));
    return hit ? hit.clone() : undefined;
  }
  async add(req: Request | string) {
    const request = typeof req === "string" ? new Request(new URL(req, ORIGIN)) : req;
    const res = await this.fetcher(request);
    if (!res.ok) throw new Error(`add() failed: ${res.status}`);
    await this.put(request, res);
  }
  async delete(req: Request | string) {
    return this.store.delete(cacheKey(req));
  }
}

class FakeCacheStorage {
  caches = new Map<string, FakeCache>();
  constructor(private fetcher: (req: Request) => Promise<Response>) {}

  async open(name: string) {
    let c = this.caches.get(name);
    if (!c) {
      c = new FakeCache(this.fetcher);
      this.caches.set(name, c);
    }
    return c;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(name: string) {
    return this.caches.delete(name);
  }
  async match(req: Request | string) {
    for (const c of this.caches.values()) {
      const hit = await c.match(req);
      if (hit) return hit;
    }
    return undefined;
  }
}

/* ---------------------------- the worker harness -------------------------- */

const ORIGIN = "https://vesper.test";

interface Harness {
  sw: Record<string, unknown>;
  cacheStorage: FakeCacheStorage;
  dispatch: (type: string, event: Record<string, unknown>) => Promise<void>;
  /** Runs the fetch handler and returns what the worker responded with. */
  doFetch: (request: Request, opts?: { preload?: Response }) => Promise<Response | null>;
  setNetwork: (fn: (req: Request) => Promise<Response>) => void;
  postMessage: (data: string) => Promise<void>;
}

function loadWorker(): Harness {
  const source = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");

  const listeners = new Map<string, ((e: Record<string, unknown>) => void)[]>();

  let network: (req: Request) => Promise<Response> = async () => {
    throw new TypeError("Failed to fetch");
  };
  // Indirection so `setNetwork` swaps behaviour for the cache too.
  const cacheStorage = new FakeCacheStorage((req) => network(req));

  const waits: Promise<unknown>[] = [];

  const self: Record<string, unknown> = {
    addEventListener(type: string, fn: (e: Record<string, unknown>) => void) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(fn);
    },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    registration: { navigationPreload: { enable: async () => {} } },
    location: new URL(ORIGIN),
  };

  /**
   * Browsers resolve relative URLs against the worker's scope; Node's `Request`
   * demands an absolute one. Without this shim `new Request("/offline")` throws
   * inside sw.js, which would be a harness artefact rather than a real defect.
   */
  class ScopedRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      if (typeof input === "string" && input.startsWith("/")) {
        super(new URL(input, ORIGIN).toString(), init);
      } else {
        super(input as RequestInfo, init);
      }
    }
  }

  const sandbox: Record<string, unknown> = {
    self,
    caches: cacheStorage,
    fetch: (input: Request | string) =>
      network(typeof input === "string" ? new ScopedRequest(input) : input),
    Request: ScopedRequest,
    Response,
    Headers,
    URL,
    console,
    setTimeout,
    clearTimeout,
    Promise,
  };
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "sw.js" });

  async function dispatch(type: string, event: Record<string, unknown>) {
    const fns = listeners.get(type) ?? [];
    const pending: Promise<unknown>[] = [];
    const ev = {
      ...event,
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    };
    for (const fn of fns) fn(ev);
    await Promise.all(pending);
    await Promise.all(waits.splice(0));
  }

  async function doFetch(request: Request, opts?: { preload?: Response }) {
    const fns = listeners.get("fetch") ?? [];
    let responded: Promise<Response> | null = null;
    const ev = {
      request,
      preloadResponse: Promise.resolve(opts?.preload),
      respondWith: (p: Promise<Response> | Response) => {
        responded = Promise.resolve(p);
      },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    };
    for (const fn of fns) fn(ev);
    return responded ? await responded : null;
  }

  async function postMessage(data: string) {
    await dispatch("message", { data });
  }

  return {
    sw: self,
    cacheStorage,
    dispatch,
    doFetch,
    setNetwork: (fn) => {
      network = fn;
    },
    postMessage,
  };
}

const OFFLINE = async (): Promise<Response> => {
  throw new TypeError("Failed to fetch");
};

/**
 * A navigation request, as the browser hands it to a service worker.
 *
 * `new Request(url, { mode: "navigate" })` is forbidden by the Fetch spec —
 * only the browser may mint those — and Node enforces it. The worker only ever
 * reads `.mode`, so overriding the getter reproduces exactly what it sees.
 */
function navRequest(url: string): Request {
  const req = new Request(url);
  Object.defineProperty(req, "mode", { value: "navigate", configurable: true });
  return req;
}

async function main() {
  console.log("\nOffline mode\n");

  /* ------------------------------ install ------------------------------- */
  {
    const h = loadWorker();
    h.setNetwork(async (req) => {
      if (new URL(req.url).pathname === "/offline") {
        return new Response("<h1>You're offline</h1>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      return new Response("nope", { status: 404 });
    });

    await h.dispatch("install", {});

    const shell = await h.cacheStorage.open("vesper-shell-v1");
    const cached = await shell.match(`${ORIGIN}/offline`);
    t("install precaches the offline shell", !!cached);
    t("shell is real HTML", !!cached && (await cached.text()).includes("offline"));
  }

  /* ------------------------------ activate ------------------------------ */
  {
    const h = loadWorker();
    // Simulate an older deploy's leftovers plus an unrelated app's cache.
    await h.cacheStorage.open("vesper-static-v0");
    await h.cacheStorage.open("vesper-data-v0");
    await h.cacheStorage.open("someone-elses-cache");

    await h.dispatch("activate", {});
    const keys = await h.cacheStorage.keys();

    t("activate deletes stale vesper caches", !keys.includes("vesper-static-v0"));
    t("activate deletes stale data cache", !keys.includes("vesper-data-v0"));
    t("activate leaves other origins' caches alone", keys.includes("someone-elses-cache"));
  }

  /* --------------------------- static assets ---------------------------- */
  {
    const h = loadWorker();
    let hits = 0;
    h.setNetwork(async () => {
      hits++;
      return new Response("console.log(1)", {
        status: 200,
        headers: { "Content-Type": "application/javascript" },
      });
    });

    const url = `${ORIGIN}/_next/static/chunks/main-abc123.js`;
    const first = await h.doFetch(new Request(url));
    t("static asset is served", first?.status === 200);
    t("first load hits the network", hits === 1);

    const second = await h.doFetch(new Request(url));
    t("second load is served from cache", second?.status === 200 && hits === 1);

    // The whole point: it must still work with the network gone.
    h.setNetwork(OFFLINE);
    const offline = await h.doFetch(new Request(url));
    t("cached asset survives the network dying", offline?.status === 200);
    t("…and still has the right body", (await offline!.text()) === "console.log(1)");
  }

  /* ----------------------------- API caching ---------------------------- */
  {
    const h = loadWorker();
    const payload = JSON.stringify({ entries: [{ id: "j1", title: "Rough week" }] });
    h.setNetwork(async () =>
      new Response(payload, { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const url = `${ORIGIN}/api/journal`;
    const live = await h.doFetch(new Request(url));
    t("GET /api/journal passes through online", live?.status === 200);
    t("online response is not marked stale", live?.headers.get("X-Vesper-Cache") === null);

    h.setNetwork(OFFLINE);
    const cached = await h.doFetch(new Request(url));
    t("offline read falls back to cache", cached?.status === 200);
    t("stale response is tagged", cached?.headers.get("X-Vesper-Cache") === "hit");
    t("cached body is intact", (await cached!.text()) === payload);

    // A resource never seen while online can't be conjured up.
    const unseen = await h.doFetch(new Request(`${ORIGIN}/api/habits`));
    t("uncached endpoint returns 503", unseen?.status === 503);
    const body = (await unseen!.json()) as { offline?: boolean };
    t("503 body flags offline", body.offline === true);
  }

  /* ---------------------- freshness beats staleness --------------------- */
  {
    const h = loadWorker();
    h.setNetwork(async () => new Response(`{"v":1}`, { status: 200 }));
    await h.doFetch(new Request(`${ORIGIN}/api/habits`));

    h.setNetwork(async () => new Response(`{"v":2}`, { status: 200 }));
    const fresh = await h.doFetch(new Request(`${ORIGIN}/api/habits`));
    t("online always prefers live data over cache", (await fresh!.text()) === `{"v":2}`);

    h.setNetwork(OFFLINE);
    const stale = await h.doFetch(new Request(`${ORIGIN}/api/habits`));
    t("cache holds the most recent good response", (await stale!.text()) === `{"v":2}`);
  }

  /* ------------------------- writes are not cached ---------------------- */
  {
    const h = loadWorker();
    h.setNetwork(async () => new Response(`{"ok":true}`, { status: 200 }));

    const post = await h.doFetch(
      new Request(`${ORIGIN}/api/journal`, { method: "POST", body: `{"title":"x"}` }),
    );
    t("POST is left entirely to the app's outbox", post === null);

    const del = await h.doFetch(new Request(`${ORIGIN}/api/journal/j1`, { method: "DELETE" }));
    t("DELETE is not intercepted", del === null);
  }

  /* --------------------------- security boundary ------------------------ */
  {
    const h = loadWorker();
    h.setNetwork(async () => new Response(`{"user":"maya"}`, { status: 200 }));

    for (const p of [
      "/api/account/export",
      "/api/integrations/google-health/sync",
      "/login",
      "/signup",
    ]) {
      const res = await h.doFetch(new Request(`${ORIGIN}${p}`));
      t(`${p} is never cached`, res === null);
    }

    // RSC payloads are per-user rendered output.
    const rsc = await h.doFetch(
      new Request(`${ORIGIN}/api/journal`, { headers: { RSC: "1" } }),
    );
    t("RSC requests bypass the cache", rsc === null);

    const cross = await h.doFetch(new Request("https://health.googleapis.com/v4/x"));
    t("cross-origin requests are ignored", cross === null);
  }

  /* ----------------------------- navigation ----------------------------- */
  {
    const h = loadWorker();
    h.setNetwork(async (req) =>
      new URL(req.url).pathname === "/offline"
        ? new Response("<h1>You're offline</h1>", { status: 200 })
        : new Response("<h1>Dashboard</h1>", { status: 200 }),
    );
    await h.dispatch("install", {});

    const online = await h.doFetch(navRequest(`${ORIGIN}/dashboard`));
    t("navigation goes to the network when online", (await online!.text()).includes("Dashboard"));

    h.setNetwork(OFFLINE);
    const offline = await h.doFetch(navRequest(`${ORIGIN}/dashboard`));
    t("navigation falls back to the shell", offline?.status === 200);
    t("…and the shell is the offline page", (await offline!.text()).includes("offline"));

    // This is the bug that started all of this: a reload with no connection.
    const reload = await h.doFetch(navRequest(`${ORIGIN}/journal`));
    t("reloading any route offline still renders", reload?.status === 200);
  }

  /* ------------------------- sign-out purges data ----------------------- */
  {
    const h = loadWorker();
    h.setNetwork(async () => new Response(`{"secret":"maya's journal"}`, { status: 200 }));
    await h.doFetch(new Request(`${ORIGIN}/api/journal`));

    const before = await (await h.cacheStorage.open("vesper-data-v1")).match(`${ORIGIN}/api/journal`);
    t("personal data is cached while signed in", !!before);

    // Cache a static asset too, so we can prove the purge is targeted.
    h.setNetwork(async () => new Response("console.log(1)", { status: 200 }));
    await h.doFetch(new Request(`${ORIGIN}/_next/static/chunks/x-1.js`));

    await h.postMessage("vesper:clear-data");
    const keys = await h.cacheStorage.keys();
    t("sign-out purges the data cache", !keys.includes("vesper-data-v1"));

    // Static assets aren't personal — evicting them would just make the next
    // sign-in slow for no privacy gain.
    t("sign-out keeps the static cache", keys.includes("vesper-static-v1"));

    const gone = await h.cacheStorage.match(`${ORIGIN}/api/journal`);
    t("cached journal is unreachable after sign-out", gone === undefined);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
