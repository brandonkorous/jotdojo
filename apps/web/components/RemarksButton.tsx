"use client";

import { Icon } from "@/components/Icon";
import { useRemarks } from "@/lib/remarks";

/**
 * The way back to the agent's remarks when nothing is outstanding. ADR-061.
 *
 * The line only speaks while there is something to say, so on its own it is no
 * use to somebody asking "what did it tell me last week". This sits in the
 * chrome, which is always there.
 *
 * It appears only once an agent has ever spoken about this page. A button for
 * a conversation that has not happened is a button that teaches nothing.
 */
export function RemarksButton() {
  const remarks = useRemarks();
  if (!remarks || remarks.all.length === 0) return null;

  const waiting = remarks.open.length;

  return (
    <button
      type="button"
      className="jd-tool jd-remarks-button"
      aria-label={waiting === 0 ? "What your agent has said" : `${waiting} waiting`}
      onClick={() => remarks.setDrawer(true)}
    >
      <Icon name="remarks" />
      {waiting > 0 && <span aria-hidden className="jd-remarks-count">{waiting}</span>}
    </button>
  );
}
