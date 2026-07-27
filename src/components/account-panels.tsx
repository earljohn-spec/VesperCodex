"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Download, KeyRound, MailCheck, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Input, Label, Modal, useToast } from "@/components/ui";
import {
  changePasswordAction,
  deleteAccountAction,
  type AccountState,
} from "@/lib/actions/account";
import { resendVerificationAction, type AuthState } from "@/lib/actions/auth";

function SubmitButton({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending}>
      {children}
    </Button>
  );
}

/* ---------------------------- change password --------------------------- */

export function ChangePasswordPanel() {
  const [state, formAction] = useActionState<AccountState, FormData>(changePasswordAction, {});
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.notice) formRef.current?.reset();
  }, [state.notice]);

  return (
    <Card className="mb-5">
      <CardHeader
        title="Password"
        subtitle="Change the password you use to sign in"
        icon={KeyRound}
      />
      <form ref={formRef} action={formAction} className="space-y-4 px-5 pb-5" noValidate>
        {state.notice && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.notice}</span>
          </div>
        )}
        {state.error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="current">Current</Label>
            <Input
              id="current"
              name="current"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
            {state.fieldErrors?.current && (
              <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.current}</p>
            )}
          </div>
          <div>
            <Label htmlFor="new-password" hint="min. 8">
              New
            </Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
            />
            {state.fieldErrors?.password && (
              <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.password}</p>
            )}
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm</Label>
            <Input
              id="confirm-password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
            />
            {state.fieldErrors?.confirm && (
              <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.confirm}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <SubmitButton>Update password</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------ export data ----------------------------- */

export function ExportPanel({ counts }: { counts: Record<string, number> }) {
  const toast = useToast();
  const [downloading, setDownloading] = React.useState(false);

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vesper-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Export downloaded");
    } catch {
      toast("Couldn't build the export", "error");
    } finally {
      setDownloading(false);
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Card className="mb-5">
      <CardHeader
        title="Export your data"
        subtitle="Everything you've written, in one JSON file"
        icon={Download}
      />
      <div className="px-5 pb-5">
        <p className="text-xs leading-relaxed text-ink-400">
          Includes every journal entry, conversation, habit log, biometric reading and memory —
          about {total.toLocaleString()} records. It&apos;s yours; take it anywhere.
        </p>
        <Button variant="secondary" className="mt-4" onClick={download} loading={downloading}>
          <Download className="h-4 w-4" />
          Download my data
        </Button>
      </div>
    </Card>
  );
}

/* ----------------------------- delete account --------------------------- */

export function DeleteAccountPanel() {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<AccountState, FormData>(deleteAccountAction, {});

  return (
    <Card className="mb-5 border-rose-500/25">
      <CardHeader
        title="Delete your account"
        subtitle="Permanent, immediate, and complete"
        icon={Trash2}
      />
      <div className="px-5 pb-5">
        <p className="text-xs leading-relaxed text-ink-400">
          This erases your journal, conversations, habits, biometrics and memories from the
          database. There is no soft-delete and no recovery window. Consider exporting first.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Delete account
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        description="This can't be undone. Everything goes."
        size="sm"
      >
        <form action={formAction} className="space-y-4" noValidate>
          {state.error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div>
            <Label htmlFor="del-password">Your password</Label>
            <Input
              id="del-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
            {state.fieldErrors?.password && (
              <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.password}</p>
            )}
          </div>

          <div>
            <Label htmlFor="del-confirm" hint="type DELETE">
              Confirm
            </Label>
            <Input
              id="del-confirm"
              name="confirmation"
              placeholder="DELETE"
              autoComplete="off"
            />
            {state.fieldErrors?.confirmation && (
              <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.confirmation}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <SubmitButton variant="danger">Delete everything</SubmitButton>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

/* --------------------------- email verification -------------------------- */

export function EmailVerificationPanel({
  email,
  verifiedAt,
}: {
  email: string;
  verifiedAt: string | null;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    () => resendVerificationAction(),
    {},
  );

  if (verifiedAt) {
    return (
      <Card className="mb-5">
        <CardHeader title="Email" subtitle="Confirmed" icon={MailCheck} />
        <div className="flex items-center gap-2.5 px-5 pb-5 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            <span className="text-white">{email}</span> is confirmed — we can reach you for
            password resets.
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-5 border-amber-500/25">
      <CardHeader title="Email" subtitle="Not confirmed yet" icon={MailCheck} />
      <form action={formAction} className="px-5 pb-5">
        {state.notice && (
          <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.notice}</span>
          </div>
        )}
        {state.error && (
          <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <p className="text-xs leading-relaxed text-ink-400">
          We haven&apos;t confirmed <span className="text-ink-200">{email}</span> yet. Nothing is
          locked — but without it we can&apos;t send you a password reset if you get locked out.
        </p>

        {state.devLink && (
          <a
            href={state.devLink}
            className="mt-3 block break-all rounded-lg border border-ink-800 bg-ink-950/60 px-2.5 py-2 text-[11px] text-vesper-300 hover:text-vesper-200 focus-ring"
          >
            {state.devLink}
          </a>
        )}

        <div className="mt-4">
          <SubmitButton>Send confirmation link</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
