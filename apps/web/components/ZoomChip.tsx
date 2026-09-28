"use client";

import { Icon } from "@/components/Icon";

/** One press of − or +: the same step each way, so in and back out returns. */
const STEP = 1.25;

/**
 * The zoom bar, bottom corner: out, the readout, in. ADR-124.
 *
 * Always there, because a zoom control people look for and cannot see is not
 * there at all. The readout is still the way back (ADR-053): tapping it
 * frames the writing again, which is what it did when it was the whole chip.
 */
export function ZoomChip({
  zoom, home, onFit, onZoom,
}: {
  zoom: number;
  /** Whether the camera sits exactly where a fresh page opens. */
  home: boolean;
  onFit: () => void;
  onZoom: (factor: number) => void;
}) {
  const percent = Math.round(zoom * 100);

  return (
    <div className="jd-chrome glass jd-ink-zoom" role="group" aria-label="Zoom">
      <button type="button" className="jd-tool" onClick={() => onZoom(1 / STEP)}
        title="Zoom out" aria-label="Zoom out">
        <Icon name="zoomOut" />
      </button>
      <button
        type="button"
        className="jd-zoom-readout"
        onClick={onFit}
        disabled={home}
        title="Fit the writing to the screen"
        aria-label={`Zoomed to ${percent} percent. Fit the writing to the screen.`}
      >
        {percent}%
      </button>
      <button type="button" className="jd-tool" onClick={() => onZoom(STEP)}
        title="Zoom in" aria-label="Zoom in">
        <Icon name="zoomIn" />
      </button>
    </div>
  );
}
