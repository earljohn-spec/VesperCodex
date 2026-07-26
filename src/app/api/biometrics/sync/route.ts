import { z } from "zod";
import { ok, parseBody, withUser } from "@/lib/api";
import {
  biometricSummary,
  createBiometric,
  latestBiometric,
  listDevices,
  updateDevice,
} from "@/lib/repos/biometrics";
import { activeInterventions, createIntervention, recommendBreak } from "@/lib/repos/interventions";
import { execute, newId, nowIso } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Simulates a wearable push. In production this is the webhook that Apple
 * HealthKit / Fitbit Web API would call; here it generates a physiologically
 * plausible sample so the whole detection → intervention loop is demonstrable.
 *
 * The important part is the logic *after* the sample lands: a stress spike
 * automatically creates a micro-break suggestion, deduplicated so the user
 * isn't buried in nudges.
 */

const schema = z.object({
  /** Force a high-stress sample, for demoing the spike → intervention flow. */
  simulateSpike: z.boolean().optional(),
  hrv: z.number().min(5).max(200).optional(),
  heartRate: z.number().min(30).max(220).optional(),
  restingHr: z.number().min(30).max(120).optional(),
  respiration: z.number().min(4).max(40).optional(),
  deviceId: z.string().optional(),
});

export const POST = withUser(async (user, req: Request) => {
  const input = await parseBody(req, schema).catch(() => ({}) as z.infer<typeof schema>);

  const devices = listDevices(user.id).filter((d) => d.status !== "paused");
  const device = devices.find((d) => d.id === input.deviceId) ?? devices[0] ?? null;
  const prev = latestBiometric(user.id);
  const summary = biometricSummary(user.id);

  const restingHr = input.restingHr ?? prev?.restingHr ?? 56;
  const baseline = summary.baselineHrv || 58;

  let hrv: number;
  let heartRate: number;
  let respiration: number;

  if (input.simulateSpike) {
    hrv = Math.max(16, baseline * (0.5 + Math.random() * 0.12));
    heartRate = restingHr + 20 + Math.random() * 14;
    respiration = 15.5 + Math.random() * 2.5;
  } else {
    // random walk around the recent value, drifting back toward baseline
    const last = prev?.hrv ?? baseline;
    const drift = (baseline - last) * 0.25;
    hrv = Math.max(15, Math.min(120, last + drift + (Math.random() * 14 - 7)));
    heartRate = restingHr + Math.max(0, (baseline - hrv) * 0.55) + Math.random() * 8;
    respiration = 12.4 + Math.max(0, (baseline - hrv) * 0.05) + Math.random();
  }

  const sample = createBiometric(user.id, {
    deviceId: device?.id ?? null,
    hrv: input.hrv ?? +hrv.toFixed(1),
    heartRate: input.heartRate ?? Math.round(heartRate),
    restingHr,
    respiration: input.respiration ?? +respiration.toFixed(1),
    steps: (prev?.steps ?? 0) + Math.floor(Math.random() * 220),
  });

  if (device) updateDevice(user.id, device.id, { lastSyncAt: nowIso(), status: "connected" });

  execute(
    `INSERT INTO sync_events (id, user_id, resource, action, payload, status, created_at, synced_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      newId("syn"),
      user.id,
      "biometric",
      "sync",
      JSON.stringify({ provider: device?.provider ?? "manual", stress: sample.stressIndex }),
      "synced",
      nowIso(),
      nowIso(),
    ],
  );

  // ---- stress spike detection ----
  const SPIKE_THRESHOLD = 65;
  const hrvDelta = sample.hrv != null ? sample.hrv - baseline : 0;
  let intervention = null;

  if (sample.stressIndex >= SPIKE_THRESHOLD) {
    // don't stack suggestions — one open nudge at a time
    const alreadyOpen = activeInterventions(user.id).some(
      (i) => Date.now() - new Date(i.triggeredAt).getTime() < 45 * 60_000,
    );
    if (!alreadyOpen) {
      const rec = recommendBreak(sample.stressIndex, hrvDelta);
      intervention = createIntervention(user.id, { ...rec, biometricId: sample.id });
    }
  }

  return ok({
    sample,
    summary: biometricSummary(user.id),
    intervention,
    spikeDetected: sample.stressIndex >= SPIKE_THRESHOLD,
  });
});
