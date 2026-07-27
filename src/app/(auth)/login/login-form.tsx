"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { demoLoginAction, loginAction, type AuthState } from "@/lib/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {pending ? "Signing in…" : "Sign in"}
      {!pending && <ArrowRight className="h-4 w-4" />}
    </Button>
  );
}

function DemoButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="lg" className="w-full" loading={pending}>
      <Sparkles className="h-4 w-4 text-vesper-300" />
      {pending ? "Loading demo…" : "Explore the demo account"}
    </Button>
  );
}

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <div className="mt-8 space-y-5">
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-100"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <form action={formAction} className="space-y-4" noValidate>
        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@work.com"
            defaultValue="maya@vesper.app"
            aria-invalid={!!state.fieldErrors?.email}
          />
          {state.fieldErrors?.email && (
            <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.email}</p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="mb-1.5 text-xs font-medium text-vesper-300 hover:text-vesper-200 focus-ring rounded"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            defaultValue="wellness123"
            aria-invalid={!!state.fieldErrors?.password}
          />
          {state.fieldErrors?.password && (
            <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.password}</p>
          )}
        </div>

        <SubmitButton />
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-ink-800" />
        <span className="text-[11px] uppercase tracking-wider text-ink-500">or</span>
        <div className="h-px flex-1 bg-ink-800" />
      </div>

      <form action={demoLoginAction}>
        <DemoButton />
      </form>

      <p className="rounded-xl border border-ink-800 bg-ink-900/50 px-3.5 py-3 text-xs leading-relaxed text-ink-400">
        <span className="font-medium text-ink-200">Demo account</span> — maya@vesper.app /
        wellness123. Two months of realistic history: a burnout dip, a recovery arc, wearable data,
        and a companion that already knows her patterns.
      </p>
    </div>
  );
}
