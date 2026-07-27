import { NextResponse } from "next/server";
import { fail, withUser } from "@/lib/api";
import { beginAuthorization, googleHealthConfigured } from "@/lib/google-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kicks off the Google Health OAuth flow. */
export const GET = withUser(async (user, req: Request) => {
  if (!googleHealthConfigured()) {
    return fail(
      "Google Health isn't configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      503,
    );
  }
  const origin = new URL(req.url).origin;
  const { url } = await beginAuthorization(user.id, origin);
  return NextResponse.redirect(url);
});
