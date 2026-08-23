"use client";

import { useRef } from "react";
import {
  PEN_WIDTH_MIN, sliderFromWidth, widthFromSlider,
} from "@/lib/ink-style";

/**
 * How thick the pen draws. ADR-045, ADR-059.
 *
 * A slider rather than three buttons, because the canvas has no edges to be
 * medium against: a mark that is a title beside one paragraph is a footnote
 * two screens out, and only the person writing knows which they meant.
 *
 * The nib beside it is painted at the real width in the real colour, so the
 * control is the thing it does -- until the dot would outgrow the pill it
 * sits in, at which point the number carries the rest.
 */

/** Steps across the whole range. Geometric travel makes each one a ~4% change
 *  in width, which is about as fine as a thumb can aim anyway. */
const STEPS = 100;
const NIB_MAX = 22;

export function PenSize({
  label, width, color, onWidth, onCommit,
}: {
  label: string;
  width: number;
  /** The ink it will actually lay down, not a neutral grey stand-in. */
  color: string;
  onWidth: (width: number) => void;
  /** Called once when the thumb is let go, for callers to whom a drag is one
   *  edit rather than fifty. Local state has no use for it. */
  onCommit?: (width: number) => void;
}) {
  const dot = Math.min(NIB_MAX, Math.max(PEN_WIDTH_MIN * 4, width));
  // Only a drag is worth publishing. Focusing the slider and tabbing away is
  // not an edit, and committing then would write back a width nobody chose.
  const dragged = useRef<number | null>(null);
  const commit = () => {
    if (dragged.current === null) return;
    onCommit?.(dragged.current);
    dragged.current = null;
  };

  return (
    <div className="jd-pen-size">
      <span aria-hidden className="jd-nib-well">
        <span
          className="jd-nib"
          style={{ width: `${dot}px`, height: `${dot}px`, background: color }}
        />
      </span>
      <input
        type="range"
        className="jd-size-slider"
        min={0}
        max={STEPS}
        step={1}
        value={Math.round(sliderFromWidth(width) * STEPS)}
        aria-label={label}
        aria-valuetext={`${width} pixels`}
        onChange={(e) => {
          dragged.current = widthFromSlider(Number(e.target.value) / STEPS);
          onWidth(dragged.current);
        }}
        onPointerUp={commit}
        onPointerCancel={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span aria-hidden className="jd-size-read">{width}</span>
    </div>
  );
}
