"use client";

import { useSyncExternalStore } from "react";
import { inkFor, paperIsDark, watchPaper } from "@/lib/ink-night";

/** A row of colours, each drawn as the ink it will lay down. ADR-045. */
export function Swatches({
  label, colors, current, onPick, marker = false,
}: {
  label: string;
  colors: readonly { name: string; color: string }[];
  current?: string;
  onPick: (color: string) => void;
  /** Drawn at the alpha it will actually paint at, so the swatch is not a
   *  promise the canvas breaks. */
  marker?: boolean;
}) {
  // The canvas paints inkFor(color) on a dark page, so the swatch must too --
  // that is the promise two comments in this file exist to keep. Issue 047.
  useSyncExternalStore(watchPaper, paperIsDark, () => false);

  return (
    <nav aria-label={label} className="flex items-center gap-0.5">
      {colors.map(({ name, color }) => (
        <button
          key={color}
          type="button"
          className={`jd-tool jd-swatch ${current === color ? "jd-swatch-on" : ""}`}
          title={name}
          aria-label={name}
          aria-pressed={current === color}
          onClick={() => onPick(color)}
        >
          <span
            aria-hidden
            className={marker ? "jd-chip jd-chip-marker" : "jd-chip"}
            style={{ background: inkFor(color) }}
          />
        </button>
      ))}
    </nav>
  );
}
