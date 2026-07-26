"use client";

import * as React from "react";

/**
 * Local state seeded from a server prop, kept in sync when that prop changes.
 *
 * Every list view here holds a local copy of server data so it can apply
 * optimistic updates, then re-syncs after `router.refresh()` sends fresh
 * props down. Doing that in a `useEffect` causes a wasted render pass and
 * trips `react-hooks/set-state-in-effect`.
 *
 * This uses React's documented "adjusting state when a prop changes" pattern
 * instead: compare against the previous prop during render and reset
 * immediately. React re-runs the component before committing, so the DOM
 * never shows the stale value.
 *
 * @see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
 */
export function useSyncedState<T>(source: T) {
  const [value, setValue] = React.useState<T>(source);
  const [prevSource, setPrevSource] = React.useState<T>(source);

  if (source !== prevSource) {
    setPrevSource(source);
    setValue(source);
  }

  return [value, setValue] as const;
}
