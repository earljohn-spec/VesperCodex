import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { completeVerification } from "@/lib/email-verification";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Confirm your email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const signedIn = !!(await getCurrentUser());
  const result = token
    ? await completeVerification(token)
    : ({ ok: false, reason: "unknown" } as const);

  if (result.ok) {
    return (
      <div className="animate-slide-up">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          {result.alreadyVerified ? "Already confirmed" : "Email confirmed"}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-400">
          {result.alreadyVerified
            ? "This address was already on file. Nothing else to do."
            : "Thanks — we can now reach you if you ever need to reset your password."}
        </p>
        <Link
          href={signedIn ? "/dashboard" : "/login"}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-vesper-600 px-5 text-sm font-medium text-white transition-colors hover:bg-vesper-500 focus-ring"
        >
          {signedIn ? "Back to Vesper" : "Sign in"}
        </Link>
      </div>
    );
  }

  const message =
    result.reason === "expired"
      ? "This link has expired — they're good for 48 hours."
      : result.reason === "used"
        ? "This link has already been used."
        : result.reason === "stale"
          ? "Your email address changed after this link was sent, so it's no longer valid."
          : "This confirmation link isn't valid.";

  return (
    <div className="animate-slide-up">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-300">
        <AlertCircle className="h-6 w-6" />
      </span>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">
        Link no longer works
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{message}</p>
      <p className="mt-3 rounded-xl border border-ink-800 bg-ink-900/50 px-3.5 py-3 text-xs leading-relaxed text-ink-400">
        Nothing is locked behind confirming your email — you can keep using Vesper either way.
        Send yourself a fresh link any time from <span className="text-ink-200">Settings</span>.
      </p>
      <Link
        href={signedIn ? "/settings" : "/login"}
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-vesper-600 px-5 text-sm font-medium text-white transition-colors hover:bg-vesper-500 focus-ring"
      >
        {signedIn ? "Go to settings" : "Sign in"}
      </Link>
    </div>
  );
}
