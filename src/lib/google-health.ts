import "server-only";
import { execute, newId, nowIso, queryOne } from "./db";
import { encrypt, tryDecrypt, createCodeVerifier, codeChallenge, safeEqual } from "./crypto";

/**
 * Google Health API integration (replaces the legacy Fitbit Web API).
 *
 * Google is turning down the Fitbit Web API in September 2026 and has already
 * closed new app registration on dev.fitbit.com. Fitbit and Pixel Watch data
 * now comes through the Google Health API, authorised with standard Google
 * OAuth 2.0 rather than Fitbit's own authorisation server.
 *
 * Practical differences that shaped this module:
 * - 123 Fitbit endpoints collapse into ~39 data types read through uniform
 *   methods (`list`, `dailyRollUp`), so one helper covers everything.
 * - Every scope is "Restricted", meaning production access needs a Google
 *   security review. Up to 100 manually-added test users work without it,
 *   which is enough for development and a private beta.
 * - Intraday heart rate is available by default, where the old API required a
 *   separate application.
 *
 * Verified against a local mock of the documented response shapes —
 * `npm run test:googlehealth`.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_API = "https://health.googleapis.com";

/** Overridable so tests can point at a local mock. */
function apiBase() {
  return process.env.GOOGLE_HEALTH_API_BASE ?? DEFAULT_API;
}
function tokenUrl() {
  return process.env.GOOGLE_OAUTH_TOKEN_URL ?? TOKEN_URL;
}

/**
 * Only what Vesper needs. `health_metrics_and_measurements` carries HRV,
 * resting heart rate and breathing rate; `activity_and_fitness` carries steps
 * and intraday heart rate.
 */
const S = "https://www.googleapis.com/auth/googlehealth";
export const GOOGLE_HEALTH_SCOPES = [
  `${S}.health_metrics_and_measurements.readonly`,
  `${S}.activity_and_fitness.readonly`,
  `${S}.sleep.readonly`,
  "openid",
  "email",
] as const;

export const PROVIDER = "google_health";

export function googleHealthConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(origin: string) {
  return (
    process.env.GOOGLE_REDIRECT_URI ?? `${origin}/api/integrations/google-health/callback`
  );
}

/* ------------------------------ connections ----------------------------- */

export interface Connection {
  id: string;
  userId: string;
  providerUserId: string | null;
  accessToken: string;
  refreshToken: string;
  scopes: string;
  expiresAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

interface ConnectionRow {
  id: string;
  user_id: string;
  provider_user_id: string | null;
  access_token: string;
  refresh_token: string;
  scopes: string;
  expires_at: string;
  last_sync_at: string | null;
  last_error: string | null;
}

export async function getConnection(userId: string): Promise<Connection | null> {
  const row = await queryOne<ConnectionRow>(
    `SELECT * FROM oauth_connections WHERE user_id = ? AND provider = ?`,
    [userId, PROVIDER],
  );
  if (!row) return null;

  const accessToken = tryDecrypt(row.access_token);
  const refreshToken = tryDecrypt(row.refresh_token);

  // A rotated encryption key makes stored tokens unreadable. Report that as
  // "disconnected" rather than crashing; the user can simply reconnect.
  if (!accessToken || !refreshToken) {
    console.error("[vesper] google health tokens failed to decrypt; treating as disconnected");
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    providerUserId: row.provider_user_id,
    accessToken,
    refreshToken,
    scopes: row.scopes,
    expiresAt: row.expires_at,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
  };
}

export async function saveConnection(input: {
  userId: string;
  providerUserId: string | null;
  /** Google Health's own user id — webhooks identify users by this. */
  healthUserId?: string | null;
  accessToken: string;
  /** Google omits this on refresh; keep the existing one when absent. */
  refreshToken?: string;
  scopes: string;
  expiresInSec: number;
}) {
  const ts = nowIso();
  const expiresAt = new Date(Date.now() + input.expiresInSec * 1000).toISOString();
  const existing = await queryOne<{ id: string; refresh_token: string }>(
    `SELECT id, refresh_token FROM oauth_connections WHERE user_id = ? AND provider = ?`,
    [input.userId, PROVIDER],
  );

  // Unlike Fitbit, Google only returns a refresh token on the first consent.
  // Overwriting it with undefined would permanently break the connection.
  const refreshEncrypted = input.refreshToken
    ? encrypt(input.refreshToken)
    : existing?.refresh_token;

  if (!refreshEncrypted) {
    throw new Error("No refresh token available — re-consent with prompt=consent required.");
  }

  if (existing) {
    await execute(
      `UPDATE oauth_connections
         SET provider_user_id = ?, access_token = ?, refresh_token = ?, scopes = ?,
             expires_at = ?, last_error = NULL, updated_at = ?,
             health_user_id = COALESCE(?, health_user_id)
       WHERE id = ?`,
      [
        input.providerUserId,
        encrypt(input.accessToken),
        refreshEncrypted,
        input.scopes,
        expiresAt,
        ts,
        input.healthUserId ?? null,
        existing.id,
      ],
    );
    return existing.id;
  }

  const id = newId("oac");
  await execute(
    `INSERT INTO oauth_connections
       (id, user_id, provider, provider_user_id, access_token, refresh_token, scopes,
        expires_at, last_sync_at, last_error, created_at, updated_at, health_user_id)
     VALUES (?,?,?,?,?,?,?,?,NULL,NULL,?,?,?)`,
    [
      id,
      input.userId,
      PROVIDER,
      input.providerUserId,
      encrypt(input.accessToken),
      refreshEncrypted,
      input.scopes,
      expiresAt,
      ts,
      ts,
      input.healthUserId ?? null,
    ],
  );
  return id;
}

export async function disconnect(userId: string) {
  await execute(`DELETE FROM oauth_connections WHERE user_id = ? AND provider = ?`, [
    userId,
    PROVIDER,
  ]);
}

async function noteError(userId: string, message: string) {
  await execute(
    `UPDATE oauth_connections SET last_error = ?, updated_at = ? WHERE user_id = ? AND provider = ?`,
    [message.slice(0, 300), nowIso(), userId, PROVIDER],
  );
}

/* -------------------------------- OAuth --------------------------------- */

export async function beginAuthorization(userId: string, origin: string) {
  const verifier = createCodeVerifier();
  const state = newId("st");

  await execute(`DELETE FROM oauth_states WHERE user_id = ? AND provider = ?`, [userId, PROVIDER]);
  await execute(
    `INSERT INTO oauth_states (state, user_id, provider, code_verifier, expires_at, created_at)
     VALUES (?,?,?,?,?,?)`,
    [state, userId, PROVIDER, verifier, new Date(Date.now() + 10 * 60_000).toISOString(), nowIso()],
  );

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    response_type: "code",
    redirect_uri: googleRedirectUri(origin),
    scope: GOOGLE_HEALTH_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: "S256",
    // offline + consent guarantee a refresh token; without them Google only
    // issues one on the very first authorisation ever granted to the client.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  return { url: `${AUTH_URL}?${params}`, state };
}

export type StateCheck =
  | { valid: true; userId: string; codeVerifier: string }
  | { valid: false; reason: "unknown" | "expired" };

export async function consumeState(state: string): Promise<StateCheck> {
  const row = await queryOne<{
    state: string;
    user_id: string;
    code_verifier: string;
    expires_at: string;
  }>(`SELECT * FROM oauth_states WHERE state = ? AND provider = ?`, [state, PROVIDER]);

  if (!row || !safeEqual(row.state, state)) return { valid: false, reason: "unknown" };
  await execute(`DELETE FROM oauth_states WHERE state = ?`, [state]);

  if (new Date(row.expires_at).getTime() < Date.now()) return { valid: false, reason: "expired" };
  return { valid: true, userId: row.user_id, codeVerifier: row.code_verifier };
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

/** Extracts the subject from an ID token without verifying it. */
function subjectFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return json.sub ?? null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string, verifier: string, origin: string) {
  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as TokenResponse;
  return { ...json, sub: subjectFromIdToken(json.id_token) };
}

/**
 * Refreshes the access token.
 *
 * Google's refresh tokens do NOT rotate — the same one is reused — so unlike
 * the Fitbit flow we keep the stored value when the response omits it.
 */
export async function refreshTokens(conn: Connection): Promise<Connection | null> {
  let res: Response;
  try {
    res = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: conn.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    // Network failure: treat as a failed refresh so the caller degrades to
    // "reconnect" rather than 500ing — and keep the still-valid refresh token.
    const message = err instanceof Error ? err.message : "network error";
    await noteError(conn.userId, `Couldn't reach Google: ${message}`);
    console.error("[vesper] google health refresh network failure:", message);
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    await noteError(conn.userId, `Refresh failed (${res.status}). Reconnect Google Health.`);
    console.error("[vesper] google health refresh failed:", res.status, body.slice(0, 200));
    return null;
  }

  const json = (await res.json()) as TokenResponse;
  await saveConnection({
    userId: conn.userId,
    providerUserId: subjectFromIdToken(json.id_token) ?? conn.providerUserId,
    accessToken: json.access_token,
    refreshToken: json.refresh_token, // usually absent; saveConnection keeps the old one
    scopes: json.scope ?? conn.scopes,
    expiresInSec: json.expires_in,
  });
  return getConnection(conn.userId);
}

export async function ensureFreshToken(userId: string): Promise<Connection | null> {
  const conn = await getConnection(userId);
  if (!conn) return null;
  const expiresSoon = new Date(conn.expiresAt).getTime() - 60_000 < Date.now();
  return expiresSoon ? refreshTokens(conn) : conn;
}

/* ------------------------------- fetching ------------------------------- */

async function apiGet<T>(conn: Connection, path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${conn.accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 429) {
    const retry = res.headers.get("Retry-After") ?? "3600";
    throw new Error(`Google Health rate limit reached. Retry in ${retry}s.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Health ${path} failed (${res.status}): ${body.slice(0, 160)}`);
  }
  return (await res.json()) as T;
}

/** Response shapes per the v4 reference. */
interface DataPoint {
  name?: string;
  sampleTime?: { physicalTime?: string; civilTime?: string };
  interval?: { startTime?: string; endTime?: string };
  heartRate?: { beatsPerMinute?: number };
  dailyHeartRateVariability?: { rmssdMilliseconds?: number };
  dailyRestingHeartRate?: { beatsPerMinute?: number };
  dailyRespiratoryRate?: { breathsPerMinute?: number };
  steps?: { count?: number };
  sleep?: { durationMillis?: string; totalSleepMillis?: string };
}
interface ListResponse {
  dataPoints?: DataPoint[];
  nextPageToken?: string;
}

export interface HealthSnapshot {
  date: string;
  hrv: number | null;
  restingHr: number | null;
  heartRate: number | null;
  respiration: number | null;
  sleepHours: number | null;
  steps: number | null;
  intraday: { time: string; value: number }[];
}

/** RFC-3339 bounds for a civil day, in UTC. */
function dayRange(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Pulls a day of metrics.
 *
 * Each data type is fetched independently: a user who hasn't granted the sleep
 * scope, or whose device doesn't record HRV, shouldn't lose heart rate too. So
 * failures degrade to null instead of aborting.
 */
export async function fetchDay(conn: Connection, when = new Date()): Promise<HealthSnapshot> {
  const { start, end } = dayRange(when);

  const settle = async <T>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (err) {
      console.warn("[vesper] google health partial fetch failure:", (err as Error).message);
      return null;
    }
  };

  const list = (dataType: string, field: string) =>
    apiGet<ListResponse>(
      conn,
      `/v4/users/me/dataTypes/${dataType}/dataPoints?pageSize=1440&filter=` +
        encodeURIComponent(
          `${field}.interval.start_time >= "${start}" AND ${field}.interval.start_time < "${end}"`,
        ),
    );

  const listSample = (dataType: string, field: string) =>
    apiGet<ListResponse>(
      conn,
      `/v4/users/me/dataTypes/${dataType}/dataPoints?pageSize=1440&filter=` +
        encodeURIComponent(
          `${field}.sample_time.physical_time >= "${start}" AND ${field}.sample_time.physical_time < "${end}"`,
        ),
    );

  const [hrv, heart, restingHr, respiratory, steps, sleep] = await Promise.all([
    settle(list("daily-heart-rate-variability", "daily_heart_rate_variability")),
    settle(listSample("heart-rate", "heart_rate")),
    settle(list("daily-resting-heart-rate", "daily_resting_heart_rate")),
    settle(list("daily-respiratory-rate", "daily_respiratory_rate")),
    settle(list("steps", "steps")),
    settle(list("sleep", "sleep")),
  ]);

  // Intraday heart rate → the shape the rest of Vesper already understands.
  const intraday = (heart?.dataPoints ?? [])
    .map((p) => {
      const iso = p.sampleTime?.physicalTime;
      const bpm = p.heartRate?.beatsPerMinute;
      if (!iso || bpm == null) return null;
      return { time: new Date(iso).toISOString().slice(11, 19), value: bpm };
    })
    .filter((x): x is { time: string; value: number } => x !== null);

  const totalSteps = (steps?.dataPoints ?? []).reduce((sum, p) => sum + (p.steps?.count ?? 0), 0);

  const sleepMillis = (sleep?.dataPoints ?? []).reduce((sum, p) => {
    const raw = p.sleep?.totalSleepMillis ?? p.sleep?.durationMillis;
    return sum + (raw ? Number(raw) : 0);
  }, 0);

  return {
    date: start.slice(0, 10),
    hrv: hrv?.dataPoints?.[0]?.dailyHeartRateVariability?.rmssdMilliseconds ?? null,
    restingHr: restingHr?.dataPoints?.[0]?.dailyRestingHeartRate?.beatsPerMinute ?? null,
    heartRate: intraday.length ? intraday[intraday.length - 1].value : null,
    respiration: respiratory?.dataPoints?.[0]?.dailyRespiratoryRate?.breathsPerMinute ?? null,
    sleepHours: sleepMillis > 0 ? +(sleepMillis / 3_600_000).toFixed(2) : null,
    steps: totalSteps > 0 ? totalSteps : null,
    intraday,
  };
}

/**
 * Google Health identifies users in webhooks by `healthUserId`, which is
 * distinct from the OAuth subject. The mapping never changes, so it's fetched
 * once at connect time and cached.
 */
export async function fetchHealthUserId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase()}/v4/users/me:getIdentity`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { healthUserId?: string; name?: string };
    return json.healthUserId ?? json.name?.split("/").pop() ?? null;
  } catch {
    return null;
  }
}

export async function markSynced(userId: string) {
  await execute(
    `UPDATE oauth_connections SET last_sync_at = ?, last_error = NULL, updated_at = ?
     WHERE user_id = ? AND provider = ?`,
    [nowIso(), nowIso(), userId, PROVIDER],
  );
}

export async function recordSyncError(userId: string, message: string) {
  await noteError(userId, message);
}
