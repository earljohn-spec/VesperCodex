"use server";

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

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string>;
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

  const row = findUserByEmail(parsed.data.email);
  if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
    return { error: "That email and password combination doesn't match our records." };
  }

  await createSession(row.id);
  redirect("/dashboard");
}

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

  if (findUserByEmail(parsed.data.email)) {
    return { fieldErrors: { email: "An account with this email already exists." } };
  }

  const row = createUser(parsed.data);
  // Give brand-new accounts a gentle starting point rather than a void.
  seedStarterContent(row.id, row.name);
  await createSession(row.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function demoLoginAction(): Promise<void> {
  let row = findUserByEmail("maya@vesper.app");

  // If the database was never seeded (e.g. `next dev` run directly instead of
  // `npm run dev`), create the demo account on the fly rather than erroring.
  // It gets starter content instead of the full 60-day history — running
  // `npm run db:seed` still gives the richer narrative.
  if (!row) {
    row = createUser({
      email: "maya@vesper.app",
      name: "Maya Okonkwo",
      password: "wellness123",
      focusAreas: ["burnout recovery", "sleep", "boundaries at work"],
      timezone: "Europe/London",
    });
    seedStarterContent(row.id, row.name);
  }

  await createSession(row.id);
  redirect("/dashboard");
}
