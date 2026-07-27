"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { confirmPasswordResetAction, type AuthState } from "@/lib/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {pending ? "Updating…" : "Set new password"}
      {!pending && <ArrowRight className="h-4 w-4" />}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    confirmPasswordResetAction,
    {},
  );

  return (
    <form action={formAction} className="mt-8 space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />

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
        <Label htmlFor="password" hint="min. 8 characters">
          New password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          autoFocus
          aria-invalid={!!state.fieldErrors?.password}
        />
        {state.fieldErrors?.password && (
          <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.password}</p>
        )}
      </div>

      <div>
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={!!state.fieldErrors?.confirm}
        />
        {state.fieldErrors?.confirm && (
          <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.confirm}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
