import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="animate-slide-up">
      <h2 className="text-2xl font-semibold tracking-tight text-white">Create your space</h2>
      <p className="mt-1.5 text-sm text-ink-400">
        Free, private, and yours. No card, no programme to commit to.
      </p>

      <SignupForm />

      <p className="mt-6 text-center text-sm text-ink-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-vesper-300 hover:text-vesper-200 focus-ring rounded">
          Sign in
        </Link>
      </p>
    </div>
  );
}
