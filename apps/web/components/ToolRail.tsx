"use client";

import {
  Type, PenLine, Highlighter, Eraser, Lasso, Mic, Camera, type LucideIcon,
} from "lucide-react";
import { isInk, type CanvasTool, type InkTool } from "@/lib/canvas-tool";

/**
 * The tools, once, so the app and the marketing hero cannot drift apart.
 *
 * The hero is a real canvas (ADR-010), and a hero wearing a different toolbar
 * would be advertising a product that does not exist. Same icons, same order,
 * same classes -- the only difference is which of them a stranger may use.
 *
 * These were Unicode characters until Inter turned out to serve none of them:
 * every glyph fell through to a system font, and U+270E has an emoji
 * presentation variant, so the pen rendered in colour on Apple platforms. ADR-044.
 */

type Spec = {
  id: CanvasTool | "mic" | "cam";
  label: string;
  Icon: LucideIcon;
  /** An action opens something. A mode changes what the canvas does, and only
   *  a mode can be `aria-pressed`. */
  action?: boolean;
};

const TOOLS: Spec[] = [
  { id: "text", label: "Text", Icon: Type },
  { id: "pen", label: "Handwriting", Icon: PenLine },
  { id: "highlighter", label: "Highlighter", Icon: Highlighter },
  { id: "eraser", label: "Eraser", Icon: Eraser },
  // A lasso, not a marquee: the tool selects whole strokes by enclosing them.
  { id: "select", label: "Select", Icon: Lasso },
  { id: "mic", label: "Voice", Icon: Mic, action: true },
  { id: "cam", label: "Photo", Icon: Camera, action: true },
];

/** Lucide draws at 24px with a 2px stroke. At the size these actually render,
 *  that reads as a marker pen next to Inter; 1.75 sits with the text. */
const STROKE = 1.75;

export function ToolRail({
  tool, onTool, onAction, unavailable = [], unavailableHint,
}: {
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  onAction?: (id: "mic" | "cam") => void;
  /** Shown, but refused. A stranger sees the whole product and is told plainly
   *  which parts need an account, rather than being shown a shorter one. */
  unavailable?: readonly string[];
  unavailableHint?: string;
}) {
  return (
    <nav aria-label="Tools" className="flex items-center gap-0.5">
      {TOOLS.map(({ id, label, Icon, action }) => {
        const off = unavailable.includes(id);
        const hint = off && unavailableHint ? `${label} — ${unavailableHint}` : label;
        return (
          <button
            key={id}
            type="button"
            disabled={off}
            title={hint}
            aria-label={hint}
            aria-pressed={!action && !off ? id === tool : undefined}
            onClick={() => {
              if (off) return;
              if (action) onAction?.(id as "mic" | "cam");
              else onTool(id as CanvasTool);
            }}
            className={`jd-tool ${id === tool ? "jd-tool-active" : ""}`}
          >
            <Icon aria-hidden strokeWidth={STROKE} />
          </button>
        );
      })}
    </nav>
  );
}

/** Which ink tool the engine should hold. `text` is not one, but unmounting the
 *  ink layer to say so would orphan everything already drawn. */
export const inkToolFor = (tool: CanvasTool): InkTool => (isInk(tool) ? tool : "pen");
