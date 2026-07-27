import { NextResponse } from "next/server";
import { fail, withUser } from "@/lib/api";
import { beginAuthorization, fitbitConfigured } from "@/lib/fitbit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kicks off the Fitbit OAuth flow. */
export const GET = withUser(async (user, req: Request) => {
  if (!fitbitConfigured()) {
    return fail(
      "Fitbit isn't configured on this server. Set FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET.",
      503,
    );
  }

  const origin = new URL(req.url).origin;
  const { url } = await beginAuthorization(user.id, origin);
  return NextResponse.redirect(url);
});
