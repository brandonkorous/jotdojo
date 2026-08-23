"use client";

import { Icon } from "@/components/Icon";
import type { IconName } from "@/lib/icons";
import type { CanvasTool } from "@/lib/canvas-tool";

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
 *
 * They are now Font Awesome Whiteboard, drawn with a marker rather than ruled.
 * Three of these seven are substitutions -- see `lib/icons.ts`. ADR-083.
 */

type Spec = {
  id: CanvasTool | "mic" | "cam";
  label: string;
  icon: IconName;
  /** An action opens something. A mode changes what the canvas does, and only
   *  a mode can be `aria-pressed`. */
  action?: boolean;
};

const TOOLS: Spec[] = [
  { id: "text", label: "Text", icon: "text" },
  { id: "pen", label: "Handwriting", icon: "pen" },
  { id: "highlighter", label: "Highlighter", icon: "highlighter" },
  { id: "eraser", label: "Eraser", icon: "eraser" },
  // A lasso, not a marquee: the tool selects whole strokes by enclosing them.
  { id: "select", label: "Select", icon: "select" },
  { id: "mic", label: "Voice", icon: "voice", action: true },
  { id: "cam", label: "Photo", icon: "photo", action: true },
];

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
      {TOOLS.map(({ id, label, icon, action }) => {
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
            <Icon name={icon} />
          </button>
        );
      })}
    </nav>
  );
}
