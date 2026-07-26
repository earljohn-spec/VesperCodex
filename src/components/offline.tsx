"use client";

import * as React from "react";
import { CloudOff, Cloud, RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Offline support.
 *
 * Vesper treats connectivity as optional. Writes made while offline are queued
 * in localStorage and replayed when the connection returns, so journalling and
 * habit-ticking keep working on the tube, on a plane, or during a deliberate
 * digital detox.
 *
 * `simulate` lets you exercise the whole flow without actually pulling the
 * network cable — it's wired to a toggle in Settings.
 */

const QUEUE_KEY = "vesper:outbox";
const SIMULATE_KEY = "vesper:simulate-offline";

export interface QueuedOp {
  id: string;
  url: string;
  method: string;
  body: unknown;
  label: string;
  createdAt: string;
}

/* ------------------------------- the store ------------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();

function readQueue(): QueuedOp[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedOp[];
  } catch {
    return [];
  }
}

function writeQueue(ops: QueuedOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  listeners.forEach((l) => l());
}

export function isSimulatedOffline() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIMULATE_KEY) === "1";
}

export function setSimulatedOffline(v: boolean) {
  localStorage.setItem(SIMULATE_KEY, v ? "1" : "0");
  window.dispatchEvent(new Event("vesper:offline-change"));
  listeners.forEach((l) => l());
}

export function enqueue(op: Omit<QueuedOp, "id" | "createdAt">) {
  const ops = readQueue();
  ops.push({ ...op, id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() });
  writeQueue(ops);
}

/* -------------------------------- the hook ------------------------------- */

export function useOffline() {
  const [online, setOnline] = React.useState(true);
  const [simulated, setSimulated] = React.useState(false);
  const [queue, setQueue] = React.useState<QueuedOp[]>([]);
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    const sync = () => {
      setOnline(navigator.onLine);
      setSimulated(isSimulatedOffline());
      setQueue(readQueue());
    };
    sync();
    const l: Listener = () => setQueue(readQueue());
    listeners.add(l);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("vesper:offline-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      listeners.delete(l);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("vesper:offline-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const offline = !online || simulated;

  const flush = React.useCallback(async () => {
    if (offline) return { ok: 0, failed: 0 };
    const ops = readQueue();
    if (!ops.length) return { ok: 0, failed: 0 };
    setSyncing(true);
    let ok = 0;
    const remaining: QueuedOp[] = [];
    for (const op of ops) {
      try {
        const res = await fetch(op.url, {
          method: op.method,
          headers: { "Content-Type": "application/json", "x-vesper-replay": "1" },
          body: op.body === undefined ? undefined : JSON.stringify(op.body),
        });
        if (res.ok) ok++;
        else remaining.push(op);
      } catch {
        remaining.push(op);
      }
    }
    writeQueue(remaining);
    setSyncing(false);
    return { ok, failed: remaining.length };
  }, [offline]);

  // Auto-flush the outbox when connectivity returns. This is a genuine
  // external-system sync (network + localStorage), which is exactly what
  // effects are for; `flush` sets `syncing` as a side effect of that work.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!offline && queue.length) void flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline]);

  return { offline, online, simulated, queue, syncing, flush, setSimulated: setSimulatedOffline };
}

/**
 * fetch wrapper that queues the write when offline instead of failing.
 * Returns `{ queued: true }` so callers can keep their optimistic update.
 */
export async function offlineFetch(
  url: string,
  init: { method: string; body?: unknown; label: string },
): Promise<{ ok: boolean; queued: boolean; data?: unknown; error?: string }> {
  const offline = typeof navigator !== "undefined" && (!navigator.onLine || isSimulatedOffline());

  if (offline) {
    enqueue({ url, method: init.method, body: init.body, label: init.label });
    return { ok: true, queued: true };
  }

  try {
    const res = await fetch(url, {
      method: init.method,
      headers: { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, queued: false, error: (data as { error?: string })?.error ?? "Request failed" };
    }
    return { ok: true, queued: false, data };
  } catch {
    // network died mid-flight — queue it rather than lose the write
    enqueue({ url, method: init.method, body: init.body, label: init.label });
    return { ok: true, queued: true };
  }
}

/* ------------------------------- the badge ------------------------------- */

export function OfflineBadge({
  pendingCount = 0,
  compact,
}: {
  pendingCount?: number;
  compact?: boolean;
}) {
  const { offline, simulated, queue, syncing, flush } = useOffline();
  const total = queue.length + pendingCount;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium",
          offline
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : total > 0
              ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
        )}
      >
        {offline ? <WifiOff className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
        {offline ? "Offline" : total > 0 ? total : "Synced"}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 transition-colors",
        offline
          ? "border-amber-500/30 bg-amber-500/[0.07]"
          : total > 0
            ? "border-sky-500/30 bg-sky-500/[0.07]"
            : "border-ink-800 bg-ink-900/50",
      )}
    >
      <div className="flex items-center gap-2">
        {offline ? (
          <CloudOff className="h-3.5 w-3.5 shrink-0 text-amber-300" />
        ) : (
          <Cloud className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
        )}
        <span
          className={cn(
            "text-xs font-medium",
            offline ? "text-amber-200" : "text-ink-200",
          )}
        >
          {offline
            ? simulated
              ? "Offline mode on"
              : "No connection"
            : total > 0
              ? `${total} to sync`
              : "All synced"}
        </span>
        {!offline && total > 0 && (
          <button
            onClick={() => void flush()}
            className="ml-auto rounded p-1 text-sky-300 hover:bg-sky-500/10 focus-ring"
            aria-label="Sync now"
          >
            <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
        {offline
          ? total > 0
            ? `${total} ${total === 1 ? "change" : "changes"} saved locally. They'll sync when you reconnect.`
            : "Everything still works. Changes save locally."
          : total > 0
            ? `${total} pending ${total === 1 ? "change" : "changes"}…`
            : "Journalling works offline too."}
      </p>
    </div>
  );
}

/** Full-width banner for the top of pages, shown only when offline. */
export function OfflineBanner() {
  const { offline, simulated, queue } = useOffline();
  if (!offline) return null;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 animate-fade-in">
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <div className="text-xs leading-relaxed text-amber-100/90">
        <span className="font-medium text-amber-200">
          {simulated ? "Offline mode is on." : "You're offline."}
        </span>{" "}
        Journalling, habit ticks and breathing exercises all still work
        {queue.length > 0 && ` — ${queue.length} ${queue.length === 1 ? "change is" : "changes are"} queued`}
        . Everything syncs automatically when you reconnect.
      </div>
    </div>
  );
}
