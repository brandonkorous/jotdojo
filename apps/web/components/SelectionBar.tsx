"use client";

import { Download, Trash2 } from "lucide-react";
import { MARKER_COLORS, PEN_COLORS } from "@/lib/ink-style";
import { PenSize } from "./PenSize";
import type { SelectionSummary } from "@/lib/ink-engine";
import { Swatches } from "./ToolOptions";

/**
 * What you can do with a lasso selection. ADR-033, ADR-045.
 *
 * Selecting used to do two things nobody could discover: drag to move, and
 * press Delete. Both still work. This says so, and adds the thing a selection
 * is actually for -- changing your mind about how something looks after you
 * have drawn it.
 *
 * The palettes shown depend on WHAT was caught. A highlighter recoloured to ink
 * is a grey smear, so the marker palette appears whenever the lasso holds one.
 */
export function SelectionBar({
  selection, onColor, onWidth, onCommitWidth, onDelete, onExport,
}: {
  selection: SelectionSummary;
  onColor: (color: string) => void;
  /** Called all the way through a drag, so the strokes fatten under the thumb
   *  instead of after it. */
  onWidth: (width: number) => void;
  onCommitWidth: (width: number) => void;
  onDelete: () => void;
  /** Save just this, as a picture. A diagram on a page of notes is usually the
   *  part somebody wants to send. ADR-067. */
  onExport: () => void;
}) {
  if (selection.count === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Selected strokes"
      className="jd-chrome glass jd-selection-bar bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full p-1"
    >
      <span className="jd-selection-count">
        {selection.count === 1 ? "1 stroke" : `${selection.count} strokes`}
      </span>

      <span aria-hidden className="jd-rail-sep-v" />

      {selection.pen && (
        <Swatches label="Recolour" colors={PEN_COLORS} onPick={onColor} />
      )}
      {selection.marker && (
        <Swatches label="Recolour highlight" colors={MARKER_COLORS} onPick={onColor} marker />
      )}

      {/* Width is a pen idea. A marker has one, on purpose (docs/08), so the
          control is not offered for a selection that holds only markers. */}
      {selection.pen && selection.penWidth !== null && (
        <>
          <span aria-hidden className="jd-rail-sep-v" />
          <PenSize
            label="Resize"
            width={selection.penWidth}
            color="var(--color-base-content)"
            onWidth={onWidth}
            onCommit={onCommitWidth}
          />
        </>
      )}

      <span aria-hidden className="jd-rail-sep-v" />

      <button
        type="button"
        className="jd-tool"
        title="Save as an image"
        aria-label="Save selection as an image"
        onClick={onExport}
      >
        <Download aria-hidden strokeWidth={1.75} />
      </button>

      <button
        type="button"
        className="jd-tool jd-tool-danger"
        title="Delete  ⌫"
        aria-label="Delete selection"
        onClick={onDelete}
      >
        <Trash2 aria-hidden strokeWidth={1.75} />
      </button>
    </div>
  );
}
