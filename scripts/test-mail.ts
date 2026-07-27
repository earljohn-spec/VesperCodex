/**
 * Email delivery tests.
 *
 * Spins up a throwaway SMTP server on localhost and points the app's real
 * transport at it, so this verifies genuine delivery over the wire — the
 * message is parsed back out of the SMTP session, not asserted against a mock.
 *
 * Run with: npm run test:mail
 */
import "./_shim";
import { SMTPServer } from "smtp-server";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

/**
 * Re-imports src/lib/mail with the current environment. activeTransport()
 * reads process.env at call time, but the module is cached, so we clear it
 * between scenarios to be certain each case starts clean.
 */
function loadMail(): typeof import("../src/lib/mail") {
  const id = require_.resolve("../src/lib/mail");
  delete require_.cache[id];
  return require_(id) as typeof import("../src/lib/mail");
}

let pass = 0;
let fail = 0;
function t(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? " " + detail : ""}`);
}

/** Captures whatever an SMTP client sends us. */
function startServer(port: number) {
  const inbox: string[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, _session, cb) {
      let data = "";
      stream.on("data", (c) => (data += c));
      stream.on("end", () => {
        inbox.push(data);
        cb();
      });
    },
  });
  return new Promise<{ inbox: string[]; close: () => void }>((resolve) => {
    server.listen(port, "127.0.0.1", () =>
      resolve({ inbox, close: () => server.close() }),
    );
  });
}

/** Decodes quoted-printable so we can assert on the HTML body. */
function decode(raw: string) {
  return raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
}

async function main() {
  const PORT = 2526;
  const { inbox, close } = await startServer(PORT);

  console.log("\n── TRANSPORT SELECTION");
  {
    delete process.env.SMTP_URL;
    delete process.env.RESEND_API_KEY;
    const mail = loadMail();
    t("no config falls back to console", mail.activeTransport() === "console");
    t("mailConfigured() false without config", mail.mailConfigured() === false);
  }

  console.log("\n── TEMPLATES");
  {
    const { passwordResetTemplate, passwordChangedTemplate } = loadMail();
    const link = "https://vesper.app/reset-password?token=abc123";
    const tpl = passwordResetTemplate(link, 60);
    t("reset subject", tpl.subject === "Reset your Vesper password");
    t("link in plaintext", tpl.text.includes(link));
    t("link in html", tpl.html.includes(link));
    t("states the expiry", tpl.text.includes("60 minutes") && tpl.html.includes("60 minutes"));
    t("plaintext alternative exists", tpl.text.length > 80 && !tpl.text.includes("<"));
    t("carries the safety notice", tpl.html.includes("isn't therapy"));
    const changed = passwordChangedTemplate();
    t("change notice subject", changed.subject === "Your Vesper password was changed");
    t("change notice warns about compromise", changed.text.includes("wasn't you"));
  }

  console.log("\n── REAL SMTP DELIVERY");
  {
    // Point the app's own transport at the local server.
    process.env.SMTP_URL = `smtp://127.0.0.1:${PORT}`;
    process.env.MAIL_FROM = "Vesper <no-reply@vesper.test>";
    const mail = loadMail();
    t("SMTP_URL selects the smtp transport", mail.activeTransport() === "smtp");
    t("mailConfigured() true with SMTP", mail.mailConfigured() === true);

    const link = "https://vesper.app/reset-password?token=live-token-xyz";
    const tpl = mail.passwordResetTemplate(link, 60);
    const res = await mail.sendMail({ ...tpl, to: "maya@vesper.app" }, link);

    t("send reports success", res.ok && res.transport === "smtp", `(${res.transport})`);
    t("no preview link leaked over smtp", res.preview === undefined);

    await new Promise((r) => setTimeout(r, 250));
    t("server received exactly one message", inbox.length === 1, `(${inbox.length})`);

    const raw = decode(inbox[0] ?? "");
    t("recipient correct", raw.includes("maya@vesper.app"));
    t("from header applied", raw.includes("no-reply@vesper.test"));
    t("subject delivered", raw.includes("Reset your Vesper password"));
    t("reset link delivered", raw.includes("live-token-xyz"));
    t("multipart with html + text", raw.includes("text/plain") && raw.includes("text/html"));
  }

  console.log("\n── FAILURE HANDLING");
  {
    // Nothing is listening on this port.
    process.env.SMTP_URL = "smtp://127.0.0.1:2599";
    const mail = loadMail();
    const res = await mail.sendMail(
      { to: "x@y.z", subject: "s", text: "t", html: "<p>t</p>" },
      "https://link",
    );
    t("unreachable relay does not throw", typeof res.ok === "boolean");
    t("failure is reported, not swallowed", res.ok === false);
    t("error message captured", !!res.error, `(${res.error?.slice(0, 40)}…)`);
  }

  console.log("\n── NO LINK LEAK WHEN MAIL IS CONFIGURED");
  {
    process.env.SMTP_URL = `smtp://127.0.0.1:${PORT}`;
    const mail = loadMail();
    const res = await mail.sendMail(
      { to: "a@b.c", subject: "s", text: "t", html: "<p>t</p>" },
      "https://secret-link",
    );
    t("preview withheld on a real transport", res.preview === undefined);
  }

  close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
