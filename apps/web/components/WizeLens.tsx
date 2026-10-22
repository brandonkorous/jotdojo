"use client";

import { WizeLensProvider } from "@wizeworks/lens-react";
import { useSyncExternalStore } from "react";

/**
 * WizeLens in the browser: page loads, renders, fetches and errors, sent to this
 * app's own server. On only when that server traces the page; the HUD shows in
 * development only, so production draws nothing.
 */
const DEVELOPMENT = process.env.NODE_ENV === "development";

// The navigation entry never changes after load, so there is nothing to subscribe to.
const noSubscribe = () => () => undefined;

/** True when the server that rendered this page traces it (`wl-trace` in Server-Timing). */
export function serverTraces(): boolean {
  const nav = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  return nav?.serverTiming?.some((entry) => entry.name === "wl-trace") ?? false;
}

export function WizeLens() {
  const enabled = useSyncExternalStore(noSubscribe, serverTraces, () => false);
  return <WizeLensProvider enabled={enabled} hud={DEVELOPMENT} />;
}
