import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; deleted?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");

  const sp = await searchParams;
  const notice = sp.reset
    ? "Password updated. Sign in with your new one."
    : sp.deleted
      ? "Your account and all its data have been deleted. Take care of yourself."
      : undefined;

  return (
    <div className="animate-slide-up">
      <h2 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h2>
      <p className="mt-1.5 text-sm text-ink-400">
        Pick up where you left off. Vesper remembers the context.
      </p>

      <LoginForm notice={notice} />

      <p className="mt-6 text-center text-sm text-ink-400">
        New here?{" "}
        <Link href="/signup" className="font-medium text-vesper-300 hover:text-vesper-200 focus-ring rounded">
          Create an account
        </Link>
      </p>
    </div>
  );
}
