"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useLine, useStanding } from "@/lib/live-feed";

/**
 * The one line at the foot of the canvas. ADR-061.
 *
 * Small on purpose, and in the same place every time. It is read at a glance
 * and then ignored, which is the only honest brief for status on a page that
 * somebody is trying to think on.
 *
 * It OPENS rather than growing: the line is the summary, and what is behind it
 * is whatever is outstanding -- the agent's remarks, what the machine read from
 * the handwriting. Nothing that can be acted on is only ever a line.
 */
export function LiveFeed() {
  const line = useLine();
  const standing = useStanding();
  const [open, setOpen] = useState(false);

  const behind = standing.filter((s) => s.detail !== undefined);
  const openable = behind.length > 0;
  useEffect(() => { if (!openable) setOpen(false); }, [openable]);

  if (!line) return null;

  // Counted from what opening would ACTUALLY show. A standing entry with no
  // detail -- "reading your handwriting" -- is not a thing behind the line.
  const more = behind.length - 1;

  return (
    <div className="jd-live-dock">
      {open && (
        <div className="jd-live-open glass">
          {behind.map((s) => (
            <div key={s.id} className="jd-live-item">{s.detail}</div>
          ))}
        </div>
      )}

      <div className="jd-live glass" data-tone={line.tone}>
        <span aria-hidden className="jd-live-dot" data-tone={line.tone} />
        <p role="status" aria-live="polite" className="jd-live-text">{line.line}</p>

        {openable && (
          <button
            type="button"
            className="jd-live-more"
            aria-expanded={open}
            onClick={() => setOpen((was) => !was)}
          >
            {more > 0 && !open ? `+${more}` : null}
            <Icon
              name="collapse"
              className={open ? "jd-live-chevron jd-live-chevron-open" : "jd-live-chevron"}
            />
            <span className="sr-only">{open ? "Hide what is waiting" : "Show what is waiting"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
