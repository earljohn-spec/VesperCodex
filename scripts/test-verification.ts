/**
 * Email-verification tests, including real delivery over SMTP.
 *
 * Run with: npm run test:verify
 */
import "./_shim";
import { SMTPServer } from "smtp-server";

let pass = 0;
let fail = 0;
function t(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? " " + detail : ""}`);
}

function decode(raw: string) {
  return raw
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

async function main() {
  const PORT = 2528;
  const inbox: string[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, _s, cb) {
      let d = "";
      stream.on("data", (c) => (d += c));
      stream.on("end", () => {
        inbox.push(d);
        cb();
      });
    },
  });
  await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", () => r()));
  process.env.SMTP_URL = `smtp://127.0.0.1:${PORT}`;
  process.env.MAIL_FROM = "Vesper <no-reply@vesper.test>";

  const { createUser, findUserById } = await import("../src/lib/auth");
  const {
    issueVerificationToken,
    verifyToken,
    completeVerification,
    isVerified,
    sendVerificationEmail,
    pruneVerificationTokens,
  } = await import("../src/lib/email-verification");
  const { execute, queryOne, query } = await import("../src/lib/db");

  const email = `verify_${Date.now()}@test.com`;
  const user = await createUser({ email, name: "Vera Tester", password: "initialpass1" });

  console.log("\n── DEFAULT STATE");
  t("new account starts unverified", (await isVerified(user.id)) === false);
  t("emailVerifiedAt null on the row", user.email_verified_at == null);

  console.log("\n── TOKEN LIFECYCLE");
  const { token } = await issueVerificationToken(user.id, email);
  t("token issued", token.length > 20);
  const chk = await verifyToken(token);
  t("token verifies", chk.valid);
  t("garbage token rejected", !(await verifyToken("nonsense")).valid);

  const stored = await query<{ token_hash: string }>(
    `SELECT token_hash FROM email_verification_tokens WHERE user_id = ?`,
    [user.id],
  );
  t("raw token never stored", !stored.some((r) => r.token_hash === token), "(sha256 only)");

  console.log("\n── REDEMPTION");
  const done = await completeVerification(token);
  t("verification succeeds", done.ok);
  t("not flagged as already-verified", done.ok && done.alreadyVerified === false);
  t("user now verified", (await isVerified(user.id)) === true);
  t("token is single-use", !(await completeVerification(token)).ok);

  const second = await issueVerificationToken(user.id, email);
  const again = await completeVerification(second.token);
  t("re-verifying reports already-verified", again.ok && again.alreadyVerified === true);

  console.log("\n── EXPIRY + REISSUE");
  const { token: t1 } = await issueVerificationToken(user.id, email);
  await execute(`UPDATE email_verification_tokens SET expires_at = ? WHERE user_id = ?`, [
    new Date(Date.now() - 1000).toISOString(),
    user.id,
  ]);
  const exp = await verifyToken(t1);
  t("expired token rejected", !exp.valid && exp.reason === "expired");

  const { token: t2 } = await issueVerificationToken(user.id, email);
  const { token: t3 } = await issueVerificationToken(user.id, email);
  t("reissue voids the previous token", !(await verifyToken(t2)).valid && (await verifyToken(t3)).valid);

  console.log("\n── STALE ADDRESS (link mailed to an old address)");
  const { token: t4 } = await issueVerificationToken(user.id, email);
  await execute(`UPDATE users SET email = ? WHERE id = ?`, [`changed_${email}`, user.id]);
  const stale = await verifyToken(t4);
  t("link for a since-changed address is refused", !stale.valid && stale.reason === "stale");
  await execute(`UPDATE users SET email = ? WHERE id = ?`, [email, user.id]);

  console.log("\n── REAL EMAIL DELIVERY");
  inbox.length = 0;
  const sent = await sendVerificationEmail(user.id, email, "Vera Tester", "https://vesper.app");
  t("send reports success", sent.delivered && sent.transport === "smtp", `(${sent.transport})`);
  t("link withheld from caller on a real transport", sent.link === undefined);

  await new Promise((r) => setTimeout(r, 300));
  const raw = decode(inbox[0] ?? "");
  t("email received", inbox.length === 1);
  t("addressed to the user", raw.includes(email));
  t("subject correct", raw.includes("Confirm your email for Vesper"));
  t("greets by first name", raw.includes("Vera"));
  t("says access is not blocked", raw.toLowerCase().includes("nothing is locked"));

  const m = raw.match(/https:\/\/vesper\.app\/verify-email\?token=([A-Za-z0-9_-]+)/);
  t("link present and parseable", !!m?.[1]);

  console.log("\n── END TO END VIA THE EMAILED LINK");
  await execute(`UPDATE users SET email_verified_at = NULL WHERE id = ?`, [user.id]);
  const out = await completeVerification(m![1]);
  t("emailed token redeems", out.ok);
  t("user verified afterwards", (await isVerified(user.id)) === true);

  console.log("\n── CLEANUP + CASCADE");
  await pruneVerificationTokens();
  const leftover = await queryOne<{ c: number }>(
    `SELECT COUNT(*) c FROM email_verification_tokens WHERE user_id = ? AND used_at IS NOT NULL`,
    [user.id],
  );
  t("spent tokens pruned", Number(leftover?.c ?? 0) === 0);

  await execute(`DELETE FROM users WHERE id = ?`, [user.id]);
  const orphans = await queryOne<{ c: number }>(
    `SELECT COUNT(*) c FROM email_verification_tokens WHERE user_id = ?`,
    [user.id],
  );
  t("tokens cascade on account delete", Number(orphans?.c ?? 0) === 0);
  t("user really gone", (await findUserById(user.id)) === null);

  server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
