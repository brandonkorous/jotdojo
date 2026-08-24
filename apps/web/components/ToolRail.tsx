"use client";

import { Icon } from "@/components/Icon";
import type { IconName } from "@/lib/icons";
import type { CanvasTool } from "@/lib/canvas-tool";

/**
 * The MODES, once, so the app and the marketing hero cannot drift apart.
 *
 * The hero is a real canvas (ADR-010), and a hero wearing a different toolbar
 * would be advertising a product that does not exist. Same icons, same order,
 * same classes -- the only difference is which of them a stranger may use.
 *
 * They are Font Awesome Whiteboard, drawn with a marker rather than ruled.
 * Three of these five are substitutions -- see `lib/icons.ts`. ADR-044, ADR-083.
 *
 * Voice and photo used to be here and are not modes: they produce content and
 * then finish, which is what the add menu is for. ADR-101.
 */

type Spec = { id: CanvasTool; label: string; icon: IconName };

const MODES: Spec[] = [
  { id: "text", label: "Text", icon: "text" },
  { id: "pen", label: "Handwriting", icon: "pen" },
  { id: "highlighter", label: "Highlighter", icon: "highlighter" },
  { id: "eraser", label: "Eraser", icon: "eraser" },
  // A lasso, not a marquee: the tool selects whole strokes by enclosing them.
  { id: "select", label: "Select", icon: "select" },
];

export function ToolRail({
  tool, onTool, open = true, unavailable = [], unavailableHint,
}: {
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  /**
   * Whether every mode is showing. Closed collapses to the one in hand, which
   * is how five buttons fit a phone. Always true above the breakpoint -- the
   * hiding is CSS, and this only decides what a tap MEANS. ADR-101.
   */
  open?: boolean;
  /** Shown, but refused. A stranger sees the whole product and is told plainly
   *  which parts need an account, rather than being shown a shorter one. */
  unavailable?: readonly string[];
  unavailableHint?: string;
}) {
  // `textbox` is armed from the text tool's options and has no button of its
  // own (ADR-065), so the chip keeps showing text while a box is being placed.
  const held = tool === "textbox" ? "text" : tool;

  return (
    <nav aria-label="Tools" data-open={open} className="jd-rail flex items-center gap-0.5">
      {MODES.map(({ id, label, icon }) => {
        const off = unavailable.includes(id);
        const hint = off && unavailableHint ? `${label} — ${unavailableHint}` : label;
        const active = id === held;
        return (
          <button
            key={id}
            type="button"
            disabled={off}
            title={hint}
            aria-label={hint}
            aria-pressed={off ? undefined : active}
            // Read by the collapsed chip's chevron, which is drawn in CSS so
            // there is no second button to hit by mistake.
            data-chip={active && !open ? "" : undefined}
            onClick={() => { if (!off) onTool(id); }}
            className={`jd-tool ${active ? "jd-tool-active" : ""}`}
          >
            <Icon name={icon} />
          </button>
        );
      })}
    </nav>
  );
}
