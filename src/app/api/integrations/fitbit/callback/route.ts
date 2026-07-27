import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { consumeState, exchangeCode, saveConnection } from "@/lib/fitbit";
import { createDevice, listDevices, updateDevice } from "@/lib/repos/biometrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fitbit redirects here after the user approves (or denies).
 *
 * Always lands the user back on /biometrics with a readable status rather than
 * rendering raw JSON — this is a browser navigation, not an API call.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) => NextResponse.redirect(`${url.origin}/biometrics?fitbit=${status}`);

  const error = url.searchParams.get("error");
  if (error) {
    // access_denied means they pressed "Deny" — not worth alarming them.
    return back(error === "access_denied" ? "denied" : "error");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back("invalid");

  const check = await consumeState(state);
  if (!check.valid) return back(check.reason === "expired" ? "expired" : "invalid");

  // The state is bound to a user, but confirm the browser session still
  // matches — otherwise a leaked callback URL could attach someone else's
  // Fitbit account to this session.
  const current = await getCurrentUser();
  if (!current || current.id !== check.userId) return back("session");

  try {
    const tokens = await exchangeCode(code, check.codeVerifier, url.origin);
    await saveConnection({
      userId: check.userId,
      providerUserId: tokens.user_id ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scopes: tokens.scope ?? "",
      expiresInSec: tokens.expires_in,
    });

    // Surface it in the device list so the UI has something concrete.
    const existing = (await listDevices(check.userId)).find((d) => d.provider === "fitbit");
    if (existing) {
      await updateDevice(check.userId, existing.id, { status: "connected" });
    } else {
      await createDevice(check.userId, {
        provider: "fitbit",
        displayName: "Fitbit",
        status: "connected",
      });
    }

    return back("connected");
  } catch (err) {
    console.error("[vesper] fitbit callback failed:", err);
    return back("error");
  }
}
