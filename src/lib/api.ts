import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "./auth";
import { consume, type RateLimitKind } from "./rate-limit";
import type { User } from "./types";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Per-user rate limit for an authenticated route. Returns a 429 response when
 * the caller is over budget, or null to continue.
 */
export function enforceLimit(kind: RateLimitKind, userId: string): Response | null {
  const result = consume(kind, `user:${userId}`);
  if (result.allowed) return null;
  return NextResponse.json(
    {
      error: `You're going a bit fast. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": result.resetAt,
      },
    },
  );
}

/**
 * Wraps a route handler with auth + error handling so each handler stays
 * focused on its own logic.
 */
export function withUser<T extends unknown[]>(
  handler: (user: User, ...args: T) => Promise<Response> | Response,
) {
  return async (...args: T): Promise<Response> => {
    const user = await getCurrentUser();
    if (!user) return fail("Not authenticated", 401);
    try {
      return await handler(user, ...args);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return fail("Validation failed", 422, {
          fieldErrors: Object.fromEntries(
            err.issues.map((i) => [String(i.path[0] ?? "_"), i.message]),
          ),
        });
      }
      console.error("[api]", err);
      const message = err instanceof Error ? err.message : "Something went wrong";
      return fail(message, 500);
    }
  };
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new z.ZodError([
      { code: "custom", path: ["_"], message: "Request body must be valid JSON" },
    ]);
  }
  return schema.parse(raw);
}
