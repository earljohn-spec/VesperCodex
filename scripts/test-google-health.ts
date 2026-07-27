/**
 * Google Health API integration tests.
 *
 * Google's API isn't reachable from CI, so this runs against a local mock that
 * mirrors the documented v4 shapes: `users/me/dataTypes/{type}/dataPoints`
 * returning `{ dataPoints: [...] }`, plus Google's OAuth token endpoint.
 *
 * The Google-specific behaviour worth pinning down, and what we assert:
 * - Refresh tokens do NOT rotate; the refresh response usually omits one, so
 *   the stored value must survive a refresh.
 * - `access_type=offline` and `prompt=consent` are required or Google issues
 *   no refresh token at all after the first-ever authorisation.
 * - All scopes are Restricted, so scope strings must be exact.
 *
 * Run with: npm run test:googlehealth
 */
import "./_shim";
import http from "node:http";

let pass = 0;
let fail = 0;
function t(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? " " + detail : ""}`);
}

function idToken(sub: string) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "RS256" })}.${b64({ sub })}.signature`;
}

interface MockOpts {
  missing?: string[];
  rateLimited?: boolean;
  refreshFails?: boolean;
  /** Mirrors Google omitting refresh_token on refresh. */
  omitRefreshOnRefresh?: boolean;
}

function heartRatePoints() {
  const dataPoints = [];
  for (let m = 0; m < 1440; m += 5) {
    const d = new Date(Date.UTC(2026, 6, 28, Math.floor(m / 60), m % 60, 0));
    dataPoints.push({
      sampleTime: { physicalTime: d.toISOString() },
      heartRate: { beatsPerMinute: 62 + (m > 900 && m < 960 ? 38 : 0) + (m % 7) },
    });
  }
  return dataPoints;
}

function startMock(port: number, opts: MockOpts = {}) {
  const calls: string[] = [];
  const sockets = new Set<import("node:net").Socket>();
  let issued = 0;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);
    calls.push(url.pathname + url.search);
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/token") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const form = new URLSearchParams(raw);
        if (!form.get("client_id") || !form.get("client_secret")) {
          return json(401, { error: "invalid_client" });
        }
        if (form.get("grant_type") === "authorization_code") {
          if (!form.get("code_verifier")) return json(400, { error: "code_verifier required" });
          return json(200, {
            access_token: "access-1",
            refresh_token: "refresh-1",
            expires_in: 3599,
            scope: "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
            id_token: idToken("google-sub-123"),
          });
        }
        if (form.get("grant_type") === "refresh_token") {
          if (opts.refreshFails) return json(400, { error: "invalid_grant" });
          issued++;
          const body: Record<string, unknown> = {
            access_token: `access-${issued + 1}`,
            expires_in: 3599,
            scope: "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
          };
          // Google normally omits refresh_token here.
          if (!opts.omitRefreshOnRefresh) body.refresh_token = "refresh-1";
          return json(200, body);
        }
        return json(400, { error: "unsupported_grant_type" });
      });
      return;
    }

    if (opts.missing?.some((m) => url.pathname.includes(m))) {
      return json(403, { error: { message: "scope not granted" } });
    }
    if (opts.rateLimited) {
      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "1800" });
      return res.end(JSON.stringify({ error: { message: "quota exceeded" } }));
    }
    if (!(req.headers.authorization ?? "").startsWith("Bearer ")) {
      return json(401, { error: { message: "missing bearer" } });
    }

    if (url.pathname.includes("daily-heart-rate-variability")) {
      return json(200, {
        dataPoints: [{ dailyHeartRateVariability: { rmssdMilliseconds: 34.2 } }],
      });
    }
    if (url.pathname.includes("daily-resting-heart-rate")) {
      return json(200, { dataPoints: [{ dailyRestingHeartRate: { beatsPerMinute: 58 } }] });
    }
    if (url.pathname.includes("daily-respiratory-rate")) {
      return json(200, { dataPoints: [{ dailyRespiratoryRate: { breathsPerMinute: 15.4 } }] });
    }
    if (url.pathname.includes("dataTypes/heart-rate")) {
      return json(200, { dataPoints: heartRatePoints() });
    }
    if (url.pathname.includes("dataTypes/steps")) {
      return json(200, {
        dataPoints: [{ steps: { count: 4200 } }, { steps: { count: 4252 } }],
      });
    }
    if (url.pathname.includes("dataTypes/sleep")) {
      return json(200, { dataPoints: [{ sleep: { totalSleepMillis: "24060000" } }] });
    }
    return json(404, { error: { message: "unknown data type" } });
  });

  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });

  return new Promise<{ calls: string[]; close: () => Promise<void> }>((resolve) => {
    server.listen(port, "127.0.0.1", () =>
      resolve({
        calls,
        close: () =>
          new Promise<void>((done) => {
            for (const s of sockets) s.destroy();
            server.close(() => done());
          }),
      }),
    );
  });
}

async function main() {
  const PORT = 2541;
  process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_HEALTH_API_BASE = `http://127.0.0.1:${PORT}`;
  process.env.GOOGLE_OAUTH_TOKEN_URL = `http://127.0.0.1:${PORT}/token`;
  process.env.VESPER_ENCRYPTION_KEY = "a".repeat(48);

  const { createUser } = await import("../src/lib/auth");
  const { execute, queryOne } = await import("../src/lib/db");
  const gh = await import("../src/lib/google-health");

  const user = await createUser({
    email: `gh_${Date.now()}@test.com`,
    name: "Health Tester",
    password: "testpass1234",
  });

  console.log("\n── AUTHORIZATION URL");
  {
    const { url, state } = await gh.beginAuthorization(user.id, "http://localhost:3000");
    const u = new URL(url);
    t("points at Google, not Fitbit", u.host === "accounts.google.com");
    t("uses PKCE S256", u.searchParams.get("code_challenge_method") === "S256");
    // Without these two Google issues no refresh token, which silently breaks
    // syncing an hour after connecting.
    t("requests offline access", u.searchParams.get("access_type") === "offline");
    t("forces the consent screen", u.searchParams.get("prompt") === "consent");

    const scopes = (u.searchParams.get("scope") ?? "").split(" ");
    t("asks for health metrics scope", scopes.some((s) => s.includes("health_metrics_and_measurements.readonly")));
    t("asks for activity scope", scopes.some((s) => s.includes("activity_and_fitness.readonly")));
    t("asks for sleep scope", scopes.some((s) => s.includes("sleep.readonly")));
    t("does not request write scopes", !scopes.some((s) => s.includes("writeonly")));

    const check = await gh.consumeState(state);
    t("state validates", check.valid);
    t("state is single-use", !(await gh.consumeState(state)).valid);
  }

  const mock = await startMock(PORT);

  console.log("\n── TOKEN EXCHANGE");
  {
    const { state } = await gh.beginAuthorization(user.id, "http://localhost:3000");
    const check = await gh.consumeState(state);
    if (!check.valid) throw new Error("state should be valid");

    const tokens = await gh.exchangeCode("auth-code", check.codeVerifier, "http://localhost:3000");
    t("exchange returns an access token", tokens.access_token === "access-1");
    t("refresh token returned on first consent", tokens.refresh_token === "refresh-1");
    t("subject parsed from the id_token", tokens.sub === "google-sub-123");

    await gh.saveConnection({
      userId: user.id,
      providerUserId: tokens.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scopes: tokens.scope,
      expiresInSec: tokens.expires_in,
    });

    const raw = await queryOne<{ access_token: string; refresh_token: string }>(
      `SELECT access_token, refresh_token FROM oauth_connections WHERE user_id = ?`,
      [user.id],
    );
    t("access token encrypted at rest", !!raw && raw.access_token.startsWith("v1."));
    t("refresh token encrypted at rest", !!raw && !raw.refresh_token.includes("refresh-1"));
    t("reads back decrypted", (await gh.getConnection(user.id))?.accessToken === "access-1");
  }

  console.log("\n── REFRESH (Google does not rotate refresh tokens)");
  {
    await execute(`UPDATE oauth_connections SET expires_at = ? WHERE user_id = ?`, [
      new Date(Date.now() - 1000).toISOString(),
      user.id,
    ]);
    const fresh = await gh.ensureFreshToken(user.id);
    t("expired token triggers a refresh", fresh?.accessToken === "access-2");
    t("refresh token preserved", fresh?.refreshToken === "refresh-1");
    t("expiry pushed forward", new Date(fresh!.expiresAt).getTime() > Date.now());
    t("valid token is not refreshed again", (await gh.ensureFreshToken(user.id))?.accessToken === "access-2");
  }
  await mock.close();

  console.log("\n── REFRESH WHEN GOOGLE OMITS refresh_token");
  {
    process.env.GOOGLE_HEALTH_API_BASE = `http://127.0.0.1:${PORT + 1}`;
    process.env.GOOGLE_OAUTH_TOKEN_URL = `http://127.0.0.1:${PORT + 1}/token`;
    const m2 = await startMock(PORT + 1, { omitRefreshOnRefresh: true });
    await execute(`UPDATE oauth_connections SET expires_at = ? WHERE user_id = ?`, [
      new Date(Date.now() - 1000).toISOString(),
      user.id,
    ]);
    const fresh = await gh.ensureFreshToken(user.id);
    // This is the bug that would strand a user an hour after connecting.
    t("stored refresh token survives", fresh?.refreshToken === "refresh-1");
    t("new access token applied", !!fresh?.accessToken.startsWith("access-"));
    await m2.close();
  }

  console.log("\n── FETCHING A DAY");
  {
    process.env.GOOGLE_HEALTH_API_BASE = `http://127.0.0.1:${PORT + 2}`;
    process.env.GOOGLE_OAUTH_TOKEN_URL = `http://127.0.0.1:${PORT + 2}/token`;
    const m3 = await startMock(PORT + 2);
    const conn = (await gh.getConnection(user.id))!;
    const snap = await gh.fetchDay(conn, new Date(Date.UTC(2026, 6, 28, 12)));

    t("hrv mapped from rmssdMilliseconds", snap.hrv === 34.2, `(${snap.hrv})`);
    t("resting hr mapped", snap.restingHr === 58);
    t("respiratory rate mapped", snap.respiration === 15.4);
    t("sleep millis converted to hours", snap.sleepHours === 6.68, `(${snap.sleepHours}h)`);
    t("steps summed across data points", snap.steps === 8452, `(${snap.steps})`);
    t("intraday series parsed", snap.intraday.length === 288, `(${snap.intraday.length} @5min)`);
    t("latest heart rate taken from the series", typeof snap.heartRate === "number");
    t("filter uses RFC-3339 bounds", m3.calls.some((c) => c.includes("start_time")));
    await m3.close();
  }

  console.log("\n── DERIVED STRESS FROM REAL SHAPES");
  {
    const { deriveStressIndex } = await import("../src/lib/repos/biometrics");
    const calm = deriveStressIndex({ hrv: 34.2, heartRate: 62, restingHr: 58, respiration: 15.4 });
    const spiked = deriveStressIndex({ hrv: 34.2, heartRate: 100, restingHr: 58, respiration: 15.4 });
    t("produces a sane index", calm >= 0 && calm <= 100, `(calm=${calm})`);
    t("a heart-rate spike raises it", spiked > calm, `(${calm} -> ${spiked})`);
    t("spike crosses the intervention threshold", spiked >= 65, `(${spiked})`);
  }

  console.log("\n── PARTIAL CONSENT (sleep scope declined)");
  {
    process.env.GOOGLE_HEALTH_API_BASE = `http://127.0.0.1:${PORT + 3}`;
    const m4 = await startMock(PORT + 3, { missing: ["dataTypes/sleep", "daily-respiratory-rate"] });
    const conn = (await gh.getConnection(user.id))!;
    const snap = await gh.fetchDay(conn, new Date(Date.UTC(2026, 6, 28, 12)));
    t("declined scopes don't abort the sync", snap.restingHr === 58);
    t("absent sleep is null", snap.sleepHours === null);
    t("absent respiration is null", snap.respiration === null);
    t("everything else still mapped", snap.hrv === 34.2 && snap.steps === 8452);
    await m4.close();
  }

  console.log("\n── RATE LIMIT (429)");
  {
    process.env.GOOGLE_HEALTH_API_BASE = `http://127.0.0.1:${PORT + 4}`;
    const m5 = await startMock(PORT + 4, { rateLimited: true });
    const conn = (await gh.getConnection(user.id))!;
    const snap = await gh.fetchDay(conn, new Date(Date.UTC(2026, 6, 28, 12)));
    t("429 degrades to nulls rather than throwing", snap.hrv === null && snap.restingHr === null);
    await m5.close();
  }

  console.log("\n── REVOKED GRANT");
  {
    process.env.GOOGLE_OAUTH_TOKEN_URL = `http://127.0.0.1:${PORT + 5}/token`;
    const m6 = await startMock(PORT + 5, { refreshFails: true });
    await execute(`UPDATE oauth_connections SET expires_at = ? WHERE user_id = ?`, [
      new Date(Date.now() - 1000).toISOString(),
      user.id,
    ]);
    t("failed refresh returns null", (await gh.ensureFreshToken(user.id)) === null);
    const row = await queryOne<{ last_error: string | null }>(
      `SELECT last_error FROM oauth_connections WHERE user_id = ?`,
      [user.id],
    );
    t("error recorded for the UI", !!row?.last_error, `("${row?.last_error?.slice(0, 40)}…")`);
    await m6.close();
  }

  console.log("\n── UNREACHABLE SERVER");
  {
    process.env.GOOGLE_OAUTH_TOKEN_URL = `http://127.0.0.1:${PORT + 9}/token`;
    await execute(`UPDATE oauth_connections SET expires_at = ? WHERE user_id = ?`, [
      new Date(Date.now() - 1000).toISOString(),
      user.id,
    ]);
    const result = await gh.ensureFreshToken(user.id);
    t("network failure returns null, not a throw", result === null);
    const raw = await queryOne<{ refresh_token: string }>(
      `SELECT refresh_token FROM oauth_connections WHERE user_id = ?`,
      [user.id],
    );
    // Discarding it here would turn a transient outage into a permanent break.
    t("refresh token NOT discarded on a network blip", !!raw?.refresh_token);
  }

  console.log("\n── DISCONNECT + CASCADE");
  {
    await gh.disconnect(user.id);
    t("connection removed", (await gh.getConnection(user.id)) === null);

    await gh.saveConnection({
      userId: user.id,
      providerUserId: "sub",
      accessToken: "a",
      refreshToken: "r",
      scopes: "x",
      expiresInSec: 3600,
    });
    await execute(`DELETE FROM users WHERE id = ?`, [user.id]);
    const orphan = await queryOne<{ c: number }>(
      `SELECT COUNT(*) c FROM oauth_connections WHERE user_id = ?`,
      [user.id],
    );
    t("tokens cascade on account delete", Number(orphan?.c ?? 0) === 0);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
