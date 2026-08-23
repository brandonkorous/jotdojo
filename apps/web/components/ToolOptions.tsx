"use client";

import { Bold, Italic, Underline, X } from "lucide-react";
import type { CanvasTool } from "@/lib/canvas-tool";
import type { Block, Mark } from "@/lib/markdown-marks";
import {
  MARKER_COLORS, PEN_COLORS, PEN_WIDTHS, type InkStyles,
} from "@/lib/ink-style";

/**
 * What the CURRENT tool can be set to. ADR-045.
 *
 * A second pill under the rail rather than a popover: the options are three to
 * eight small controls, and a menu that has to be opened is a menu nobody finds
 * on a surface where the whole point is not stopping to think.
 *
 * It renders nothing at all for the eraser and for select. The eraser has no
 * settings, and everything you can do to a selection belongs ON the selection,
 * where the strokes are.
 *
 * It is CLOSED until asked for. Picking up a pen is not a request to see the
 * palette -- tapping the pen you are already holding is. Left open by default
 * it occupies the band across the top of the page where the next line of
 * handwriting was going to go, which on a phone is most of the page.
 */

const BLOCKS: { id: Block; label: string; hint: string }[] = [
  { id: "body", label: "Body", hint: "Body text" },
  { id: "h1", label: "H1", hint: "Heading" },
  { id: "h2", label: "H2", hint: "Subheading" },
];

const MARKS: { id: Mark; label: string; Icon: typeof Bold; key: string }[] = [
  { id: "bold", label: "Bold", Icon: Bold, key: "B" },
  { id: "italic", label: "Italic", Icon: Italic, key: "I" },
  { id: "underline", label: "Underline", Icon: Underline, key: "U" },
];

export function ToolOptions({
  tool, styles, block, open, onClose, onStyle, onMark, onBlock,
}: {
  tool: CanvasTool;
  styles: InkStyles;
  /** The heading level the caret is in, so the three read as one setting. */
  block?: Block;
  /** Closed until asked for. Picking a pen is not a request to see the palette
   *  -- tapping the pen you are already holding is. */
  open: boolean;
  onClose: () => void;
  onStyle: (tool: "pen" | "highlighter", patch: { color?: string; width?: number }) => void;
  onMark?: (mark: Mark) => void;
  onBlock?: (block: Block) => void;
}) {
  if (tool === "eraser" || tool === "select") return null;
  if (!open) return null;

  return (
    <div className="jd-chrome glass jd-tool-options top-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full p-1">
      {tool === "text" && (
        <>
          <nav aria-label="Formatting" className="flex items-center gap-0.5">
            {MARKS.map(({ id, label, Icon, key }) => (
              <button
                key={id}
                type="button"
                className="jd-tool"
                title={`${label}  ⌘${key}`}
                aria-label={label}
                onClick={() => onMark?.(id)}
              >
                <Icon aria-hidden strokeWidth={1.75} />
              </button>
            ))}
          </nav>
          <span aria-hidden className="jd-rail-sep-v" />
          <nav aria-label="Text size" className="flex items-center gap-0.5">
            {BLOCKS.map(({ id, label, hint }) => (
              <button
                key={id}
                type="button"
                className={`jd-tool jd-tool-text ${block === id ? "jd-tool-active" : ""}`}
                title={hint}
                aria-label={hint}
                aria-pressed={block === id}
                onClick={() => onBlock?.(id)}
              >
                {label}
              </button>
            ))}
          </nav>
        </>
      )}

      {tool === "pen" && (
        <>
          <Swatches
            label="Pen colour"
            colors={PEN_COLORS}
            current={styles.pen.color}
            onPick={(color) => onStyle("pen", { color })}
          />
          <span aria-hidden className="jd-rail-sep-v" />
          <nav aria-label="Pen size" className="flex items-center gap-0.5">
            {PEN_WIDTHS.map(({ name, width }) => (
              <button
                key={name}
                type="button"
                className={`jd-tool ${styles.pen.width === width ? "jd-tool-active" : ""}`}
                title={name}
                aria-label={name}
                aria-pressed={styles.pen.width === width}
                onClick={() => onStyle("pen", { width })}
              >
                {/* The control is the thing it does: a dot the size of the line. */}
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

      {tool === "highlighter" && (
        <Swatches
          label="Highlighter colour"
          colors={MARKER_COLORS}
          current={styles.highlighter.color}
          onPick={(color) => onStyle("highlighter", { color })}
          marker
        />
      )}

      <span aria-hidden className="jd-rail-sep-v" />
      <button
        type="button"
        className="jd-tool"
        title="Done"
        aria-label="Hide these options"
        onClick={onClose}
      >
        <X aria-hidden strokeWidth={1.75} />
      </button>
    </div>
  );
}

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
            style={{ background: color }}
          />
        </button>
      ))}
    </nav>
  );
}
