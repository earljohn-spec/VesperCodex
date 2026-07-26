"use client";

import * as React from "react";
import { formatDate, formatTime, relativeTime } from "@/lib/utils";

/**
 * Timezone- and locale-safe timestamp rendering.
 *
 * The server renders in its own timezone (UTC in most deployments) while the
 * browser renders in the user's — so `toLocaleTimeString` produces different
 * text on each side and React reports a hydration mismatch. "1:30 AM" on the
 * server becomes "9:30 AM" in UTC+8; near midnight the date shifts too.
 *
 * There's no way for the server to know the client's zone, so these render a
 * stable placeholder for the initial HTML and swap in the real local string
 * after mount. `suppressHydrationWarning` covers the one-frame difference.
 *
 * `relativeTime` ("3h ago") is also clock-dependent — it drifts between the
 * server's render and the client's hydration — so it goes through here too.
 */

/**
 * False during SSR and the hydration pass, true afterwards.
 * `useSyncExternalStore` expresses this directly via its server snapshot,
 * so there's no state-setting effect and no extra render on the server.
 */
const subscribeNever = () => () => {};
export function useMounted() {
  return React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export function RelativeTime({ value, className }: { value: string; className?: string }) {
  const mounted = useMounted();
  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {mounted ? relativeTime(value) : ""}
    </time>
  );
}

export function LocalTime({ value, className }: { value: string; className?: string }) {
  const mounted = useMounted();
  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {mounted ? formatTime(value) : ""}
    </time>
  );
}

export function LocalDate({
  value,
  opts,
  className,
}: {
  value: string;
  opts?: Intl.DateTimeFormatOptions;
  className?: string;
}) {
  const mounted = useMounted();
  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {mounted ? formatDate(value, opts) : ""}
    </time>
  );
}

/** Locale-aware number (thousands separators differ by locale). */
export function LocalNumber({ value }: { value: number }) {
  const mounted = useMounted();
  return <span suppressHydrationWarning>{mounted ? value.toLocaleString() : String(value)}</span>;
}
