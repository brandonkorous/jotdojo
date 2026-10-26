"use client";

import { useEffect } from "react";
import { isStaleAction, reloadOnce } from "@/lib/stale-action";

/**
 * An open tab outlives a release, and its server-action ids are from the old
 * build. Reload once to get the new one; never retry the call.
 */
export function StaleActionReload() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isStaleAction(event.reason)) reloadOnce();
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);
  return null;
}
