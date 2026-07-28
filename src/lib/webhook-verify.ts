import "server-only";
import { createPublicKey, createVerify } from "node:crypto";

/**
 * Verifies Google Health API webhook signatures.
 *
 * Google signs the raw JSON body with Tink's PublicKeySign and puts a
 * Base64 signature in `GOOGLE-HEALTH-API-SIGNATURE`. Tink's own library is a
 * heavy dependency for one verification, so this implements the documented
 * manual path instead:
 *
 *   1. Base64-decode the header → 5-byte Tink prefix (1 version + 4 keyId)
 *      followed by a DER-encoded ECDSA signature.
 *   2. Fetch the public keyset and find the key matching that keyId.
 *   3. Its `value` is a serialised EcdsaPublicKey protobuf; pull the x and y
 *      coordinates out (fields 3 and 4).
 *   4. Rebuild a P-256 public key and verify the body with ECDSA-SHA256.
 *
 * Without this, anyone who learns the endpoint URL could POST fabricated
 * heart-rate spikes and make the app nag a user with breathing exercises.
 */

const KEYSET_URL =
  process.env.GOOGLE_HEALTH_KEYSET_URL ??
  "https://www.gstatic.com/googlehealthapi/webhooks/webhooks_public_keyset.json";

/** Keys rotate every 30 days; cache for an hour to avoid a fetch per request. */
const CACHE_TTL_MS = 60 * 60 * 1000;

interface KeysetEntry {
  keyData?: { value?: string; typeUrl?: string };
  keyId?: number;
  status?: string;
  outputPrefixType?: string;
}
interface Keyset {
  key?: KeysetEntry[];
  primaryKeyId?: number;
}

let cache: { keyset: Keyset; fetchedAt: number } | null = null;

export function clearKeysetCache() {
  cache = null;
}

async function getKeyset(): Promise<Keyset> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.keyset;

  const res = await fetch(KEYSET_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Could not fetch Google Health keyset (${res.status})`);

  const keyset = (await res.json()) as Keyset;
  cache = { keyset, fetchedAt: Date.now() };
  return keyset;
}

/* --------------------------- protobuf parsing --------------------------- */

/** Minimal varint reader — enough for the two length-delimited fields we need. */
function readVarint(buf: Buffer, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return [result, pos];
}

/**
 * Extracts x (field 3) and y (field 4) from a serialised EcdsaPublicKey.
 * Both are big-endian integers, sometimes with a leading zero byte that has
 * to be stripped to land on exactly 32 bytes for P-256.
 */
export function parseEcdsaPublicKey(der: Buffer): { x: Buffer; y: Buffer } | null {
  let pos = 0;
  let x: Buffer | null = null;
  let y: Buffer | null = null;

  while (pos < der.length) {
    const [tag, afterTag] = readVarint(der, pos);
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;
    pos = afterTag;

    if (wireType === 2) {
      const [len, afterLen] = readVarint(der, pos);
      const value = der.subarray(afterLen, afterLen + len);
      pos = afterLen + len;
      if (fieldNumber === 3) x = value;
      else if (fieldNumber === 4) y = value;
    } else if (wireType === 0) {
      const [, next] = readVarint(der, pos);
      pos = next;
    } else {
      return null; // unexpected encoding
    }
  }

  if (!x || !y) return null;

  const norm = (b: Buffer) => {
    let v = b;
    while (v.length > 32 && v[0] === 0) v = v.subarray(1);
    if (v.length < 32) v = Buffer.concat([Buffer.alloc(32 - v.length), v]);
    return v.length === 32 ? v : null;
  };

  const nx = norm(x);
  const ny = norm(y);
  return nx && ny ? { x: nx, y: ny } : null;
}

/** Wraps raw P-256 coordinates in the SPKI DER envelope Node expects. */
function spkiFromCoordinates(x: Buffer, y: Buffer): Buffer {
  const prefix = Buffer.from(
    "3059301306072a8648ce3d020106082a8648ce3d030107034200",
    "hex",
  );
  return Buffer.concat([prefix, Buffer.from([0x04]), x, y]);
}

/* ------------------------------ verification ---------------------------- */

export type VerifyResult =
  | { valid: true; keyId: number }
  | { valid: false; reason: string };

/**
 * @param rawBody the exact bytes received — re-serialising the parsed JSON
 *                would change key order or spacing and break the signature.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<VerifyResult> {
  if (!signatureHeader) return { valid: false, reason: "missing signature header" };

  let signed: Buffer;
  try {
    signed = Buffer.from(signatureHeader, "base64");
  } catch {
    return { valid: false, reason: "signature is not valid base64" };
  }
  if (signed.length < 6) return { valid: false, reason: "signature too short" };

  // Tink prefix: 1 version byte + 4-byte big-endian key id.
  const keyId = signed.readUInt32BE(1);
  const derSignature = signed.subarray(5);

  let keyset: Keyset;
  try {
    keyset = await getKeyset();
  } catch (err) {
    return { valid: false, reason: (err as Error).message };
  }

  const entry = keyset.key?.find((k) => k.keyId === keyId);
  if (!entry?.keyData?.value) return { valid: false, reason: `unknown key id ${keyId}` };

  const coords = parseEcdsaPublicKey(Buffer.from(entry.keyData.value, "base64"));
  if (!coords) return { valid: false, reason: "could not parse public key" };

  try {
    const key = createPublicKey({
      key: spkiFromCoordinates(coords.x, coords.y),
      format: "der",
      type: "spki",
    });
    const verifier = createVerify("SHA256");
    verifier.update(rawBody);
    verifier.end();
    const ok = verifier.verify(key, derSignature);
    return ok ? { valid: true, keyId } : { valid: false, reason: "signature mismatch" };
  } catch (err) {
    return { valid: false, reason: `verification error: ${(err as Error).message}` };
  }
}

/**
 * Escape hatch for local development, where signatures can't be produced.
 * Refuses to engage in production so a stray env var can't disable auth.
 */
export function signatureCheckDisabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.GOOGLE_HEALTH_SKIP_SIGNATURE === "true"
  );
}
