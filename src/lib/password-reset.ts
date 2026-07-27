import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { execute, nowIso, queryOne } from "./db";
import { hashPassword } from "./auth";

/**
 * Password reset tokens.
 *
 * The raw token only ever exists in the reset link. What we persist is its
 * SHA-256, so a database leak yields nothing an attacker can redeem. Tokens
 * are single-use, expire in an hour, and issuing a new one invalidates any
 * outstanding ones for that account.
 */

const TOKEN_TTL_MIN = 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedToken {
  token: string;
  expiresAt: string;
}

/** Creates a reset token for a user. Caller is responsible for delivering it. */
export async function issueResetToken(userId: string): Promise<IssuedToken> {
  // Any previously issued token becomes void.
  await execute(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [userId]);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60_000).toISOString();

  await execute(
    `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, used_at, created_at)
     VALUES (?, ?, ?, NULL, ?)`,
    [hashToken(token), userId, expiresAt, nowIso()],
  );

  return { token, expiresAt };
}

export type TokenCheck =
  | { valid: true; userId: string }
  | { valid: false; reason: "unknown" | "expired" | "used" };

export async function verifyResetToken(token: string): Promise<TokenCheck> {
  const row = await queryOne<{
    token_hash: string;
    user_id: string;
    expires_at: string;
    used_at: string | null;
  }>(`SELECT * FROM password_reset_tokens WHERE token_hash = ?`, [hashToken(token)]);

  if (!row) return { valid: false, reason: "unknown" };

  // Constant-time compare on the hash, so lookup timing can't be used to
  // confirm a partial guess.
  const a = Buffer.from(row.token_hash, "hex");
  const b = Buffer.from(hashToken(token), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "unknown" };
  }

  if (row.used_at) return { valid: false, reason: "used" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, userId: row.user_id };
}

export type ResetOutcome =
  | { ok: true; userId: string }
  | { ok: false; reason: "unknown" | "expired" | "used" };

/**
 * Consumes the token, sets the new password, and signs out every existing
 * session — if the account was compromised, the attacker loses access too.
 */
export async function completeReset(token: string, newPassword: string): Promise<ResetOutcome> {
  const check = await verifyResetToken(token);
  if (!check.valid) return { ok: false, reason: check.reason };

  const ts = nowIso();
  await execute(
    `UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?`,
    [hashPassword(newPassword), ts, ts, check.userId],
  );
  await execute(`UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?`, [
    ts,
    hashToken(token),
  ]);
  await execute(`DELETE FROM sessions WHERE user_id = ?`, [check.userId]);

  return { ok: true, userId: check.userId };
}

/** Housekeeping: drop tokens that are spent or long expired. */
export async function pruneResetTokens() {
  await execute(
    `DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at < ?`,
    [new Date(Date.now() - 24 * 3600_000).toISOString()],
  );
}

/**
 * Delivers the reset link.
 *
 * No mail provider is wired up, so in development the link is logged to the
 * server console — which is enough to exercise the whole flow end to end.
 * Swap the body of this function for Resend/SES/Postmark in production.
 */
export async function deliverResetEmail(email: string, token: string, origin: string) {
  const link = `${origin}/reset-password?token=${token}`;

  if (process.env.VESPER_SMTP_URL || process.env.VESPER_MAIL_API_KEY) {
    // Placeholder for a real provider integration.
    console.warn("[vesper] mail provider configured but not implemented; logging link instead");
  }

  console.info(
    `\n──────────────────────────────────────────────────────────────\n` +
      `  Password reset requested for ${email}\n` +
      `  ${link}\n` +
      `  (expires in ${TOKEN_TTL_MIN} minutes)\n` +
      `──────────────────────────────────────────────────────────────\n`,
  );

  return { delivered: true as const, link };
}

export const RESET_TOKEN_TTL_MIN = TOKEN_TTL_MIN;
