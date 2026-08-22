"use client";

/**
 * The zoom readout, and the way back.
 *
 * Not decoration. The canvas is endless and unclamped, so someone can pan into
 * blank paper until there is no ink on screen and nothing to steer by. Tapping
 * this frames the writing again. ADR-053.
 *
 * Hidden at home, because a page nobody has moved has nowhere to go back to.
 */
export function ZoomChip({
  zoom, home, onFit,
}: {
  zoom: number;
  /** Whether the camera sits exactly where a fresh page opens. */
  home: boolean;
  onFit: () => void;
}) {
  if (home) return null;
  const percent = Math.round(zoom * 100);

  return (
    <button
      type="button"
      className="jd-chrome glass jd-ink-zoom"
      onClick={onFit}
      title="Fit the writing to the screen"
      aria-label={`Zoomed to ${percent} percent. Fit the writing to the screen.`}
    >
      {percent}%
    </button>
  );
}
