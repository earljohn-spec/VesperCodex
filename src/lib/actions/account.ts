"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { destroySession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { deleteAccount } from "@/lib/account";
import { execute, nowIso, queryOne } from "@/lib/db";

export interface AccountState {
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
}

/* ---------------------------- change password --------------------------- */

const changeSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Both passwords need to match",
    path: ["confirm"],
  });

export async function changePasswordAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be signed in." };

  const parsed = changeSchema.safeParse({
    current: String(formData.get("current") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { fieldErrors };
  }

  const row = queryOne<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = ?`,
    [user.id],
  );
  if (!row || !verifyPassword(parsed.data.current, row.password_hash)) {
    return { fieldErrors: { current: "That isn't your current password." } };
  }

  const ts = nowIso();
  execute(
    `UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?`,
    [hashPassword(parsed.data.password), ts, ts, user.id],
  );

  return { notice: "Password updated. Other devices stay signed in." };
}

/* ---------------------------- delete account ---------------------------- */

const deleteSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
  confirmation: z.string(),
});

export async function deleteAccountAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to be signed in." };

  const parsed = deleteSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmation: String(formData.get("confirmation") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { fieldErrors };
  }

  if (parsed.data.confirmation.trim().toUpperCase() !== "DELETE") {
    return { fieldErrors: { confirmation: 'Type DELETE to confirm.' } };
  }

  const row = queryOne<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = ?`,
    [user.id],
  );
  if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
    return { fieldErrors: { password: "That password isn't right." } };
  }

  deleteAccount(user.id);
  await destroySession();
  redirect("/login?deleted=1");
}
