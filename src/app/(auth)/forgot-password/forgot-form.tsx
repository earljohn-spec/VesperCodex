"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { requestPasswordResetAction, type AuthState } from "@/lib/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {pending ? "Sending…" : "Send reset link"}
      {!pending && <ArrowRight className="h-4 w-4" />}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestPasswordResetAction,
    {},
  );

  if (state.notice) {
    return (
      <div className="mt-8 space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.notice}</span>
        </div>

        {state.devLink && (
          <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
              Development only
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              No mail provider is configured, so here&apos;s the link directly:
            </p>
            <a
              href={state.devLink}
              className="mt-2 block break-all rounded-lg bg-ink-950/60 px-2.5 py-2 text-[11px] text-vesper-300 hover:text-vesper-200 focus-ring"
            >
              {state.devLink}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4" noValidate>
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
          autoFocus
          aria-invalid={!!state.fieldErrors?.email}
        />
        {state.fieldErrors?.email && (
          <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.email}</p>
        )}
      </div>

      <SubmitButton />

      <p className="pt-1 text-center text-[11px] leading-relaxed text-ink-500">
        For your privacy, we show the same message whether or not an account exists.
      </p>
    </form>
  );
}
