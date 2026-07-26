import "server-only";
import { execute, newId, nowIso, query, queryOne } from "../db";
import type { Biometric, Device, DeviceProvider, DeviceStatus } from "../types";

interface DeviceRow {
  id: string;
  user_id: string;
  provider: string;
  display_name: string;
  status: string;
  battery: number | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BioRow {
  id: string;
  user_id: string;
  device_id: string | null;
  recorded_at: string;
  hrv: number | null;
  resting_hr: number | null;
  heart_rate: number | null;
  respiration: number | null;
  sleep_hours: number | null;
  steps: number | null;
  stress_index: number;
  created_at: string;
}

function mapDevice(r: DeviceRow): Device {
  return {
    id: r.id,
    userId: r.user_id,
    provider: r.provider as DeviceProvider,
    displayName: r.display_name,
    status: r.status as DeviceStatus,
    battery: r.battery,
    lastSyncAt: r.last_sync_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapBio(r: BioRow): Biometric {
  return {
    id: r.id,
    userId: r.user_id,
    deviceId: r.device_id,
    recordedAt: r.recorded_at,
    hrv: r.hrv,
    restingHr: r.resting_hr,
    heartRate: r.heart_rate,
    respiration: r.respiration,
    sleepHours: r.sleep_hours,
    steps: r.steps,
    stressIndex: r.stress_index,
    createdAt: r.created_at,
  };
}

/* -------------------------------- devices ------------------------------- */

export function listDevices(userId: string): Device[] {
  return query<DeviceRow>(`SELECT * FROM devices WHERE user_id = ? ORDER BY created_at ASC`, [
    userId,
  ]).map(mapDevice);
}

export function getDevice(userId: string, id: string): Device | null {
  const r = queryOne<DeviceRow>(`SELECT * FROM devices WHERE id = ? AND user_id = ?`, [id, userId]);
  return r ? mapDevice(r) : null;
}

export interface DeviceInput {
  provider: DeviceProvider;
  displayName: string;
  status?: DeviceStatus;
  battery?: number | null;
}

export function createDevice(userId: string, input: DeviceInput): Device {
  const id = newId("dev");
  const ts = nowIso();
  execute(
    `INSERT INTO devices (id, user_id, provider, display_name, status, battery, last_sync_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      userId,
      input.provider,
      input.displayName.trim(),
      input.status ?? "connected",
      input.battery ?? 100,
      ts,
      ts,
      ts,
    ],
  );
  return getDevice(userId, id)!;
}

export function updateDevice(
  userId: string,
  id: string,
  input: Partial<DeviceInput> & { lastSyncAt?: string },
): Device | null {
  if (!getDevice(userId, id)) return null;
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (c: string, v: unknown) => {
    sets.push(`${c} = ?`);
    params.push(v);
  };
  if (input.provider !== undefined) push("provider", input.provider);
  if (input.displayName !== undefined) push("display_name", input.displayName.trim());
  if (input.status !== undefined) push("status", input.status);
  if (input.battery !== undefined) push("battery", input.battery);
  if (input.lastSyncAt !== undefined) push("last_sync_at", input.lastSyncAt);
  push("updated_at", nowIso());
  execute(`UPDATE devices SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, [
    ...params,
    id,
    userId,
  ]);
  return getDevice(userId, id);
}

export function deleteDevice(userId: string, id: string): boolean {
  if (!getDevice(userId, id)) return false;
  execute(`DELETE FROM devices WHERE id = ? AND user_id = ?`, [id, userId]);
  return true;
}

/* ------------------------------ biometrics ------------------------------ */

export function listBiometrics(userId: string, hours = 24): Biometric[] {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return query<BioRow>(
    `SELECT * FROM biometrics WHERE user_id = ? AND recorded_at >= ? ORDER BY recorded_at ASC`,
    [userId, since],
  ).map(mapBio);
}

export function latestBiometric(userId: string): Biometric | null {
  const r = queryOne<BioRow>(
    `SELECT * FROM biometrics WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1`,
    [userId],
  );
  return r ? mapBio(r) : null;
}

export interface BiometricInput {
  deviceId?: string | null;
  recordedAt?: string;
  hrv?: number | null;
  restingHr?: number | null;
  heartRate?: number | null;
  respiration?: number | null;
  sleepHours?: number | null;
  steps?: number | null;
}

/**
 * Derive a 0-100 stress index. Lower HRV + elevated HR + fast respiration =>
 * higher stress. This mirrors how consumer wearables surface "body strain".
 */
export function deriveStressIndex(input: {
  hrv?: number | null;
  heartRate?: number | null;
  restingHr?: number | null;
  respiration?: number | null;
  baselineHrv?: number;
}): number {
  const baselineHrv = input.baselineHrv ?? 58;
  let score = 0;

  if (input.hrv != null) {
    const ratio = input.hrv / baselineHrv;
    // ratio 1.0 -> 0 pts, ratio 0.55 -> ~50 pts
    score += Math.max(0, Math.min(55, (1 - ratio) * 110));
  }
  if (input.heartRate != null && input.restingHr != null) {
    const lift = input.heartRate - input.restingHr;
    score += Math.max(0, Math.min(30, lift * 0.9));
  }
  if (input.respiration != null) {
    score += Math.max(0, Math.min(15, (input.respiration - 13) * 3));
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function createBiometric(userId: string, input: BiometricInput): Biometric {
  const id = newId("bio");
  const ts = nowIso();
  const stress = deriveStressIndex(input);
  execute(
    `INSERT INTO biometrics (id, user_id, device_id, recorded_at, hrv, resting_hr, heart_rate, respiration, sleep_hours, steps, stress_index, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      userId,
      input.deviceId ?? null,
      input.recordedAt ?? ts,
      input.hrv ?? null,
      input.restingHr ?? null,
      input.heartRate ?? null,
      input.respiration ?? null,
      input.sleepHours ?? null,
      input.steps ?? null,
      stress,
      ts,
    ],
  );
  const r = queryOne<BioRow>(`SELECT * FROM biometrics WHERE id = ?`, [id])!;
  return mapBio(r);
}

export function deleteBiometric(userId: string, id: string): boolean {
  const r = queryOne<BioRow>(`SELECT id FROM biometrics WHERE id = ? AND user_id = ?`, [
    id,
    userId,
  ]);
  if (!r) return false;
  execute(`DELETE FROM biometrics WHERE id = ? AND user_id = ?`, [id, userId]);
  return true;
}

export interface BiometricSummary {
  currentHrv: number | null;
  baselineHrv: number;
  hrvDelta: number;
  currentHr: number | null;
  restingHr: number | null;
  sleepLastNight: number | null;
  stepsToday: number;
  stressNow: number;
  stressAvg24: number;
  peakStress24: number;
  spikeCount24: number;
  lastSyncAt: string | null;
  readiness: number;
}

export function biometricSummary(userId: string): BiometricSummary {
  const latest = latestBiometric(userId);
  const day = listBiometrics(userId, 24);

  const baselineRow = queryOne<{ m: number | null }>(
    `SELECT AVG(hrv) m FROM biometrics WHERE user_id = ? AND recorded_at >= ? AND hrv IS NOT NULL`,
    [userId, new Date(Date.now() - 30 * 86400_000).toISOString()],
  );
  const baseline = +(baselineRow?.m ?? 58).toFixed(1);

  const stresses = day.map((d) => d.stressIndex);
  const avg = stresses.length ? stresses.reduce((a, b) => a + b, 0) / stresses.length : 0;
  const peak = stresses.length ? Math.max(...stresses) : 0;
  const spikes = day.filter((d) => d.stressIndex >= 65).length;

  const sleepRow = queryOne<{ s: number | null }>(
    `SELECT sleep_hours s FROM biometrics WHERE user_id = ? AND sleep_hours IS NOT NULL
     ORDER BY recorded_at DESC LIMIT 1`,
    [userId],
  );
  const stepsRow = queryOne<{ s: number | null }>(
    `SELECT MAX(steps) s FROM biometrics WHERE user_id = ? AND recorded_at >= ?`,
    [userId, new Date(new Date().setHours(0, 0, 0, 0)).toISOString()],
  );

  const hrvDelta = latest?.hrv != null ? +(latest.hrv - baseline).toFixed(1) : 0;
  const sleep = sleepRow?.s ?? null;

  // readiness: blend of HRV vs baseline, sleep, and inverse stress
  let readiness = 50;
  if (latest?.hrv != null) readiness += Math.max(-25, Math.min(25, (hrvDelta / baseline) * 100));
  if (sleep != null) readiness += Math.max(-15, Math.min(15, (sleep - 7) * 7));
  readiness -= (avg - 40) * 0.35;

  return {
    currentHrv: latest?.hrv ?? null,
    baselineHrv: baseline,
    hrvDelta,
    currentHr: latest?.heartRate ?? null,
    restingHr: latest?.restingHr ?? null,
    sleepLastNight: sleep,
    stepsToday: stepsRow?.s ?? 0,
    stressNow: latest?.stressIndex ?? 0,
    stressAvg24: Math.round(avg),
    peakStress24: Math.round(peak),
    spikeCount24: spikes,
    lastSyncAt: latest?.recordedAt ?? null,
    readiness: Math.round(Math.max(0, Math.min(100, readiness))),
  };
}
