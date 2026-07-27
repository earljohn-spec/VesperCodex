import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { verifyResetToken } from "@/lib/password-reset";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");

  const { token } = await searchParams;
  const check = token ? verifyResetToken(token) : ({ valid: false, reason: "unknown" } as const);

  if (!check.valid) {
    const message =
      check.reason === "expired"
        ? "This link has expired — they're only valid for an hour."
        : check.reason === "used"
          ? "This link has already been used."
          : "This link isn't valid.";

    return (
      <div className="animate-slide-up">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Link no longer works</h2>
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message} Request a fresh one and it&apos;ll arrive in a moment.</span>
        </div>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-vesper-600 px-5 text-sm font-medium text-white transition-colors hover:bg-vesper-500 focus-ring"
        >
          Request a new link
        </Link>
        <p className="mt-6 text-center text-sm text-ink-400">
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

  return (
    <div className="animate-slide-up">
      <h2 className="text-2xl font-semibold tracking-tight text-white">Choose a new password</h2>
      <p className="mt-1.5 text-sm text-ink-400">
        Setting a new password signs out every device, including any you don&apos;t recognise.
      </p>
      <ResetPasswordForm token={token!} />
    </div>
  );
}
