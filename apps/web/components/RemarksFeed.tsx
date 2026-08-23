"use client";

import { usePublish } from "@/lib/live-feed";
import { useRemarks } from "@/lib/remarks";

/**
 * What the agent has said, said once, on the line. ADR-061.
 *
 * Headless: it renders nothing of its own. Outstanding remarks are a STANDING
 * entry, so they sit on the line until they are dealt with rather than flashing
 * past -- and they outrank the transcript, because one is work and the other is
 * information.
 */
export function RemarksFeed() {
  const remarks = useRemarks();
  const open = remarks?.open ?? [];
  const newest = open[open.length - 1];

  usePublish(
    "agent",
    open.length === 0 ? null : {
      tone: "standing",
      rank: 20,
      line: open.length === 1
        ? "Your agent left a remark"
        : `${open.length} remarks from your agent`,
      detail: (
        <div className="jd-live-remark">
          <p className="jd-live-remark-body">{newest?.body}</p>
          <button
            type="button"
            className="btn btn-xs btn-ghost self-start"
            onClick={() => remarks?.setDrawer(true)}
          >
            {open.length === 1 ? "Open" : `Open all ${open.length}`}
          </button>
        </div>
      ),
    },
    [open.length, newest?.id],
  );

  return null;
}
