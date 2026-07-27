import { enforceLimit, fail, ok, withUser } from "@/lib/api";
import {
  disconnect,
  ensureFreshToken,
  fetchDay,
  getConnection,
  markSynced,
  recordSyncError,
} from "@/lib/google-health";
import {
  biometricSummary,
  createBiometric,
  deriveStressIndex,
  listDevices,
  updateDevice,
} from "@/lib/repos/biometrics";
import { activeInterventions, createIntervention, recommendBreak } from "@/lib/repos/interventions";
import { execute, newId, nowIso } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const SPIKE_THRESHOLD = 65;

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
 * Pulls today's metrics and writes them as Vesper biometrics.
 *
 * The intraday heart-rate series is downsampled rather than stored point by
 * point — Google returns up to 1,440 samples a day, which is a lot of rows for
 * a chart that shows a few dozen.
 */
export const POST = withUser(async (user) => {
  const limited = await enforceLimit("fitbitSync", user.id);
  if (limited) return limited;

  const conn = await ensureFreshToken(user.id);
  if (!conn) {
    return fail(
      "Google Health isn't connected, or the connection expired. Reconnect to continue.",
      409,
    );
  }

  try {
    const snapshot = await fetchDay(conn);

    const device = (await listDevices(user.id)).find((d) => d.provider === "fitbit");
    const deviceId = device?.id ?? null;

    // Keep roughly one sample per 30 minutes.
    const stride = Math.max(1, Math.ceil(snapshot.intraday.length / 48));
    const picked = snapshot.intraday.filter((_, i) => i % stride === 0);
    const today = snapshot.date;

    let written = 0;
    let peakStress = 0;

    for (const point of picked) {
      const stress = deriveStressIndex({
        hrv: snapshot.hrv,
        heartRate: point.value,
        restingHr: snapshot.restingHr,
        respiration: snapshot.respiration,
      });
      peakStress = Math.max(peakStress, stress);

      await createBiometric(user.id, {
        deviceId,
        recordedAt: new Date(`${today}T${point.time}Z`).toISOString(),
        hrv: snapshot.hrv,
        restingHr: snapshot.restingHr,
        heartRate: point.value,
        respiration: snapshot.respiration,
        sleepHours: null,
        steps: snapshot.steps,
      });
      written++;
    }

    // Daily-only metrics still deserve a row when there's no intraday series
    // (for example a device that only reports nightly summaries).
    if (snapshot.sleepHours != null || (!written && (snapshot.hrv || snapshot.restingHr))) {
      await createBiometric(user.id, {
        deviceId,
        hrv: snapshot.hrv,
        restingHr: snapshot.restingHr,
        heartRate: snapshot.restingHr,
        respiration: snapshot.respiration,
        sleepHours: snapshot.sleepHours,
        steps: snapshot.steps,
      });
      written++;
    }

    if (device) {
      await updateDevice(user.id, device.id, { lastSyncAt: nowIso(), status: "connected" });
    }
    await markSynced(user.id);

    await execute(
      `INSERT INTO sync_events (id, user_id, resource, action, payload, status, created_at, synced_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        newId("syn"),
        user.id,
        "biometric",
        "google_health_sync",
        JSON.stringify({ samples: written, peakStress }),
        "synced",
        nowIso(),
        nowIso(),
      ],
    );

    // Same detection logic as the simulated path — one open nudge at a time.
    const summary = await biometricSummary(user.id);
    let intervention = null;
    if (summary.stressNow >= SPIKE_THRESHOLD) {
      const open = await activeInterventions(user.id);
      const recent = open.some((i) => Date.now() - new Date(i.triggeredAt).getTime() < 45 * 60_000);
      if (!recent) {
        intervention = await createIntervention(user.id, {
          ...recommendBreak(summary.stressNow, summary.hrvDelta),
        });
      }
    }

    return ok({
      synced: written,
      snapshot: {
        hrv: snapshot.hrv,
        restingHr: snapshot.restingHr,
        sleepHours: snapshot.sleepHours,
        steps: snapshot.steps,
        respiration: snapshot.respiration,
      },
      summary,
      intervention,
      spikeDetected: summary.stressNow >= SPIKE_THRESHOLD,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Health sync failed";
    await recordSyncError(user.id, message);
    return fail(message, 502);
  }
});

/** Unlinks the account and forgets the stored tokens. */
export const DELETE = withUser(async (user) => {
  await disconnect(user.id);
  const device = (await listDevices(user.id)).find((d) => d.provider === "fitbit");
  if (device) await updateDevice(user.id, device.id, { status: "paused" });
  return ok({ disconnected: true });
});
