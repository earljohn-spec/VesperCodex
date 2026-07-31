import type { Metadata } from "next";
import { CloudOff } from "lucide-react";
import { OfflineShell } from "@/components/offline-shell";

export const metadata: Metadata = { title: "Offline" };

/**
 * The offline fallback shell.
 *
 * This is the one page in the app that is deliberately **static** — the
 * service worker precaches it at install so there is always something on disk
 * to render when a navigation fails. It must not read from the database or
 * call `getCurrentUser`, or it couldn't be prerendered.
 *
 * Everything user-specific on this page comes from the client: the outbox in
 * localStorage and whatever the data cache happens to hold.
 */
export default function OfflinePage() {
  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30">
          <CloudOff className="h-5 w-5 text-amber-300" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          Vesper still works. Anything you write is saved on this device and syncs
          the moment you reconnect.
        </p>

        <OfflineShell />
      </div>
    </div>
  );
}
