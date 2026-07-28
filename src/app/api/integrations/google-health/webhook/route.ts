import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { verifyWebhookSignature, signatureCheckDisabled } from "@/lib/webhook-verify";
import { ingestForUser } from "@/lib/google-health-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receives Google Health API change notifications.
 *
 * This is what makes "detect a stress spike and suggest an immediate
 * micro-break" actually immediate — without it the user has to remember to
 * press a Sync button, which defeats the point of the feature.
 *
 * Google requires two behaviours precisely:
 *
 * 1. **A verification handshake** when a subscriber is created or its endpoint
 *    changes. Google POSTs `{"type":"verification"}` twice: once *with* the
 *    configured Authorization header (must answer 200/201) and once *without*
 *    (must answer 401/403). Getting the second case wrong means the handshake
 *    silently passes for an endpoint that isn't actually enforcing auth.
 *
 * 2. **Respond 204 immediately** and process afterwards. Anything else, or a
 *    timeout, and Google retries — so slow work here turns into duplicate
 *    notifications.
 */

function authorized(req: Request) {
  const expected = process.env.GOOGLE_HEALTH_WEBHOOK_TOKEN;
  // With no token configured every request looks unauthorised, which fails the
  // handshake's first step loudly rather than accepting anonymous webhooks.
  if (!expected) return false;
  return req.headers.get("authorization") === expected;
}

export async function POST(req: Request) {
  // Read the body as text: re-serialising parsed JSON would reorder keys and
  // invalidate the signature.
  const rawBody = await req.text();

  let payload: {
    type?: string;
    data?: {
      healthUserId?: string;
      dataType?: string;
      operation?: string;
    };
  };
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  /* ----------------------- verification handshake ---------------------- */
  if (payload.type === "verification") {
    return authorized(req)
      ? new NextResponse(null, { status: 200 })
      : new NextResponse(null, { status: 401 });
  }

  /* --------------------------- real notification ------------------------ */
  if (!authorized(req)) return new NextResponse(null, { status: 401 });

  if (!signatureCheckDisabled()) {
    const result = await verifyWebhookSignature(
      rawBody,
      req.headers.get("GOOGLE-HEALTH-API-SIGNATURE"),
    );
    if (!result.valid) {
      console.error("[vesper] rejected google health webhook:", result.reason);
      // 403 rather than 401: the caller authenticated but the payload is not
      // provably from Google.
      return new NextResponse(null, { status: 403 });
    }
  }

  const healthUserId = payload.data?.healthUserId;
  const dataType = payload.data?.dataType;

  // Acknowledge first, work afterwards — Google retries on anything but 204.
  const response = new NextResponse(null, { status: 204 });

  if (healthUserId && payload.data?.operation !== "DELETE") {
    // Deliberately not awaited. Any throw is caught so it can't surface as an
    // unhandled rejection after the response has been sent.
    void (async () => {
      try {
        const conn = await queryOne<{ user_id: string }>(
          `SELECT user_id FROM oauth_connections
           WHERE provider = 'google_health' AND health_user_id = ?`,
          [healthUserId],
        );
        if (!conn) {
          console.warn("[vesper] webhook for an unknown healthUserId; ignoring");
          return;
        }
        const result = await ingestForUser(conn.user_id, `webhook:${dataType ?? "unknown"}`);
        if (result.spikeDetected) {
          console.info(
            `[vesper] webhook ingest for ${conn.user_id}: stress ${result.stressNow}, intervention ${result.intervention ? "created" : "suppressed"}`,
          );
        }
      } catch (err) {
        console.error("[vesper] webhook processing failed:", err);
      }
    })();
  }

  return response;
}
