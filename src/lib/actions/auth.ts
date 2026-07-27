"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSession,
  createUser,
  destroySession,
  findUserByEmail,
  verifyPassword,
} from "@/lib/auth";
import { seedStarterContent } from "@/lib/starter";
import { clientIp, consume, reset } from "@/lib/rate-limit";
import {
  completeReset,
  deliverResetEmail,
  issueResetToken,
  verifyResetToken,
} from "@/lib/password-reset";

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Set on success for flows that stay on the page. */
  notice?: string;
  /** Dev convenience: the reset link, since no mailer is configured. */
  devLink?: string;
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Tell us what to call you"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});

async function ip() {
  return clientIp(await headers());
}

async function origin() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function tooMany(retryAfter: number): AuthState {
  const mins = Math.ceil(retryAfter / 60);
  return {
    error:
      mins > 1
        ? `Too many attempts. Try again in about ${mins} minutes.`
        : `Too many attempts. Try again in ${retryAfter} seconds.`,
  };
}

/* --------------------------------- login -------------------------------- */

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }

  const email = parsed.data.email.toLowerCase().trim();

  // Limit per-IP and per-account: one stops a spray from a single host, the
  // other stops a distributed attack focused on one inbox.
  const byIp = await consume("login", await ip());
  if (!byIp.allowed) return tooMany(byIp.retryAfter);
  const byAccount = await consume("login", `acct:${email}`);
  if (!byAccount.allowed) return tooMany(byAccount.retryAfter);

  const row = await findUserByEmail(email);
  if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
    return { error: "That email and password combination doesn't match our records." };
  }

  // Clear the counters so a successful sign-in isn't penalised later.
  await reset("login", await ip());
  await reset("login", `acct:${email}`);

  await createSession(row.id);
  redirect("/dashboard");
}

/* -------------------------------- signup -------------------------------- */

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }

  const gate = await consume("signup", await ip());
  if (!gate.allowed) return tooMany(gate.retryAfter);

  if (await findUserByEmail(parsed.data.email)) {
    return { fieldErrors: { email: "An account with this email already exists." } };
  }

  const row = await createUser(parsed.data);
  await seedStarterContent(row.id, row.name);
  await createSession(row.id);
  redirect("/dashboard");
}

/* ----------------------------- password reset --------------------------- */

const requestSchema = z.object({ email: z.string().email("Enter a valid email address") });

export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = requestSchema.safeParse({ email: String(formData.get("email") ?? "") });
  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.issues[0]!.message } };
  }

  const gate = await consume("passwordReset", await ip());
  if (!gate.allowed) return tooMany(gate.retryAfter);

  const email = parsed.data.email.toLowerCase().trim();
  const row = await findUserByEmail(email);

  // Always report success. Telling an anonymous visitor whether an address is
  // registered leaks who uses a mental-health app.
  const generic: AuthState = {
    notice:
      "If an account exists for that address, a reset link is on its way. Check your inbox and spam folder.",
  };

  if (!row) return generic;

  const { token } = await issueResetToken(row.id);
  const { link } = await deliverResetEmail(email, token, await origin());

  // Surfaced in the UI only outside production, so the flow is testable
  // without a mail provider.
  return process.env.NODE_ENV === "production" ? generic : { ...generic, devLink: link };
}

const confirmSchema = z
  .object({
    token: z.string().min(10, "This reset link is malformed"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Both passwords need to match",
    path: ["confirm"],
  });

export async function confirmPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = confirmSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }

  const gate = await consume("passwordResetConfirm", await ip());
  if (!gate.allowed) return tooMany(gate.retryAfter);

  const outcome = await completeReset(parsed.data.token, parsed.data.password);
  if (!outcome.ok) {
    const message =
      outcome.reason === "expired"
        ? "That link has expired. Request a new one."
        : outcome.reason === "used"
          ? "That link has already been used. Request a new one."
          : "That reset link isn't valid. Request a new one.";
    return { error: message };
  }

  redirect("/login?reset=1");
}

/** Server-side check so the reset page can show a useful state before submit. */
export async function checkResetTokenAction(token: string) {
  const result = await verifyResetToken(token);
  return result.valid ? { valid: true as const } : { valid: false as const, reason: result.reason };
}

/* -------------------------------- session ------------------------------- */

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function demoLoginAction(): Promise<void> {
  let row = await findUserByEmail("maya@vesper.app");

  // If the database was never seeded (e.g. `next dev` run directly instead of
  // `npm run dev`), create the demo account on the fly rather than erroring.
  if (!row) {
    row = await createUser({
      email: "maya@vesper.app",
      name: "Maya Okonkwo",
      password: "wellness123",
      focusAreas: ["burnout recovery", "sleep", "boundaries at work"],
      timezone: "Europe/London",
    });
    await seedStarterContent(row.id, row.name);
  }

  await createSession(row.id);
  redirect("/dashboard");
}
