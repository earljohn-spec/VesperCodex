"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Link2, Link2Off, RefreshCw, Watch } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmDialog, useToast } from "@/components/ui";
import { RelativeTime } from "@/components/local-time";

interface Status {
  connected: boolean;
  scopes: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

/** Human-readable copy for the ?health= codes the OAuth callback redirects with. */
const CALLBACK_MESSAGES: Record<string, { tone: "success" | "error" | "info"; text: string }> = {
  connected: { tone: "success", text: "Google Health connected. Pull your data whenever you like." },
  denied: { tone: "info", text: "Connection cancelled — nothing was shared." },
  expired: { tone: "error", text: "That authorization took too long. Try connecting again." },
  invalid: { tone: "error", text: "That Google Health response wasn't valid. Try connecting again." },
  session: { tone: "error", text: "Your session changed mid-connection. Sign in and retry." },
  error: { tone: "error", text: "Connection failed. Try again in a moment." },
  norefresh: {
    tone: "error",
    text: "Google didn't return a refresh token. Remove Vesper at myaccount.google.com/permissions, then reconnect.",
  },
};

export function GoogleHealthPanel({
  configured,
  initial,
  callbackStatus,
}: {
  configured: boolean;
  initial: Status;
  callbackStatus?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = React.useState(initial);
  const [syncing, setSyncing] = React.useState(false);
  const [confirmOff, setConfirmOff] = React.useState(false);

  // Surface the callback outcome once, then clean the URL so a refresh
  // doesn't replay the toast.
  const [handled, setHandled] = React.useState(false);
  if (callbackStatus && !handled) {
    setHandled(true);
    const msg = CALLBACK_MESSAGES[callbackStatus] ?? CALLBACK_MESSAGES.error;
    queueMicrotask(() => {
      toast(msg.text, msg.tone);
      router.replace("/biometrics", { scroll: false });
    });
  }

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/google-health/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Sync failed", "error");
        setStatus((s) => ({ ...s, lastError: data.error ?? "Sync failed" }));
        return;
      }
      toast(
        data.spikeDetected
          ? `Synced ${data.synced} readings — stress spike detected`
          : `Synced ${data.synced} readings`,
        "success",
      );
      setStatus((s) => ({ ...s, lastSyncAt: new Date().toISOString(), lastError: null }));
      router.refresh();
    } catch {
      toast("Couldn't reach the server", "error");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    setConfirmOff(false);
    const res = await fetch("/api/integrations/google-health/sync", { method: "DELETE" });
    if (!res.ok) return toast("Couldn't disconnect", "error");
    setStatus({ connected: false, scopes: null, lastSyncAt: null, lastError: null });
    toast("Disconnected. Readings already collected stay in your history.");
    router.refresh();
  }

  if (!configured) {
    return (
      <Card className="mb-5">
        <CardHeader title="Fitbit / Google Health" subtitle="Not configured on this server" icon={Watch} />
        <div className="px-5 pb-5">
          <p className="text-xs leading-relaxed text-ink-400">
            Fitbit data now comes through the{" "}
            <span className="text-ink-200">Google Health API</span> — Google closed the old Fitbit
            developer portal and turns that API off in September 2026. Create a project in the
            Google Cloud Console, then set{" "}
            <code className="rounded bg-ink-800 px-1 py-0.5 text-[11px]">GOOGLE_CLIENT_ID</code> and{" "}
            <code className="rounded bg-ink-800 px-1 py-0.5 text-[11px]">GOOGLE_CLIENT_SECRET</code>.
            See <span className="text-ink-200">docs/TESTING.md</span>.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
            Until then the readings on this page are simulated locally — the detection logic is
            real, the numbers aren&apos;t.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={status.connected ? "mb-5" : "mb-5 border-vesper-500/25"}>
      <CardHeader
        title="Fitbit / Google Health"
        subtitle={status.connected ? "Connected" : "Pull real readings from your tracker"}
        icon={Watch}
        action={
          status.connected ? (
            <Badge tone="emerald">
              <CheckCircle2 className="h-3 w-3" />
              linked
            </Badge>
          ) : undefined
        }
      />

      <div className="px-5 pb-5">
        {status.lastError && (
          <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{status.lastError}</span>
          </div>
        )}

        {status.connected ? (
          <>
            <p className="text-xs leading-relaxed text-ink-400">
              Vesper reads heart rate, HRV, sleep and steps — nothing else. Readings are pulled on
              demand, not streamed.
            </p>
            <p className="mt-1.5 text-[11px] text-ink-500">
              {status.lastSyncAt ? (
                <>
                  Last pull <RelativeTime value={status.lastSyncAt} />
                </>
              ) : (
                "Not pulled yet"
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={sync} loading={syncing}>
                <RefreshCw className="h-3.5 w-3.5" />
                Pull today&apos;s data
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmOff(true)}>
                <Link2Off className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-ink-400">
              Connect your Google account to replace the simulated readings with your Fitbit or Pixel
              Watch data. Vesper asks only for heart-rate, activity and sleep metrics, and you can
              revoke access any time from your Google account.
            </p>
            <a href="/api/integrations/google-health/connect" className="mt-4 inline-block">
              <Button size="sm">
                <Link2 className="h-3.5 w-3.5" />
                Connect Google Health
              </Button>
            </a>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        onConfirm={disconnect}
        title="Disconnect Google Health?"
        description="Vesper will forget your access tokens and stop pulling readings. Data already collected stays in your history."
        confirmLabel="Disconnect"
      />
    </Card>
  );
}
