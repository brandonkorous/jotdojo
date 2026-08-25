"use client";

import { Icon } from "@/components/Icon";
import { useRemarks } from "@/lib/remarks";

/**
 * The way to the comments on this page. ADR-061, ADR-107.
 *
 * The line only speaks while there is something to say, so on its own it is no
 * use to somebody asking "what did it tell me last week". This sits in the
 * chrome, which is always there.
 *
 * It used to appear only once an agent had spoken, on the grounds that a
 * button for a conversation nobody had had teaches nothing. Since ADR-107 a
 * person can start that conversation, and this is the door -- so it is always
 * here on a canvas.
 */
export function RemarksButton() {
  const remarks = useRemarks();
  if (!remarks) return null;

  const waiting = remarks.open.length;

  return (
    <button
      type="button"
      className="jd-tool jd-remarks-button"
      aria-label={waiting === 0 ? "Comments on this page" : `${waiting} waiting`}
      onClick={() => remarks.setDrawer(true)}
    >
      <Icon name="remarks" />
      {waiting > 0 && <span aria-hidden className="jd-remarks-count-chip">{waiting}</span>}
    </button>
  );
}
