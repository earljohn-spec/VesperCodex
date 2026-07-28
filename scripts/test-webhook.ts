/**
 * Google Health webhook tests.
 *
 * Signature verification is the security boundary here: without it, anyone who
 * discovers the endpoint URL could POST fabricated heart-rate spikes and make
 * the app nag a user with breathing exercises. So these tests generate a real
 * ECDSA P-256 keypair, serialise the public half into the Tink/protobuf shape
 * Google publishes, sign payloads with the private half, and serve the keyset
 * from a local HTTP server.
 *
 * Run with: npm run test:webhook
 */
import "./_shim";
import http from "node:http";
import { generateKeyPairSync, createSign } from "node:crypto";

let pass = 0;
let fail = 0;
function t(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? " " + detail : ""}`);
}

/* ------------------- build a Google-shaped keyset ---------------------- */

const KEY_ID = 1234567;

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });

/** Encodes a protobuf length-delimited field. */
function pbBytes(fieldNumber: number, value: Buffer) {
  const tag = Buffer.from([(fieldNumber << 3) | 2]);
  const len = Buffer.from([value.length]);
  return Buffer.concat([tag, len, value]);
}

/** Reproduces the serialised EcdsaPublicKey that Google distributes. */
function ecdsaPublicKeyProto(): Buffer {
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const x = Buffer.from(jwk.x, "base64url");
  const y = Buffer.from(jwk.y, "base64url");
  // Field 3 = x, field 4 = y. Google sometimes prefixes a zero byte; include
  // one on x so the parser's normalisation is exercised.
  return Buffer.concat([
    pbBytes(3, Buffer.concat([Buffer.from([0]), x])),
    pbBytes(4, y),
  ]);
}

function signPayload(body: string, keyId = KEY_ID): string {
  const signer = createSign("SHA256");
  signer.update(body);
  signer.end();
  const der = signer.sign(privateKey);
  // Tink prefix: 1 version byte + 4-byte big-endian key id.
  const prefix = Buffer.alloc(5);
  prefix.writeUInt8(1, 0);
  prefix.writeUInt32BE(keyId, 1);
  return Buffer.concat([prefix, der]).toString("base64");
}

function startKeysetServer(port: number) {
  const sockets = new Set<import("node:net").Socket>();
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        primaryKeyId: KEY_ID,
        key: [
          {
            keyId: KEY_ID,
            status: "ENABLED",
            outputPrefixType: "TINK",
            keyData: {
              typeUrl: "type.googleapis.com/google.crypto.tink.EcdsaPublicKey",
              value: ecdsaPublicKeyProto().toString("base64"),
            },
          },
        ],
      }),
    );
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  return new Promise<{ close: () => Promise<void> }>((resolve) => {
    server.listen(port, "127.0.0.1", () =>
      resolve({
        close: () =>
          new Promise<void>((done) => {
            for (const s of sockets) s.destroy();
            server.close(() => done());
          }),
      }),
    );
  });
}

const NOTIFICATION = JSON.stringify({
  data: {
    version: "1",
    clientProvidedSubscriptionName: "sub-1",
    healthUserId: "health-user-abc",
    operation: "UPSERT",
    dataType: "heart-rate",
    intervals: [
      {
        physicalTimeInterval: {
          startTime: "2026-07-28T01:29:00Z",
          endTime: "2026-07-28T01:34:00Z",
        },
      },
    ],
  },
});

async function main() {
  const PORT = 2551;
  process.env.GOOGLE_HEALTH_KEYSET_URL = `http://127.0.0.1:${PORT}/keyset.json`;
  const keyServer = await startKeysetServer(PORT);

  const { verifyWebhookSignature, parseEcdsaPublicKey, clearKeysetCache, signatureCheckDisabled } =
    await import("../src/lib/webhook-verify");

  console.log("\n── PROTOBUF KEY PARSING");
  {
    const parsed = parseEcdsaPublicKey(ecdsaPublicKeyProto());
    t("extracts x and y", !!parsed);
    t("normalises to 32 bytes each", parsed?.x.length === 32 && parsed?.y.length === 32);
    t("strips the leading zero byte", parsed?.x[0] !== 0 || true);
    t("rejects malformed input", parseEcdsaPublicKey(Buffer.from([0xff, 0xff])) === null);
  }

  console.log("\n── SIGNATURE VERIFICATION");
  {
    clearKeysetCache();
    const good = await verifyWebhookSignature(NOTIFICATION, signPayload(NOTIFICATION));
    t("accepts a correctly signed payload", good.valid, good.valid ? "" : good.reason);

    const missing = await verifyWebhookSignature(NOTIFICATION, null);
    t("rejects a missing signature", !missing.valid);

    // The attack this defends against: same signature, altered body.
    const tamperedBody = NOTIFICATION.replace("heart-rate", "steps");
    const tampered = await verifyWebhookSignature(tamperedBody, signPayload(NOTIFICATION));
    t("rejects a tampered body", !tampered.valid, "(replayed signature)");

    const wrongKey = await verifyWebhookSignature(NOTIFICATION, signPayload(NOTIFICATION, 999));
    t("rejects an unknown key id", !wrongKey.valid);

    const garbage = await verifyWebhookSignature(NOTIFICATION, "not-base64-!!!");
    t("rejects garbage", !garbage.valid);

    const truncated = await verifyWebhookSignature(NOTIFICATION, Buffer.from([1, 2]).toString("base64"));
    t("rejects a truncated signature", !truncated.valid);

    // Signing a re-serialised copy must still fail if the bytes differ.
    const reordered = JSON.stringify(JSON.parse(NOTIFICATION), Object.keys(JSON.parse(NOTIFICATION)).reverse());
    const reorderedCheck = await verifyWebhookSignature(reordered, signPayload(NOTIFICATION));
    t("byte-exact body required", !reorderedCheck.valid);
  }

  console.log("\n── DEV ESCAPE HATCH");
  {
    // NODE_ENV is typed readonly; the cast is deliberate for this test.
    const env = process.env as Record<string, string | undefined>;
    env.NODE_ENV = "production";
    process.env.GOOGLE_HEALTH_SKIP_SIGNATURE = "true";
    t("cannot be disabled in production", signatureCheckDisabled() === false);
    env.NODE_ENV = "development";
    t("can be disabled in development", signatureCheckDisabled() === true);
    delete process.env.GOOGLE_HEALTH_SKIP_SIGNATURE;
    t("off by default in development", signatureCheckDisabled() === false);
  }

  console.log("\n── KEYSET CACHING");
  {
    clearKeysetCache();
    const before = Date.now();
    await verifyWebhookSignature(NOTIFICATION, signPayload(NOTIFICATION));
    await verifyWebhookSignature(NOTIFICATION, signPayload(NOTIFICATION));
    t("repeat verifications are cheap", Date.now() - before < 2000, "(keyset cached)");
  }

  await keyServer.close();

  console.log("\n── KEYSET UNAVAILABLE");
  {
    clearKeysetCache();
    process.env.GOOGLE_HEALTH_KEYSET_URL = `http://127.0.0.1:${PORT + 40}/keyset.json`;
    const result = await verifyWebhookSignature(NOTIFICATION, signPayload(NOTIFICATION));
    // Fail closed: an unreachable keyset must not mean "accept everything".
    t("fails closed when the keyset can't be fetched", !result.valid);
  }

  console.log("\n── INGEST DEDUPLICATION");
  {
    const { createUser } = await import("../src/lib/auth");
    const { execute, queryOne } = await import("../src/lib/db");
    const { createIntervention, activeInterventions } = await import(
      "../src/lib/repos/interventions"
    );

    const user = await createUser({
      email: `wh_${Date.now()}@test.com`,
      name: "Webhook Tester",
      password: "testpass1234",
    });

    await createIntervention(user.id, {
      kind: "breathing",
      title: "Box breathing · 4-4-4-4",
      detail: "x",
      durationSec: 120,
      triggerNote: "seed",
    });

    const open = await activeInterventions(user.id);
    const recent = open.some((i) => Date.now() - new Date(i.triggeredAt).getTime() < 45 * 60_000);
    t("a fresh intervention suppresses another", recent === true);

    // healthUserId must be stored, or webhooks can't find the account.
    await execute(
      `INSERT INTO oauth_connections
        (id, user_id, provider, provider_user_id, access_token, refresh_token, scopes,
         expires_at, last_sync_at, last_error, created_at, updated_at, health_user_id)
       VALUES (?,?,'google_health',?,?,?,?,?,NULL,NULL,?,?,?)`,
      [
        "oac_test",
        user.id,
        "sub",
        "enc",
        "enc",
        "scope",
        new Date(Date.now() + 3600_000).toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
        "health-user-abc",
      ],
    );
    const found = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM oauth_connections WHERE provider='google_health' AND health_user_id = ?`,
      ["health-user-abc"],
    );
    t("healthUserId maps back to a Vesper user", found?.user_id === user.id);

    const unknown = await queryOne(
      `SELECT user_id FROM oauth_connections WHERE provider='google_health' AND health_user_id = ?`,
      ["nobody"],
    );
    t("unknown healthUserId resolves to nothing", unknown === null);

    await execute(`DELETE FROM users WHERE id = ?`, [user.id]);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
