"use client";

import { useEffect, useRef } from "react";
import { useBesideRail } from "@/lib/use-beside-rail";
import type { CanvasTool } from "@/lib/canvas-tool";
import type { Block, Mark } from "@/lib/markdown-marks";
import type { InkStyles } from "@/lib/ink-style";
import { MarkerPanel, PenPanel, TextPanel } from "./ToolPanels";

/**
 * What the CURRENT tool can be set to. ADR-045, ADR-124.
 * A card beside the tool's button, in the same look as the `+` menu, closed
 * until the tool in hand is tapped again. Nothing for tools with no settings.
 */
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
  const card = useRef<HTMLDivElement>(null);
  const at = useBesideRail(card, tool, open);
  useDismiss(card, tool, open, onClose);
  if (tool !== "text" && tool !== "pen" && tool !== "highlighter") return null;
  if (!open) return null;

  return (
    <div ref={card} style={at} role="dialog" aria-label="Tool options"
      className="jd-chrome dropdown jd-tool-options">
      {tool === "text" && <TextPanel block={block} onMark={onMark} onBlock={onBlock} />}
      {tool === "pen" && <PenPanel styles={styles} onStyle={onStyle} />}
      {tool === "highlighter" && <MarkerPanel styles={styles} onStyle={onStyle} />}
    </div>
  );
}

/** Closed by a press anywhere else, or Escape, as a menu is. The tool's own
 *  button is left out: it toggles the card, and would reopen it. */
function useDismiss(
  card: React.RefObject<HTMLDivElement | null>, tool: string, open: boolean, onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const press = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || card.current?.contains(t) || t.closest(`[data-mode="${tool}"]`)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("keydown", key);
    };
  }, [card, tool, open, onClose]);
}
