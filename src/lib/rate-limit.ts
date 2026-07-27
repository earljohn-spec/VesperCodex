import "server-only";
import { execute, query, queryOne, nowIso } from "./db";

/**
 * Fixed-window rate limiting, persisted in SQLite.
 *
 * An in-memory Map would be simpler but resets on every deploy and doesn't
 * hold across multiple server processes. Since we already have a database on
 * the request path, using it costs nothing extra and survives restarts.
 *
 * For a multi-region deployment you'd swap the storage for Redis; the
 * `consume()` signature is deliberately storage-agnostic so that's a local
 * change.
 */

export interface RateLimitRule {
  /** Requests allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export const RATE_LIMITS = {
  /** Login: slow brute-force without punishing a user who fat-fingers twice. */
  login: { limit: 8, windowSec: 15 * 60 },
  /** Signup: stop scripted account farming from one IP. */
  signup: { limit: 5, windowSec: 60 * 60 },
  /** Password reset requests: prevent using us as an email bomb. */
  passwordReset: { limit: 5, windowSec: 60 * 60 },
  /** Reset token submissions: stop guessing the token. */
  passwordResetConfirm: { limit: 10, windowSec: 60 * 60 },
  /** The companion is the most expensive endpoint we expose. */
  chat: { limit: 30, windowSec: 60 },
  /** General authenticated writes. */
  write: { limit: 120, windowSec: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitKind = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the window resets. */
  retryAfter: number;
  resetAt: string;
}

/**
 * Records a hit against `identifier` and reports whether it's allowed.
 * Call once per request, before doing the work.
 */
export function consume(
  kind: RateLimitKind,
  identifier: string,
  rule: RateLimitRule = RATE_LIMITS[kind],
): RateLimitResult {
  const key = `${kind}:${identifier}`;
  const now = Date.now();

  const row = queryOne<{ count: number; window_start: string }>(
    `SELECT count, window_start FROM rate_limits WHERE key = ?`,
    [key],
  );

  const windowMs = rule.windowSec * 1000;
  const startedAt = row ? new Date(row.window_start).getTime() : 0;
  const expired = !row || now - startedAt >= windowMs;

  if (expired) {
    const startIso = new Date(now).toISOString();
    execute(
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
      [key, startIso],
    );
    return {
      allowed: true,
      remaining: rule.limit - 1,
      limit: rule.limit,
      retryAfter: 0,
      resetAt: new Date(now + windowMs).toISOString(),
    };
  }

  const next = row.count + 1;
  const resetAtMs = startedAt + windowMs;

  if (next > rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      limit: rule.limit,
      retryAfter: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
      resetAt: new Date(resetAtMs).toISOString(),
    };
  }

  execute(`UPDATE rate_limits SET count = ? WHERE key = ?`, [next, key]);
  return {
    allowed: true,
    remaining: rule.limit - next,
    limit: rule.limit,
    retryAfter: 0,
    resetAt: new Date(resetAtMs).toISOString(),
  };
}

/** Clears a counter — used after a successful login so one bad day isn't punished. */
export function reset(kind: RateLimitKind, identifier: string) {
  execute(`DELETE FROM rate_limits WHERE key = ?`, [`${kind}:${identifier}`]);
}

/**
 * Best-effort client IP. Behind a proxy the left-most x-forwarded-for entry is
 * the client; trust it only because Vercel/Cloudflare overwrite the header.
 */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

/** Drop counters whose window has long passed, so the table can't grow forever. */
export function pruneRateLimits(olderThanHours = 24) {
  const cutoff = new Date(Date.now() - olderThanHours * 3600_000).toISOString();
  execute(`DELETE FROM rate_limits WHERE window_start < ?`, [cutoff]);
}

/** Introspection for tests/debugging. */
export function peek(kind: RateLimitKind, identifier: string) {
  return queryOne<{ count: number; window_start: string }>(
    `SELECT count, window_start FROM rate_limits WHERE key = ?`,
    [`${kind}:${identifier}`],
  );
}

export function activeLimits() {
  return query<{ key: string; count: number; window_start: string }>(
    `SELECT key, count, window_start FROM rate_limits ORDER BY window_start DESC LIMIT 50`,
  );
}

export { nowIso };
