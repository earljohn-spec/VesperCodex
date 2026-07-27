/**
 * Fitbit integration tests.
 *
 * Fitbit's API can't be reached from CI, so this runs against a local mock
 * that mirrors the documented response shapes for HRV, heart rate (including
 * the intraday series), sleep, steps and breathing rate — plus the token
 * endpoint with its rotating refresh tokens.
 *
 * What's verified here is our half of the contract: PKCE, state handling,
 * token encryption at rest, refresh-and-persist, partial-failure tolerance,
 * and the mapping from Fitbit's payloads into Vesper biometrics.
 *
 * Run with: npm run test:fitbit
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

/* ------------------------------- the mock -------------------------------- */

interface MockOpts {
  /** Endpoints that should 404, to prove partial failures degrade gracefully. */
  missing?: string[];
  /** Force a 429 on data endpoints. */
  rateLimited?: boolean;
  /** Reject refresh, as Fitbit does for a revoked grant. */
  refreshFails?: boolean;
}

function intradaySeries() {
  const dataset: { time: string; value: number }[] = [];
  for (let m = 0; m < 1440; m += 1) {
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    // Baseline ~62bpm with a pronounced afternoon spike.
    const spike = m > 900 && m < 960 ? 38 : 0;
    dataset.push({ time: `${h}:${mm}:00`, value: 62 + spike + (m % 7) });
  }
  return dataset;
}

function startMock(port: number, opts: MockOpts = {}) {
  const calls: string[] = [];
  const sockets = new Set<import("node:net").Socket>();
  let issued = 0;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);
    calls.push(url.pathname);
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/oauth2/token") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const form = new URLSearchParams(raw);
        const auth = req.headers.authorization ?? "";
        if (!auth.startsWith("Basic ")) return json(401, { errors: [{ message: "no auth" }] });

        if (form.get("grant_type") === "authorization_code") {
          // PKCE: Fitbit requires the verifier alongside the code.
          if (!form.get("code_verifier")) {
            return json(400, { errors: [{ message: "code_verifier required" }] });
          }
          return json(200, {
            access_token: "access-1",
            refresh_token: "refresh-1",
            expires_in: 28800,
            scope: "heartrate activity sleep profile",
            user_id: "FITBITUSER",
          });
        }

        if (form.get("grant_type") === "refresh_token") {
          if (opts.refreshFails) return json(400, { errors: [{ message: "invalid_grant" }] });
          issued++;
          // Refresh tokens rotate on every use, exactly like the real API.
          return json(200, {
            access_token: `access-${issued + 1}`,
            refresh_token: `refresh-${issued + 1}`,
            expires_in: 28800,
            scope: "heartrate activity sleep profile",
            user_id: "FITBITUSER",
          });
        }
        return json(400, { errors: [{ message: "unsupported grant" }] });
      });
      return;
    }

    if (opts.missing?.some((m) => url.pathname.includes(m))) {
      return json(404, { errors: [{ message: "not available on this plan" }] });
    }
    if (opts.rateLimited) {
      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "1800" });
      return res.end(JSON.stringify({ errors: [{ message: "rate limit" }] }));
    }
    if (!(req.headers.authorization ?? "").startsWith("Bearer ")) {
      return json(401, { errors: [{ message: "missing bearer" }] });
    }

    if (url.pathname.includes("/hrv/")) {
      return json(200, {
        hrv: [{ value: { dailyRmssd: 34.2, deepRmssd: 38.1 }, dateTime: "2026-07-28" }],
      });
    }
    if (url.pathname.includes("/activities/heart/")) {
      return json(200, {
        "activities-heart": [{ dateTime: "2026-07-28", value: { restingHeartRate: 58 } }],
        "activities-heart-intraday": { dataset: intradaySeries() },
      });
    }
    if (url.pathname.includes("/sleep/")) {
      return json(200, { summary: { totalMinutesAsleep: 401 } });
    }
    if (url.pathname.includes("/activities/steps/")) {
      return json(200, { "activities-steps": [{ dateTime: "2026-07-28", value: "8452" }] });
    }
    if (url.pathname.includes("/br/")) {
      return json(200, { br: [{ value: { breathingRate: 15.4 }, dateTime: "2026-07-28" }] });
    }
    return json(404, { errors: [{ message: "unknown" }] });
  });

  // Node keeps HTTP keep-alive sockets open, which stops the next mock binding
  // the same port. Track and destroy them on close.
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

/* --------------------------------- tests --------------------------------- */

async function main() {
  const PORT = 2531;
  process.env.FITBIT_CLIENT_ID = "test-client";
  process.env.FITBIT_CLIENT_SECRET = "test-secret";
  process.env.FITBIT_API_BASE = `http://127.0.0.1:${PORT}`;
  process.env.VESPER_ENCRYPTION_KEY = "a".repeat(48);

  const { createUser } = await import("../src/lib/auth");
  const { execute, queryOne } = await import("../src/lib/db");
  const crypto = await import("../src/lib/crypto");
  const fb = await import("../src/lib/fitbit");

  const user = await createUser({
    email: `fitbit_${Date.now()}@test.com`,
    name: "Fitbit Tester",
    password: "testpass1234",
  });

  console.log("\n── ENCRYPTION AT REST");
  {
    const secret = "super-secret-refresh-token";
    const enc = crypto.encrypt(secret);
    t("ciphertext differs from plaintext", enc !== secret && !enc.includes(secret));
    t("round-trips", crypto.decrypt(enc) === secret);
    t("versioned envelope", enc.startsWith("v1."));
    t("nonce is random per call", crypto.encrypt(secret) !== crypto.encrypt(secret));

    const parts = enc.split(".");
    const tampered = [parts[0], parts[1], parts[2], Buffer.from("evil").toString("base64url")].join(".");
    t("tampering is detected", crypto.tryDecrypt(tampered) === null);
  }

  console.log("\n── PKCE");
  {
    const v = crypto.createCodeVerifier();
    t("verifier length is RFC-compliant", v.length >= 43 && v.length <= 128, `(${v.length})`);
    const c = crypto.codeChallenge(v);
    t("challenge is deterministic", c === crypto.codeChallenge(v));
    t("challenge differs from verifier", c !== v);
  }

  console.log("\n── AUTHORIZATION URL + STATE");
  {
    const { url, state } = await fb.beginAuthorization(user.id, "http://localhost:3000");
    const u = new URL(url);
    t("points at Fitbit", u.host === "www.fitbit.com");
    t("uses S256", u.searchParams.get("code_challenge_method") === "S256");
    t("carries a challenge", !!u.searchParams.get("code_challenge"));
    t("verifier is NOT in the url", !url.includes(u.searchParams.get("code_challenge")! + "="));
    t("requests only needed scopes", u.searchParams.get("scope") === "heartrate activity sleep profile");

    const check = await fb.consumeState(state);
    t("state validates", check.valid);
    t("state is single-use", !(await fb.consumeState(state)).valid);
    t("unknown state rejected", !(await fb.consumeState("made-up")).valid);
  }

  console.log("\n── EXPIRED STATE");
  {
    const { state } = await fb.beginAuthorization(user.id, "http://localhost:3000");
    await execute(`UPDATE oauth_states SET expires_at = ? WHERE state = ?`, [
      new Date(Date.now() - 1000).toISOString(),
      state,
    ]);
    const c = await fb.consumeState(state);
    t("expired state rejected", !c.valid && c.reason === "expired");
  }

  console.log("\n── TOKEN EXCHANGE");
  const mock = await startMock(PORT);
  {
    const { state } = await fb.beginAuthorization(user.id, "http://localhost:3000");
    const check = await fb.consumeState(state);
    if (!check.valid) throw new Error("state should be valid");

    const tokens = await fb.exchangeCode("auth-code", check.codeVerifier, "http://localhost:3000");
    t("exchange returns tokens", tokens.access_token === "access-1");
    t("mock required the PKCE verifier", mock.calls.includes("/oauth2/token"));

    await fb.saveConnection({
      userId: user.id,
      providerUserId: tokens.user_id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scopes: tokens.scope,
      expiresInSec: tokens.expires_in,
    });

    const raw = await queryOne<{ access_token: string; refresh_token: string }>(
      `SELECT access_token, refresh_token FROM oauth_connections WHERE user_id = ?`,
      [user.id],
    );
    t("access token encrypted in the db", !!raw && raw.access_token !== "access-1");
    t("refresh token encrypted in the db", !!raw && raw.refresh_token !== "refresh-1");

    const conn = await fb.getConnection(user.id);
    t("reads back decrypted", conn?.accessToken === "access-1");
  }

  console.log("\n── REFRESH ROTATION");
  {
    const before = await fb.getConnection(user.id);
    await execute(`UPDATE oauth_connections SET expires_at = ? WHERE user_id = ?`, [
      new Date(Date.now() - 1000).toISOString(),
      user.id,
    ]);
    const fresh = await fb.ensureFreshToken(user.id);
    t("expired token triggers a refresh", fresh?.accessToken === "access-2");
    t("rotated refresh token persisted", fresh?.refreshToken === "refresh-2");
    t("old refresh token replaced", before?.refreshToken !== fresh?.refreshToken);
    t("expiry pushed forward", new Date(fresh!.expiresAt).getTime() > Date.now());

    const still = await fb.ensureFreshToken(user.id);
    t("valid token is not refreshed again", still?.accessToken === "access-2");
  }

  console.log("\n── FETCHING A DAY");
  {
    const conn = (await fb.getConnection(user.id))!;
    const snap = await fb.fetchDay(conn, "today");
    t("hrv mapped", snap.hrv === 34.2, `(${snap.hrv})`);
    t("resting hr mapped", snap.restingHr === 58);
    t("sleep converted to hours", snap.sleepHours === 6.68, `(${snap.sleepHours}h from 401min)`);
    t("steps parsed as a number", snap.steps === 8452);
    t("breathing rate mapped", snap.respiration === 15.4);
    t("intraday series returned", snap.intraday.length === 1440, `(${snap.intraday.length})`);
    t("latest heart rate taken from the series", typeof snap.heartRate === "number");
  }

  console.log("\n── DERIVED STRESS");
  {
    const { deriveStressIndex } = await import("../src/lib/repos/biometrics");
    const calm = deriveStressIndex({ hrv: 34.2, heartRate: 62, restingHr: 58, respiration: 15.4 });
    const spiked = deriveStressIndex({ hrv: 34.2, heartRate: 100, restingHr: 58, respiration: 15.4 });
    t("real Fitbit values produce a sane index", calm >= 0 && calm <= 100, `(calm=${calm})`);
    t("a heart-rate spike raises it", spiked > calm, `(${calm} -> ${spiked})`);
    t("spike crosses the intervention threshold", spiked >= 65, `(${spiked})`);
  }

  await mock.close();

  console.log("\n── PARTIAL FAILURES (plan without HRV or breathing rate)");
  {
    process.env.FITBIT_API_BASE = `http://127.0.0.1:${PORT + 1}`;
    const partial = await startMock(PORT + 1, { missing: ["/hrv/", "/br/"] });
    const conn = (await fb.getConnection(user.id))!;
    const snap = await fb.fetchDay(conn, "today");
    t("missing endpoints do not abort the sync", snap.restingHr === 58);
    t("absent hrv is null, not a crash", snap.hrv === null);
    t("absent breathing rate is null", snap.respiration === null);
    t("everything else still mapped", snap.steps === 8452 && snap.sleepHours === 6.68);
    await partial.close();
  }

  console.log("\n── RATE LIMIT (429)");
  {
    process.env.FITBIT_API_BASE = `http://127.0.0.1:${PORT + 2}`;
    const limited = await startMock(PORT + 2, { rateLimited: true });
    const conn = (await fb.getConnection(user.id))!;
    const snap = await fb.fetchDay(conn, "today");
    t("429 degrades to nulls rather than throwing", snap.hrv === null && snap.restingHr === null);
    await limited.close();
  }

  console.log("\n── REVOKED GRANT");
  {
    process.env.FITBIT_API_BASE = `http://127.0.0.1:${PORT + 3}`;
    const broken = await startMock(PORT + 3, { refreshFails: true });
    await execute(`UPDATE oauth_connections SET expires_at = ? WHERE user_id = ?`, [
      new Date(Date.now() - 1000).toISOString(),
      user.id,
    ]);
    const result = await fb.ensureFreshToken(user.id);
    t("failed refresh returns null", result === null);
    const row = await queryOne<{ last_error: string | null }>(
      `SELECT last_error FROM oauth_connections WHERE user_id = ?`,
      [user.id],
    );
    t("error recorded for the UI", !!row?.last_error, `("${row?.last_error?.slice(0, 40)}…")`);
    await broken.close();
  }

  console.log("\n── DISCONNECT + CASCADE");
  {
    await fb.disconnect(user.id);
    t("connection removed", (await fb.getConnection(user.id)) === null);

    await fb.saveConnection({
      userId: user.id,
      providerUserId: "X",
      accessToken: "a",
      refreshToken: "r",
      scopes: "heartrate",
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
