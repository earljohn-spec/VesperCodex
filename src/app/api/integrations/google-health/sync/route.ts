import { enforceLimit, fail, ok, withUser } from "@/lib/api";
import { disconnect, getConnection } from "@/lib/google-health";
import { ingestForUser } from "@/lib/google-health-sync";
import { listDevices, updateDevice } from "@/lib/repos/biometrics";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Reports whether Google Health is linked, without exposing token material. */
export const GET = withUser(async (user) => {
  const conn = await getConnection(user.id);
  return ok({
    connected: !!conn,
    scopes: conn?.scopes ?? null,
    lastSyncAt: conn?.lastSyncAt ?? null,
    lastError: conn?.lastError ?? null,
  });
});

/**
 * Manual "Pull today's data".
 *
 * Shares its implementation with the webhook receiver via ingestForUser, so a
 * push-triggered sync and a button-triggered one behave identically.
 */
export const POST = withUser(async (user) => {
  const limited = await enforceLimit("fitbitSync", user.id);
  if (limited) return limited;

  const result = await ingestForUser(user.id, "manual");
  if (!result.ok) {
    // 409 when simply not connected; 502 when the upstream call failed.
    const status = result.error?.includes("isn't connected") ? 409 : 502;
    return fail(result.error ?? "Sync failed", status);
  }

  return ok({
    synced: result.synced,
    snapshot: result.snapshot,
    summary: result.summary,
    intervention: result.intervention,
    spikeDetected: result.spikeDetected,
  });
});

/** Unlinks the account and forgets the stored tokens. */
export const DELETE = withUser(async (user) => {
  await disconnect(user.id);
  const device = (await listDevices(user.id)).find((d) => d.provider === "fitbit");
  if (device) await updateDevice(user.id, device.id, { status: "paused" });
  return ok({ disconnected: true });
});
