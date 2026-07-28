import "server-only";
import { execute, newId, nowIso } from "./db";
import { ensureFreshToken, fetchDay, markSynced, recordSyncError } from "./google-health";
import {
  biometricSummary,
  createBiometric,
  deriveStressIndex,
  listDevices,
  updateDevice,
} from "./repos/biometrics";
import { activeInterventions, createIntervention, recommendBreak } from "./repos/interventions";

/**
 * Shared ingest for Google Health data.
 *
 * Both the manual "Pull today's data" button and the webhook receiver funnel
 * through here, so a spike detected by a push notification behaves exactly
 * like one found by a manual sync — same thresholds, same deduplication.
 */

const SPIKE_THRESHOLD = 65;
/** One open nudge at a time; a flurry of webhooks shouldn't mean a flurry of prompts. */
const DEDUPE_WINDOW_MS = 45 * 60_000;

export interface IngestResult {
  ok: boolean;
  synced: number;
  stressNow: number;
  spikeDetected: boolean;
  intervention: { id: string; title: string } | null;
  snapshot: {
    hrv: number | null;
    restingHr: number | null;
    sleepHours: number | null;
    steps: number | null;
    respiration: number | null;
  } | null;
  summary?: Awaited<ReturnType<typeof biometricSummary>>;
  error?: string;
}

export async function ingestForUser(userId: string, source: string): Promise<IngestResult> {
  const empty = {
    synced: 0,
    stressNow: 0,
    spikeDetected: false,
    intervention: null,
    snapshot: null,
  };

  const conn = await ensureFreshToken(userId);
  if (!conn) {
    return { ok: false, ...empty, error: "Google Health isn't connected, or the connection expired." };
  }

  try {
    const snapshot = await fetchDay(conn);
    const device = (await listDevices(userId)).find((d) => d.provider === "fitbit");
    const deviceId = device?.id ?? null;

    // Downsample: Google can return a point per minute, which is far more
    // rows than the charts need.
    const stride = Math.max(1, Math.ceil(snapshot.intraday.length / 48));
    const picked = snapshot.intraday.filter((_, i) => i % stride === 0);

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

      await createBiometric(userId, {
        deviceId,
        recordedAt: new Date(`${snapshot.date}T${point.time}Z`).toISOString(),
        hrv: snapshot.hrv,
        restingHr: snapshot.restingHr,
        heartRate: point.value,
        respiration: snapshot.respiration,
        sleepHours: null,
        steps: snapshot.steps,
      });
      written++;
    }

    // Daily-only metrics still deserve a row when there's no intraday series.
    if (snapshot.sleepHours != null || (!written && (snapshot.hrv || snapshot.restingHr))) {
      await createBiometric(userId, {
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
      await updateDevice(userId, device.id, { lastSyncAt: nowIso(), status: "connected" });
    }
    await markSynced(userId);

    await execute(
      `INSERT INTO sync_events (id, user_id, resource, action, payload, status, created_at, synced_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        newId("syn"),
        userId,
        "biometric",
        source.startsWith("webhook") ? "google_health_webhook" : "google_health_sync",
        JSON.stringify({ samples: written, peakStress, source }),
        "synced",
        nowIso(),
        nowIso(),
      ],
    );

    const summary = await biometricSummary(userId);
    let intervention: { id: string; title: string } | null = null;

    if (summary.stressNow >= SPIKE_THRESHOLD) {
      const open = await activeInterventions(userId);
      const recent = open.some(
        (i) => Date.now() - new Date(i.triggeredAt).getTime() < DEDUPE_WINDOW_MS,
      );
      if (!recent) {
        const created = await createIntervention(userId, {
          ...recommendBreak(summary.stressNow, summary.hrvDelta),
        });
        intervention = { id: created.id, title: created.title };
      }
    }

    return {
      ok: true,
      synced: written,
      stressNow: summary.stressNow,
      spikeDetected: summary.stressNow >= SPIKE_THRESHOLD,
      intervention,
      snapshot: {
        hrv: snapshot.hrv,
        restingHr: snapshot.restingHr,
        sleepHours: snapshot.sleepHours,
        steps: snapshot.steps,
        respiration: snapshot.respiration,
      },
      summary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google Health sync failed";
    await recordSyncError(userId, message);
    return { ok: false, ...empty, error: message };
  }
}
