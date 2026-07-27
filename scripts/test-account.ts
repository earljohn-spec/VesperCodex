/**
 * Security tests for rate limiting, password reset, and account deletion.
 * Run with: npm run test
 *
 * Deliberately dependency-free — no jest/vitest to install or configure. Each
 * assertion prints, and a non-zero exit code fails CI.
 */
import "./_shim";

let pass = 0, fail = 0;
const t = (n: string, c: boolean, d = "") => {
  if (c) pass++;
  else fail++;
  console.log(`  ${c ? "✓" : "✗"} ${n} ${d}`);
};

async function main() {
  const { consume, reset, pruneRateLimits } = await import("../src/lib/rate-limit");
  const { issueResetToken, verifyResetToken, completeReset } = await import("../src/lib/password-reset");
  const { createUser, findUserByEmail, verifyPassword } = await import("../src/lib/auth");
  const { exportAccount, deleteAccount, accountExists } = await import("../src/lib/account");
  const { mapUser } = await import("../src/lib/auth");
  const { execute, queryOne, query } = await import("../src/lib/db");

  console.log("\n── RATE LIMITING");
  const id = "test_" + Date.now();
  let last;
  for (let i = 0; i < 8; i++) last = await consume("login", id);
  t("8 attempts allowed", last!.allowed, `remaining=${last!.remaining}`);
  const ninth = await consume("login", id);
  t("9th blocked", !ninth.allowed, `retryAfter=${ninth.retryAfter}s`);
  t("retryAfter is sane", ninth.retryAfter > 0 && ninth.retryAfter <= 900);
  await reset("login", id);
  t("reset clears counter", (await consume("login", id)).allowed);
  // window expiry
  const wid = "win_" + Date.now();
  await consume("login", wid, { limit: 2, windowSec: 1 });
  await consume("login", wid, { limit: 2, windowSec: 1 });
  t("over limit in window", !(await consume("login", wid, { limit: 2, windowSec: 1 })).allowed);
  await new Promise(r => setTimeout(r, 1100));
  t("allowed after window expires", (await consume("login", wid, { limit: 2, windowSec: 1 })).allowed);

  console.log("\n── PASSWORD RESET");
  const email = `reset_${Date.now()}@test.com`;
  const row = await createUser({ email, name: "Reset Tester", password: "originalpass123" });
  const { token } = await issueResetToken(row.id);
  t("token issued", token.length > 20);
  t("token verifies", (await verifyResetToken(token)).valid);
  t("garbage token rejected", !(await verifyResetToken("not-a-real-token")).valid);

  // raw token must NOT be in the DB
  const stored = await query<{ token_hash: string }>(`SELECT token_hash FROM password_reset_tokens WHERE user_id = ?`, [row.id]);
  t("raw token not stored", !stored.some(s => s.token_hash === token), "(only sha256)");

  // sessions get killed
  execute(`INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)`,
    ["sess_victim_" + Date.now(), row.id, new Date().toISOString(), new Date(Date.now()+86400000).toISOString()]);
  const before = (await queryOne<{c:number}>(`SELECT COUNT(*) c FROM sessions WHERE user_id=?`, [row.id]))!.c;
  const out = await completeReset(token, "brandnewpass456");
  t("reset succeeds", out.ok);
  const after = (await queryOne<{c:number}>(`SELECT COUNT(*) c FROM sessions WHERE user_id=?`, [row.id]))!.c;
  t("all sessions revoked", before > 0 && after === 0, `${before} -> ${after}`);

  const updated = (await findUserByEmail(email))!;
  t("new password works", verifyPassword("brandnewpass456", updated.password_hash));
  t("old password rejected", !verifyPassword("originalpass123", updated.password_hash));
  t("token single-use", !(await completeReset(token, "third-attempt-pass")).ok);

  // expiry
  const { token: t2 } = await issueResetToken(row.id);
  execute(`UPDATE password_reset_tokens SET expires_at = ? WHERE user_id = ?`,
    [new Date(Date.now() - 1000).toISOString(), row.id]);
  const expired = await verifyResetToken(t2);
  t("expired token rejected", !expired.valid && expired.reason === "expired");

  // reissue invalidates previous
  const { token: t3 } = await issueResetToken(row.id);
  const { token: t4 } = await issueResetToken(row.id);
  t("reissue voids the old token", !(await verifyResetToken(t3)).valid && (await verifyResetToken(t4)).valid);

  console.log("\n── EXPORT / DELETE");
  const u = mapUser((await findUserByEmail(email))!);
  execute(`INSERT INTO journal_entries (id,user_id,title,body,mood_score,energy_score,emotions,source,transcript_ms,entry_date,created_at,updated_at,synced) VALUES (?,?,?,?,?,?,?,?,NULL,?,?,?,1)`,
    ["jrn_x"+Date.now(), u.id, "t","b",7,7,"[]","text",new Date().toISOString(),new Date().toISOString(),new Date().toISOString()]);
  const bundle = await exportAccount(u);
  t("export includes entries", bundle.counts.journalEntries >= 1, `count=${bundle.counts.journalEntries}`);
  t("export has no password hash", !JSON.stringify(bundle).includes("scrypt:"));
  t("export is serialisable", typeof JSON.stringify(bundle) === "string");

  const report = await deleteAccount(u.id);
  t("delete reports counts", report.removed.journalEntries >= 1);
  t("account gone", !await accountExists(u.id));
  t("child rows gone", (await queryOne<{c:number}>(`SELECT COUNT(*) c FROM journal_entries WHERE user_id=?`, [u.id]))!.c === 0);
  t("tokens gone", (await queryOne<{c:number}>(`SELECT COUNT(*) c FROM password_reset_tokens WHERE user_id=?`, [u.id]))!.c === 0);

  await pruneRateLimits(0);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
