"use client";

import { useCallback, useEffect, useState } from "react";
import type { StickerName } from "@jotacular/domain/stickers";
import type { CanvasTool } from "./canvas-tool";
import type { ArmedSticker } from "./ink-sticker-layer";

/**
 * Which sticker is in hand, and how to get out of holding one. ADR-115.
 *
 * Its own hook rather than three more fields on `use-canvas-tool.ts`, and the
 * seam is the same one `use-blank-tap.ts` sits on: this is a small machine with
 * its own escape route and its own idea of where to go back to, and the file
 * next door is about which of six modes is selected.
 *
 * A sticker is the only mode that carries a PAYLOAD. Every other tool is a
 * verb; this one is a verb and a noun, and the noun has to survive from the
 * tray to the tap.
 */
export function useStickerArm(
  tool: CanvasTool,
  setTool: (tool: CanvasTool) => void,
  startInk: () => void,
) {
  const [armed, setArmed] = useState<ArmedSticker | null>(null);
  /** What was in hand before the sticker borrowed the canvas. The same trick
   *  `aimTool` uses for an arrow, and for the same reason. ADR-108. */
  const [from, setFrom] = useState<CanvasTool>("text");

  const arm = (name: StickerName, color: string) => {
    // Only remember the tool the FIRST time. Picking a second sticker while
    // holding one must not record "sticker" as the way back.
    if (tool !== "sticker") setFrom(tool);
    startInk();
    setArmed({ name, color });
    setTool("sticker");
  };

  const disarm = useCallback(() => {
    setArmed(null);
    setTool(from);
  }, [from, setTool]);

  /**
   * Picking any other tool puts the sticker down.
   *
   * Watched rather than called, because the rail, the Add menu and the canvas
   * menu all reach `setTool` by different routes -- and a rule written at each
   * of them is a rule one of them will forget.
   */
  useEffect(() => {
    if (tool !== "sticker" && armed) setArmed(null);
  }, [tool, armed]);

  /** Escape, because a mode nobody can leave is a trap -- and this one changes
   *  what every tap on the page means. */
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") disarm(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed, disarm]);

  return {
    armed,
    arm,
    disarm,
    /** What the rail should light up. `sticker` has no button of its own, so it
     *  shows the tool it is about to hand back -- the call ToolRail already
     *  makes for `textbox`. */
    railTool: tool === "sticker" ? from : tool,
  };
}
