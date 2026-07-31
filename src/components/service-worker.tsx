"use client";

import * as React from "react";

/**
 * Registers the service worker.
 *
 * Only in production builds: in dev, Turbopack serves unhashed modules that
 * change on every edit, and a cache-first worker sitting in front of them
 * makes for a genuinely baffling debugging experience.
 *
 * Set `NEXT_PUBLIC_VESPER_SW_DEV=1` to opt in while working on the worker
 * itself.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const devOptIn = process.env.NEXT_PUBLIC_VESPER_SW_DEV === "1";
    if (process.env.NODE_ENV !== "production" && !devOptIn) {
      // Tidy up any worker left behind by a previous production run on the
      // same origin (localhost:3000 is commonly used for both).
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => void r.unregister());
      });
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // A failed registration must never break the app — offline support is
        // an enhancement, not a dependency.
      });
    };

    // Registering after load keeps the worker off the critical path.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

/**
 * Tells the worker to drop cached API responses.
 *
 * Called on sign-out. Cached journal entries and biometrics are personal data;
 * leaving them on disk for the next user of a shared machine would be a real
 * privacy hole.
 */
export function clearOfflineData() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage("vesper:clear-data");
}
