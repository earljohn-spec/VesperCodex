import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Authenticated encryption for secrets we must be able to read back —
 * currently OAuth access and refresh tokens.
 *
 * Passwords are hashed (one-way); these can't be, because we need to replay
 * them to Fitbit. AES-256-GCM gives confidentiality *and* integrity, so a
 * tampered ciphertext fails to decrypt rather than silently yielding garbage.
 *
 * A leaked database alone is then not enough to pull someone's heart-rate
 * history — an attacker also needs VESPER_ENCRYPTION_KEY from the environment.
 *
 * Format: `v1.<iv>.<authTag>.<ciphertext>`, all base64url.
 */

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the GCM standard

let cachedKey: Buffer | null = null;

/**
 * Derives a 32-byte key from VESPER_ENCRYPTION_KEY. Falls back to
 * VESPER_AUTH_SECRET so existing deployments keep working, with a distinct
 * salt so the two never produce the same key material.
 */
function key(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.VESPER_ENCRYPTION_KEY ?? process.env.VESPER_AUTH_SECRET;

  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "VESPER_ENCRYPTION_KEY must be set to at least 32 characters in production. " +
          "Generate one with:  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }
    // Development only — clearly not a secret.
    cachedKey = createHash("sha256").update("vesper-dev-encryption-key").digest();
    return cachedKey;
  }

  cachedKey = createHash("sha256").update(`vesper:token-encryption:${raw}`).digest();
  return cachedKey;
}

/** For tests that flip the environment between cases. */
export function resetKeyCache() {
  cachedKey = null;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(
    ".",
  );
}

export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed ciphertext");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Decrypts without throwing — returns null on tampering or a rotated key. */
export function tryDecrypt(payload: string): string | null {
  try {
    return decrypt(payload);
  } catch {
    return null;
  }
}

/* ------------------------------- PKCE ---------------------------------- */

/** RFC 7636 verifier: 43-128 chars of unreserved characters. */
export function createCodeVerifier(): string {
  return randomBytes(64).toString("base64url").slice(0, 128);
}

/** S256 challenge derived from the verifier. */
export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Constant-time string comparison for OAuth state values. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
