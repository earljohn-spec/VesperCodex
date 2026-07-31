"use client";

import * as React from "react";
import Link from "next/link";
import { RefreshCw, PenLine, CheckCircle2 } from "lucide-react";
import { useOffline } from "@/components/offline";

/**
 * Client half of the offline fallback page.
 *
 * Shows what's waiting in the outbox and offers a retry. Kept separate from
 * the page so the page itself stays a static server component the service
 * worker can precache.
 */
export function OfflineShell() {
  const { offline, queue, syncing, flush } = useOffline();
  const [retrying, setRetrying] = React.useState(false);

  async function retry() {
    setRetrying(true);
    await flush();
    // If connectivity is genuinely back, a hard navigation re-renders the real
    // page from the server rather than this shell.
    if (typeof navigator !== "undefined" && navigator.onLine) {
      window.location.href = "/dashboard";
      return;
    }
    setRetrying(false);
  }

  return (
    <div className="mt-6 space-y-4">
      {queue.length > 0 ? (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.07] px-4 py-3 text-left">
          <p className="text-xs font-medium text-sky-200">
            {queue.length} {queue.length === 1 ? "change" : "changes"} waiting to sync
          </p>
          <ul className="mt-2 space-y-1">
            {queue.slice(0, 4).map((op) => (
              <li key={op.id} className="truncate text-[11px] text-ink-400">
                • {op.label}
              </li>
            ))}
            {queue.length > 4 && (
              <li className="text-[11px] text-ink-500">
                …and {queue.length - 4} more
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
          <p className="text-xs text-ink-300">Nothing waiting to sync</p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          onClick={() => void retry()}
          disabled={retrying || syncing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-vesper-600 px-5 text-sm font-medium text-white transition-colors hover:bg-vesper-500 disabled:opacity-60 focus-ring"
        >
          <RefreshCw className={retrying || syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {retrying || syncing ? "Checking…" : "Try again"}
        </button>
        <Link
          href="/journal?new=1"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-ink-700 px-5 text-sm font-medium text-ink-200 transition-colors hover:bg-ink-800 focus-ring"
        >
          <PenLine className="h-4 w-4" />
          Write anyway
        </Link>
      </div>

      {!offline && (
        <p className="text-[11px] text-emerald-300">
          Connection is back — press Try again.
        </p>
      )}
    </div>
  );
}
