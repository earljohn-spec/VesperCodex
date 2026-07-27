import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="animate-slide-up">
      <h2 className="text-2xl font-semibold tracking-tight text-white">Reset your password</h2>
      <p className="mt-1.5 text-sm text-ink-400">
        Enter the address you signed up with and we&apos;ll send a link to set a new one.
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm text-ink-400">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-vesper-300 hover:text-vesper-200 focus-ring rounded"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
