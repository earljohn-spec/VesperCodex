import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  consumeState,
  exchangeCode,
  fetchHealthUserId,
  saveConnection,
} from "@/lib/google-health";
import { createDevice, listDevices, updateDevice } from "@/lib/repos/biometrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Google redirects here after the user approves (or denies). Always lands the
 * user back on /biometrics with a readable status — this is a browser
 * navigation, not an API call.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) =>
    NextResponse.redirect(`${url.origin}/biometrics?health=${status}`);

  const error = url.searchParams.get("error");
  if (error) return back(error === "access_denied" ? "denied" : "error");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back("invalid");

  const check = await consumeState(state);
  if (!check.valid) return back(check.reason === "expired" ? "expired" : "invalid");

  // State is bound to a user, but confirm the browser session still matches —
  // otherwise a leaked callback URL could attach someone else's health account.
  const current = await getCurrentUser();
  if (!current || current.id !== check.userId) return back("session");

  try {
    const tokens = await exchangeCode(code, check.codeVerifier, url.origin);

    // Without a refresh token we can't sync past the first hour.
    if (!tokens.refresh_token) {
      console.error("[vesper] google health returned no refresh token");
      return back("norefresh");
    }

    // Needed so webhook notifications can be traced back to this account.
    const healthUserId = await fetchHealthUserId(tokens.access_token);

    await saveConnection({
      userId: check.userId,
      providerUserId: tokens.sub,
      healthUserId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scopes: tokens.scope ?? "",
      expiresInSec: tokens.expires_in,
    });

    const existing = (await listDevices(check.userId)).find((d) => d.provider === "fitbit");
    if (existing) {
      await updateDevice(check.userId, existing.id, { status: "connected" });
    } else {
      await createDevice(check.userId, {
        provider: "fitbit",
        displayName: "Fitbit via Google Health",
        status: "connected",
      });
    }

    return back("connected");
  } catch (err) {
    console.error("[vesper] google health callback failed:", err);
    return back("error");
  }
}
