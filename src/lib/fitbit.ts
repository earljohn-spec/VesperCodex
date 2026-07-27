import "server-only";
import { execute, newId, nowIso, queryOne } from "./db";
import { encrypt, tryDecrypt, createCodeVerifier, codeChallenge, safeEqual } from "./crypto";

/**
 * Fitbit Web API integration.
 *
 * OAuth 2.0 Authorization Code flow with PKCE. Fitbit supports PKCE for
 * confidential clients too, and using it means an intercepted `code` is
 * useless without the verifier we never transmit.
 *
 * Access tokens last 8 hours and refresh tokens rotate on every use — if we
 * ever drop a rotated refresh token the connection is permanently broken, so
 * `refreshTokens` persists the new pair before returning.
 *
 * Everything here is exercised by `npm run test:fitbit` against a local mock
 * that mirrors Fitbit's documented response shapes.
 */

const AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const DEFAULT_API = "https://api.fitbit.com";

/** Overridable so tests can point at a local mock. */
function apiBase() {
  return process.env.FITBIT_API_BASE ?? DEFAULT_API;
}

/** Only what Vesper actually needs — no location, no weight, no social. */
export const FITBIT_SCOPES = ["heartrate", "activity", "sleep", "profile"] as const;

export function fitbitConfigured() {
  return !!(process.env.FITBIT_CLIENT_ID && process.env.FITBIT_CLIENT_SECRET);
}

export function fitbitRedirectUri(origin: string) {
  return process.env.FITBIT_REDIRECT_URI ?? `${origin}/api/integrations/fitbit/callback`;
}

/* ------------------------------ connections ----------------------------- */

export interface Connection {
  id: string;
  userId: string;
  provider: string;
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
  provider: string;
  provider_user_id: string | null;
  access_token: string;
  refresh_token: string;
  scopes: string;
  expires_at: string;
  last_sync_at: string | null;
  last_error: string | null;
}

/** Returns the stored connection with tokens decrypted, or null. */
export async function getConnection(userId: string): Promise<Connection | null> {
  const row = await queryOne<ConnectionRow>(
    `SELECT * FROM oauth_connections WHERE user_id = ? AND provider = 'fitbit'`,
    [userId],
  );
  if (!row) return null;

  const accessToken = tryDecrypt(row.access_token);
  const refreshToken = tryDecrypt(row.refresh_token);

  // A rotated encryption key makes stored tokens unreadable. Surface that as
  // "disconnected" rather than crashing — the user can simply reconnect.
  if (!accessToken || !refreshToken) {
    console.error("[vesper] fitbit tokens failed to decrypt; treating as disconnected");
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
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
  accessToken: string;
  refreshToken: string;
  scopes: string;
  expiresInSec: number;
}) {
  const ts = nowIso();
  const expiresAt = new Date(Date.now() + input.expiresInSec * 1000).toISOString();
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM oauth_connections WHERE user_id = ? AND provider = 'fitbit'`,
    [input.userId],
  );

  if (existing) {
    await execute(
      `UPDATE oauth_connections
         SET provider_user_id = ?, access_token = ?, refresh_token = ?, scopes = ?,
             expires_at = ?, last_error = NULL, updated_at = ?
       WHERE id = ?`,
      [
        input.providerUserId,
        encrypt(input.accessToken),
        encrypt(input.refreshToken),
        input.scopes,
        expiresAt,
        ts,
        existing.id,
      ],
    );
    return existing.id;
  }

  const id = newId("oac");
  await execute(
    `INSERT INTO oauth_connections
       (id, user_id, provider, provider_user_id, access_token, refresh_token, scopes,
        expires_at, last_sync_at, last_error, created_at, updated_at)
     VALUES (?,?,'fitbit',?,?,?,?,?,NULL,NULL,?,?)`,
    [
      id,
      input.userId,
      input.providerUserId,
      encrypt(input.accessToken),
      encrypt(input.refreshToken),
      input.scopes,
      expiresAt,
      ts,
      ts,
    ],
  );
  return id;
}

export async function disconnect(userId: string) {
  await execute(`DELETE FROM oauth_connections WHERE user_id = ? AND provider = 'fitbit'`, [
    userId,
  ]);
}

async function noteError(userId: string, message: string) {
  await execute(
    `UPDATE oauth_connections SET last_error = ?, updated_at = ? WHERE user_id = ? AND provider = 'fitbit'`,
    [message.slice(0, 300), nowIso(), userId],
  );
}

/* -------------------------------- OAuth --------------------------------- */

/** Builds the authorize URL and stores the PKCE verifier against a state. */
export async function beginAuthorization(userId: string, origin: string) {
  const verifier = createCodeVerifier();
  const state = newId("st");

  await execute(`DELETE FROM oauth_states WHERE user_id = ? AND provider = 'fitbit'`, [userId]);
  await execute(
    `INSERT INTO oauth_states (state, user_id, provider, code_verifier, expires_at, created_at)
     VALUES (?,?,'fitbit',?,?,?)`,
    [
      state,
      userId,
      verifier,
      new Date(Date.now() + 10 * 60_000).toISOString(),
      nowIso(),
    ],
  );

  const params = new URLSearchParams({
    client_id: process.env.FITBIT_CLIENT_ID!,
    response_type: "code",
    code_challenge: codeChallenge(verifier),
    code_challenge_method: "S256",
    scope: FITBIT_SCOPES.join(" "),
    redirect_uri: fitbitRedirectUri(origin),
    state,
  });

  return { url: `${AUTH_URL}?${params}`, state };
}

export type StateCheck =
  | { valid: true; userId: string; codeVerifier: string }
  | { valid: false; reason: "unknown" | "expired" };

/** Validates and consumes the state — single use, so a replayed callback fails. */
export async function consumeState(state: string): Promise<StateCheck> {
  const row = await queryOne<{
    state: string;
    user_id: string;
    code_verifier: string;
    expires_at: string;
  }>(`SELECT * FROM oauth_states WHERE state = ?`, [state]);

  if (!row || !safeEqual(row.state, state)) return { valid: false, reason: "unknown" };
  await execute(`DELETE FROM oauth_states WHERE state = ?`, [state]);

  if (new Date(row.expires_at).getTime() < Date.now()) return { valid: false, reason: "expired" };
  return { valid: true, userId: row.user_id, codeVerifier: row.code_verifier };
}

function basicAuth() {
  return Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`,
  ).toString("base64");
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  user_id: string;
}

/** Swaps the authorization code for tokens. */
export async function exchangeCode(code: string, verifier: string, origin: string) {
  const res = await fetch(`${apiBase()}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: fitbitRedirectUri(origin),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fitbit token exchange failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Refreshes an expired access token.
 *
 * Fitbit rotates the refresh token on every call, so the new pair is persisted
 * before returning — dropping it would permanently break the connection.
 */
export async function refreshTokens(conn: Connection): Promise<Connection | null> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: conn.refreshToken,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    // Fitbit unreachable or timed out. Treat it as a failed refresh so the
    // caller degrades to "reconnect" instead of a 500 — and crucially do NOT
    // clear the stored refresh token, since it may still be valid.
    const message = err instanceof Error ? err.message : "network error";
    await noteError(conn.userId, `Couldn't reach Fitbit: ${message}`);
    console.error("[vesper] fitbit refresh network failure:", message);
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    await noteError(conn.userId, `Refresh failed (${res.status}). Reconnect Fitbit.`);
    console.error("[vesper] fitbit refresh failed:", res.status, body.slice(0, 200));
    return null;
  }

  const json = (await res.json()) as TokenResponse;
  await saveConnection({
    userId: conn.userId,
    providerUserId: json.user_id ?? conn.providerUserId,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    scopes: json.scope ?? conn.scopes,
    expiresInSec: json.expires_in,
  });
  return getConnection(conn.userId);
}

/** Returns a connection with a valid access token, refreshing if needed. */
export async function ensureFreshToken(userId: string): Promise<Connection | null> {
  const conn = await getConnection(userId);
  if (!conn) return null;

  // Refresh a minute early to avoid racing the expiry.
  const expiresSoon = new Date(conn.expiresAt).getTime() - 60_000 < Date.now();
  return expiresSoon ? refreshTokens(conn) : conn;
}

/* ------------------------------- fetching ------------------------------- */

async function apiGet<T>(conn: Connection, path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${conn.accessToken}`, "Accept-Language": "en_US" },
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 429) {
    // Fitbit allows 150 requests/hour per user.
    const retry = res.headers.get("Retry-After") ?? "3600";
    throw new Error(`Fitbit rate limit reached. Retry in ${retry}s.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fitbit ${path} failed (${res.status}): ${body.slice(0, 160)}`);
  }
  return (await res.json()) as T;
}

/* Response shapes, per Fitbit's Web API docs. */

interface HrvResponse {
  hrv: { value: { dailyRmssd: number; deepRmssd: number }; dateTime: string }[];
}
interface HeartResponse {
  "activities-heart": {
    dateTime: string;
    value: { restingHeartRate?: number; heartRateZones?: unknown[] };
  }[];
  "activities-heart-intraday"?: {
    dataset: { time: string; value: number }[];
  };
}
interface SleepResponse {
  summary?: { totalMinutesAsleep?: number };
}
interface StepsResponse {
  "activities-steps": { dateTime: string; value: string }[];
}
interface BreathingResponse {
  br: { value: { breathingRate: number }; dateTime: string }[];
}

export interface FitbitSnapshot {
  date: string;
  hrv: number | null;
  restingHr: number | null;
  heartRate: number | null;
  respiration: number | null;
  sleepHours: number | null;
  steps: number | null;
  /** Intraday heart-rate samples, when the scope grants them. */
  intraday: { time: string; value: number }[];
}

/**
 * Pulls a day of metrics. Each endpoint is independent — a plan that doesn't
 * expose HRV shouldn't stop us reading heart rate, so failures degrade to null
 * rather than aborting the sync.
 */
export async function fetchDay(conn: Connection, date = "today"): Promise<FitbitSnapshot> {
  const settle = async <T>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (err) {
      console.warn("[vesper] fitbit partial fetch failure:", (err as Error).message);
      return null;
    }
  };

  const [hrv, heart, sleep, steps, breathing] = await Promise.all([
    settle(apiGet<HrvResponse>(conn, `/1/user/-/hrv/date/${date}.json`)),
    settle(apiGet<HeartResponse>(conn, `/1/user/-/activities/heart/date/${date}/1d/1min.json`)),
    settle(apiGet<SleepResponse>(conn, `/1.2/user/-/sleep/date/${date}.json`)),
    settle(apiGet<StepsResponse>(conn, `/1/user/-/activities/steps/date/${date}/1d.json`)),
    settle(apiGet<BreathingResponse>(conn, `/1/user/-/br/date/${date}.json`)),
  ]);

  const intraday = heart?.["activities-heart-intraday"]?.dataset ?? [];
  const latestHr = intraday.length ? intraday[intraday.length - 1].value : null;
  const stepsVal = steps?.["activities-steps"]?.[0]?.value;

  return {
    date,
    hrv: hrv?.hrv?.[0]?.value?.dailyRmssd ?? null,
    restingHr: heart?.["activities-heart"]?.[0]?.value?.restingHeartRate ?? null,
    heartRate: latestHr,
    respiration: breathing?.br?.[0]?.value?.breathingRate ?? null,
    sleepHours:
      sleep?.summary?.totalMinutesAsleep != null
        ? +(sleep.summary.totalMinutesAsleep / 60).toFixed(2)
        : null,
    steps: stepsVal != null ? Number(stepsVal) : null,
    intraday,
  };
}

export async function markSynced(userId: string) {
  await execute(
    `UPDATE oauth_connections SET last_sync_at = ?, last_error = NULL, updated_at = ?
     WHERE user_id = ? AND provider = 'fitbit'`,
    [nowIso(), nowIso(), userId],
  );
}

export async function recordSyncError(userId: string, message: string) {
  await noteError(userId, message);
}
