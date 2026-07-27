import "server-only";

/**
 * Email delivery.
 *
 * Three transports, chosen by environment:
 *
 * 1. **SMTP** — set `SMTP_URL` (e.g. `smtps://user:pass@smtp.resend.com:465`).
 *    Works with Resend, SES, Postmark, Mailgun, Fastmail, anything.
 * 2. **HTTP API** — set `RESEND_API_KEY` for Resend's REST endpoint, which is
 *    the easier option on platforms that block outbound SMTP ports.
 * 3. **Console** — the fallback. Logs the message and returns the link so
 *    local development and the demo work with no configuration at all.
 *
 * Delivery failures never surface to the user during password reset: telling
 * an anonymous visitor "we couldn't send to that address" leaks whether the
 * address is registered. Failures are logged and the caller still reports
 * success.
 */

export type Transport = "smtp" | "resend" | "console";

export interface SendResult {
  ok: boolean;
  transport: Transport;
  /** Present for the console transport so dev UIs can surface the link. */
  preview?: string;
  error?: string;
}

export interface Message {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function activeTransport(): Transport {
  if (process.env.SMTP_URL) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return "console";
}

function fromAddress() {
  return process.env.MAIL_FROM ?? "Vesper <no-reply@vesper.app>";
}

/** True when mail is really configured — used to decide whether to leak a dev link. */
export function mailConfigured() {
  return activeTransport() !== "console";
}

/* ------------------------------- transports ------------------------------ */

async function sendViaSmtp(msg: Message): Promise<SendResult> {
  // Imported lazily so SQLite/console-only deployments needn't install it.
  const nodemailer = (await import("nodemailer")).default;

  const transport = nodemailer.createTransport(process.env.SMTP_URL!, {
    // Some managed relays present certificates that don't match the host.
    tls: { rejectUnauthorized: process.env.SMTP_TLS_STRICT === "true" },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  await transport.sendMail({
    from: fromAddress(),
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });

  return { ok: true, transport: "smtp" };
}

async function sendViaResend(msg: Message): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend responded ${res.status}: ${body.slice(0, 200)}`);
  }
  return { ok: true, transport: "resend" };
}

function sendViaConsole(msg: Message, link?: string, reason?: string): SendResult {
  console.info(
    `\n──────────────────────────────────────────────────────────────\n` +
      `  ✉  ${msg.subject}\n` +
      `     to: ${msg.to}\n` +
      (link ? `     ${link}\n` : "") +
      `\n  ${reason ?? "No mail transport configured — set SMTP_URL or RESEND_API_KEY to send this for real. See .env.example."}\n` +
      `──────────────────────────────────────────────────────────────\n`,
  );
  return { ok: true, transport: "console", preview: link };
}

/* --------------------------------- send ---------------------------------- */

/**
 * Sends a message. Never throws — returns `{ ok: false }` with the reason so
 * callers can decide whether a failure is worth surfacing.
 */
export async function sendMail(msg: Message, previewLink?: string): Promise<SendResult> {
  const transport = activeTransport();
  try {
    if (transport === "smtp") return await sendViaSmtp(msg);
    if (transport === "resend") return await sendViaResend(msg);
    return sendViaConsole(msg, previewLink);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[vesper] mail delivery failed via ${transport}:`, error);
    // Fall back to logging so a misconfigured relay doesn't strand the user
    // in development. Production stays quiet — the link is a secret.
    if (process.env.NODE_ENV !== "production") {
      sendViaConsole(msg, previewLink, `Delivery via ${transport} failed, logging instead.`);
    }
    return { ok: false, transport, error, preview: previewLink };
  }
}

/* -------------------------------- templates ------------------------------ */

const BRAND = {
  bg: "#110f1e",
  card: "#1c1930",
  border: "#2e2a47",
  text: "#ecebf5",
  muted: "#8b85b4",
  accent: "#8250fb",
};

function layout(heading: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;">
          <tr><td style="padding:28px 28px 0;">
            <div style="font-size:17px;font-weight:600;color:#fff;letter-spacing:-0.01em;">Vesper</div>
          </td></tr>
          <tr><td style="padding:20px 28px 0;">
            <h1 style="margin:0;font-size:21px;line-height:1.3;color:#fff;font-weight:600;">${heading}</h1>
          </td></tr>
          <tr><td style="padding:14px 28px 0;">
            <div style="font-size:14px;line-height:1.65;color:${BRAND.text};">${body}</div>
          </td></tr>
          ${
            cta
              ? `<tr><td style="padding:24px 28px 0;">
            <a href="${cta.url}" style="display:inline-block;background:${BRAND.accent};color:#fff;text-decoration:none;padding:12px 22px;border-radius:11px;font-size:14px;font-weight:600;">${cta.label}</a>
          </td></tr>
          <tr><td style="padding:16px 28px 0;">
            <div style="font-size:12px;line-height:1.6;color:${BRAND.muted};">
              Or paste this into your browser:<br>
              <span style="color:#bdabff;word-break:break-all;">${cta.url}</span>
            </div>
          </td></tr>`
              : ""
          }
          <tr><td style="padding:26px 28px 28px;">
            <div style="border-top:1px solid ${BRAND.border};padding-top:16px;font-size:11.5px;line-height:1.6;color:${BRAND.muted};">
              Vesper supports wellbeing but isn't therapy, diagnosis, or crisis care.
              If you're in crisis, please contact your local emergency services or a crisis line.
            </div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function passwordResetTemplate(link: string, ttlMinutes: number): Message & { link: string } {
  return {
    to: "",
    link,
    subject: "Reset your Vesper password",
    text: [
      "Someone asked to reset the password on your Vesper account.",
      "",
      `Open this link to choose a new one (it expires in ${ttlMinutes} minutes):`,
      link,
      "",
      "If this wasn't you, ignore this email — your password stays as it is.",
      "Setting a new password also signs out every device.",
    ].join("\n"),
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 12px;">Someone asked to reset the password on your Vesper account.</p>
       <p style="margin:0;">The link below expires in <strong style="color:#fff;">${ttlMinutes} minutes</strong> and can only be used once. Setting a new password signs out every device.</p>
       <p style="margin:12px 0 0;color:${BRAND.muted};font-size:13px;">If this wasn't you, ignore this email — nothing changes.</p>`,
      { label: "Choose a new password", url: link },
    ),
  };
}

export function passwordChangedTemplate(): Message {
  return {
    to: "",
    subject: "Your Vesper password was changed",
    text: [
      "Your Vesper password was just changed, and all other devices were signed out.",
      "",
      "If this wasn't you, reset your password immediately and consider whether",
      "your email account may also be compromised.",
    ].join("\n"),
    html: layout(
      "Your password was changed",
      `<p style="margin:0 0 12px;">Your Vesper password was just changed. Every other device has been signed out.</p>
       <p style="margin:0;color:${BRAND.muted};font-size:13px;">If this wasn't you, reset your password immediately and check whether your email account is also compromised.</p>`,
    ),
  };
}

export function emailVerificationTemplate(
  link: string,
  name: string,
  ttlHours: number,
): Message & { link: string } {
  const first = name.split(" ")[0] || "there";
  return {
    to: "",
    link,
    subject: "Confirm your email for Vesper",
    text: [
      `Hi ${first},`,
      "",
      "Confirm this address so we can reach you if you ever need to reset your password:",
      link,
      "",
      `The link works for ${ttlHours} hours. You can keep using Vesper in the meantime —`,
      "nothing is locked behind this.",
      "",
      "If you didn't sign up for Vesper, ignore this email and the account stays unused.",
    ].join("\n"),
    html: layout(
      "Confirm your email",
      `<p style="margin:0 0 12px;">Hi ${first} — confirm this address so we can reach you if you ever need to reset your password.</p>
       <p style="margin:0;">The link works for <strong style="color:#fff;">${ttlHours} hours</strong>. You can keep using Vesper in the meantime; nothing is locked behind this.</p>
       <p style="margin:12px 0 0;color:${BRAND.muted};font-size:13px;">Didn't sign up? Ignore this and the account stays unused.</p>`,
      { label: "Confirm my email", url: link },
    ),
  };
}
