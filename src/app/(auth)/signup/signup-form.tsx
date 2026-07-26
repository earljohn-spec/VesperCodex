"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { signupAction, type AuthState } from "@/lib/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {pending ? "Creating your space…" : "Create account"}
      {!pending && <ArrowRight className="h-4 w-4" />}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(signupAction, {});

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
        <Label htmlFor="name">What should Vesper call you?</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Maya"
          aria-invalid={!!state.fieldErrors?.name}
        />
        {state.fieldErrors?.name && (
          <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.name}</p>
        )}
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@work.com"
          aria-invalid={!!state.fieldErrors?.email}
        />
        {state.fieldErrors?.email && (
          <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.email}</p>
        )}
      </div>

      <div>
        <Label htmlFor="password" hint="min. 8 characters">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={!!state.fieldErrors?.password}
        />
        {state.fieldErrors?.password && (
          <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.password}</p>
        )}
      </div>

      <SubmitButton />

      <p className="pt-1 text-center text-[11px] leading-relaxed text-ink-500">
        Your entries stay on your own instance. Vesper supports wellbeing but is not therapy,
        diagnosis, or crisis care.
      </p>
    </form>
  );
}
