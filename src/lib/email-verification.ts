import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { execute, nowIso, queryOne } from "./db";
import { sendMail, emailVerificationTemplate } from "./mail";

/**
 * Email verification.
 *
 * **Soft by design.** Signing up gives you immediate access; the unverified
 * banner nudges rather than blocks. Two reasons:
 *
 * 1. This is a wellbeing app. Someone reaching for it at 2am should not hit a
 *    "check your inbox" wall before they can write anything down.
 * 2. A hard gate makes email deliverability a single point of failure for
 *    onboarding — one misconfigured SPF record and nobody can use the product.
 *
 * What verification *does* buy us: confidence that password reset can actually
 * reach the account, and a signal for filtering junk signups later. Anything
 * genuinely sensitive (changing an email, exporting data) should require the
 * password, which it already does.
 *
 * Tokens follow the same rules as password reset — only the SHA-256 is stored,
 * single-use, and issuing a new one voids the old.
 */

const TOKEN_TTL_HOURS = 48;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedVerification {
  token: string;
  expiresAt: string;
}

/**
 * Creates a verification token. `email` is captured alongside the user id so a
 * pending link is invalidated if the address changes before it's clicked.
 */
export async function issueVerificationToken(
  userId: string,
  email: string,
): Promise<IssuedVerification> {
  await execute(`DELETE FROM email_verification_tokens WHERE user_id = ?`, [userId]);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600_000).toISOString();

  await execute(
    `INSERT INTO email_verification_tokens (token_hash, user_id, email, expires_at, used_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
    [hashToken(token), userId, email.toLowerCase().trim(), expiresAt, nowIso()],
  );

  return { token, expiresAt };
}

export type VerificationCheck =
  | { valid: true; userId: string; email: string }
  | { valid: false; reason: "unknown" | "expired" | "used" | "stale" };

export async function verifyToken(token: string): Promise<VerificationCheck> {
  const row = await queryOne<{
    token_hash: string;
    user_id: string;
    email: string;
    expires_at: string;
    used_at: string | null;
  }>(`SELECT * FROM email_verification_tokens WHERE token_hash = ?`, [hashToken(token)]);

  if (!row) return { valid: false, reason: "unknown" };

  // Constant-time compare so lookup timing can't confirm a partial guess.
  const a = Buffer.from(row.token_hash, "hex");
  const b = Buffer.from(hashToken(token), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "unknown" };
  }

  if (row.used_at) return { valid: false, reason: "used" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }

  // The address changed after the link was sent — don't verify the new one on
  // the strength of a link mailed to the old.
  const user = await queryOne<{ email: string }>(`SELECT email FROM users WHERE id = ?`, [
    row.user_id,
  ]);
  if (!user || user.email !== row.email) return { valid: false, reason: "stale" };

  return { valid: true, userId: row.user_id, email: row.email };
}

export type VerifyOutcome =
  | { ok: true; userId: string; alreadyVerified: boolean }
  | { ok: false; reason: "unknown" | "expired" | "used" | "stale" };

/** Consumes the token and marks the address verified. */
export async function completeVerification(token: string): Promise<VerifyOutcome> {
  const check = await verifyToken(token);
  if (!check.valid) return { ok: false, reason: check.reason };

  const existing = await queryOne<{ email_verified_at: string | null }>(
    `SELECT email_verified_at FROM users WHERE id = ?`,
    [check.userId],
  );
  const alreadyVerified = !!existing?.email_verified_at;

  const ts = nowIso();
  await execute(`UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?`, [
    ts,
    ts,
    check.userId,
  ]);
  await execute(`UPDATE email_verification_tokens SET used_at = ? WHERE token_hash = ?`, [
    ts,
    hashToken(token),
  ]);

  return { ok: true, userId: check.userId, alreadyVerified };
}

export async function isVerified(userId: string): Promise<boolean> {
  const row = await queryOne<{ email_verified_at: string | null }>(
    `SELECT email_verified_at FROM users WHERE id = ?`,
    [userId],
  );
  return !!row?.email_verified_at;
}

/**
 * Issues a token and emails it. Returns the link only when no real mail
 * transport is configured, so dev works without a provider and production
 * can't leak it.
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  name: string,
  origin: string,
) {
  const { token } = await issueVerificationToken(userId, email);
  const link = `${origin}/verify-email?token=${token}`;
  const tpl = emailVerificationTemplate(link, name, TOKEN_TTL_HOURS);
  const result = await sendMail({ ...tpl, to: email }, link);

  return { delivered: result.ok, transport: result.transport, link: result.preview };
}

/** Housekeeping: drop spent or long-expired tokens. */
export async function pruneVerificationTokens() {
  await execute(
    `DELETE FROM email_verification_tokens WHERE used_at IS NOT NULL OR expires_at < ?`,
    [new Date(Date.now() - 7 * 86400_000).toISOString()],
  );
}

export const VERIFICATION_TTL_HOURS = TOKEN_TTL_HOURS;
