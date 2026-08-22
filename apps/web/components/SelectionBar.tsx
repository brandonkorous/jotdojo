"use client";

import { Trash2 } from "lucide-react";
import { MARKER_COLORS, PEN_COLORS, PEN_WIDTHS } from "@/lib/ink-style";
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
  selection, onColor, onWidth, onDelete,
}: {
  selection: SelectionSummary;
  onColor: (color: string) => void;
  onWidth: (width: number) => void;
  onDelete: () => void;
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
      {selection.pen && (
        <>
          <span aria-hidden className="jd-rail-sep-v" />
          <nav aria-label="Resize" className="flex items-center gap-0.5">
            {PEN_WIDTHS.map(({ name, width }) => (
              <button
                key={name}
                type="button"
                className="jd-tool"
                title={name}
                aria-label={name}
                onClick={() => onWidth(width)}
              >
                <span
                  aria-hidden
                  className="jd-nib"
                  style={{ width: `${width * 2.4}px`, height: `${width * 2.4}px` }}
                />
              </button>
            ))}
          </nav>
        </>
      )}

      <span aria-hidden className="jd-rail-sep-v" />

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
