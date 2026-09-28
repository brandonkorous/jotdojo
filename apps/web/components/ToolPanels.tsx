"use client";

import { Icon } from "@/components/Icon";
import type { IconName } from "@/lib/icons";
import type { Block, Mark } from "@/lib/markdown-marks";
import { MARKER_COLORS, PEN_COLORS, type InkStyles } from "@/lib/ink-style";
import { useModKey } from "@/lib/mod-key";
import { PenSize } from "./PenSize";
import { Swatches } from "./Swatches";

/**
 * What each tool can be set to, as a panel in the same card as the `+` and
 * Select menus: small headings, then the controls under them. ADR-124.
 */

const BLOCKS: { id: Block; label: string }[] = [
  { id: "h1", label: "Heading" },
  { id: "h2", label: "Subheading" },
  { id: "body", label: "Body text" },
];

const MARKS: { id: Mark; label: string; icon: IconName; key: string }[] = [
  { id: "bold", label: "Bold", icon: "bold", key: "B" },
  { id: "italic", label: "Italic", icon: "italic", key: "I" },
  { id: "underline", label: "Underline", icon: "underline", key: "U" },
];

export function TextPanel({ block, onMark, onBlock }: {
  block?: Block;
  onMark?: (mark: Mark) => void;
  onBlock?: (block: Block) => void;
}) {
  const mod = useModKey();
  return (
    <>
      <p className="jd-options-label">Style</p>
      <nav aria-label="Formatting" className="jd-options-row">
        {MARKS.map(({ id, label, icon, key }) => (
          <button key={id} type="button" className="jd-tool" title={`${label}  ${mod}${key}`}
            aria-label={label} onClick={() => onMark?.(id)}>
            <Icon name={icon} />
          </button>
        ))}
      </nav>
      <p className="jd-options-label">Size</p>
      <nav aria-label="Text size">
        {BLOCKS.map(({ id, label }) => (
          <button key={id} type="button" aria-pressed={block === id} data-block={id}
            className="dropdown-item jd-options-item" onClick={() => onBlock?.(id)}>
            <span>{label}</span>
            {block === id && <Icon name="check" />}
          </button>
        ))}
      </nav>
    </>
  );
}

export function PenPanel({ styles, onStyle }: {
  styles: InkStyles;
  onStyle: (tool: "pen", patch: { color?: string; width?: number }) => void;
}) {
  return (
    <>
      <p className="jd-options-label">Colour</p>
      <Swatches label="Pen colour" colors={PEN_COLORS} current={styles.pen.color}
        onPick={(color) => onStyle("pen", { color })} />
      <p className="jd-options-label">Size</p>
      <PenSize label="Pen size" width={styles.pen.width} color={styles.pen.color}
        onWidth={(width) => onStyle("pen", { width })} />
    </>
  );
}

export function MarkerPanel({ styles, onStyle }: {
  styles: InkStyles;
  onStyle: (tool: "highlighter", patch: { color?: string }) => void;
}) {
  return (
    <>
      <p className="jd-options-label">Colour</p>
      <Swatches label="Highlighter colour" colors={MARKER_COLORS} marker
        current={styles.highlighter.color} onPick={(color) => onStyle("highlighter", { color })} />
    </>
  );
}
