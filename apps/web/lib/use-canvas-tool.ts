"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { isInk, type CanvasTool } from "./canvas-tool";
import { DEFAULT_STYLES, type InkStyles } from "./ink-style";
import { rememberedTool, rememberTool } from "./tool-memory";

/**
 * Which tool is in hand, what it is set to, and whether its options are open.
 *
 * Split out of Canvas.tsx at the size limit, and the seam is a real one: the
 * component is a page made of furniture, and this is one small state machine
 * with three rules that all have reasons somebody has to be able to find.
 */
export function useCanvasTool(input: RefObject<HTMLTextAreaElement | null>, hasInk: boolean) {
  const [tool, setTool] = useState<CanvasTool>("text");
  /**
   * Mounted from the start when the page already HAS ink. Once ink exists it
   * stays, whatever the toolbar says: unmounting would start a NEW ink block on
   * the next pen tap and orphan everything already drawn -- the strokes would
   * still be in the database, attached to a block nothing renders. ADR-047.
   */
  const [inkStarted, setInkStarted] = useState(hasInk);
  const [optionsOpen, setOptionsOpen] = useState(false);
  /** Per tool, so the marker keeps its own colour instead of inheriting the
   *  pen's near-black and painting a grey smear. ADR-045. */
  const [styles, setStyles] = useState<InkStyles>(DEFAULT_STYLES);
  /** What was in hand before an arrow borrowed the select tool. */
  const borrowed = useRef<CanvasTool | null>(null);

  /**
   * The tool this device was last holding. ADR-101.
   *
   * After mount, not in the initial state: the server has no localStorage, so a
   * lazy initializer would render the spine's placeholder and autofocus on the
   * server and the pen's on the client -- a hydration mismatch on the one
   * element people type into.
   */
  useEffect(() => {
    const saved = rememberedTool();
    if (!isInk(saved)) return;
    setInkStarted(true);
    setTool(saved);
    // `autoFocus` already ran, and on a phone that means the keyboard is up
    // over a page somebody meant to draw on.
    input.current?.blur();
    // Once, on mount. A later change is the person's own choice, not a restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Picking a tool does not open its options; tapping it again does.
   *
   * The pill sits in the band across the top of the page, which on a phone is
   * where the next line was going to go. Reaching for the pen is not a request
   * to see the palette -- reaching for the pen you are already holding is.
   */
  const choose = (next: CanvasTool) => {
    if (isInk(next)) setInkStarted(true);
    setOptionsOpen(next === tool ? !optionsOpen : false);
    setTool(next);
    rememberTool(next);
  };

  /** Arm placing a note on the canvas. A one-shot, not a mode -- the engine
   *  hands the tool back to the spine the moment a box lands. ADR-065. */
  const armTextBox = () => {
    setOptionsOpen(false);
    setInkStarted(true);
    setTool("textbox");
  };

  /**
   * Aiming an arrow borrows the select tool, and gives it back. ADR-108.
   *
   * The menu exists on every tool (ADR-102), so "Draw an arrow from this" can
   * be asked while somebody is typing -- and the tap that finishes it has to
   * reach the canvas, which takes no pointers on the text tool. The rail
   * lighting up is also the only sign the mode is on.
   *
   * NOT `choose`: this is not the person picking a tool, so it must not be
   * remembered for next time and must not open a palette.
   */
  const aimTool = (on: boolean) => {
    if (on) {
      borrowed.current = tool;
      setInkStarted(true);
      return setTool("select");
    }
    // Back to whatever was in hand. Aiming is a one-shot rather than a mode
    // somebody has to remember to leave -- the call ADR-078 made for a box.
    const was = borrowed.current;
    borrowed.current = null;
    if (was && was !== "select") setTool(was);
  };

  const setStyle = (
    which: "pen" | "highlighter", patch: { color?: string; width?: number },
  ) => setStyles((all) => ({ ...all, [which]: { ...all[which], ...patch } }));

  return {
    tool, setTool, styles, setStyle, choose, armTextBox, aimTool,
    inkStarted, startInk: () => setInkStarted(true),
    optionsOpen, closeOptions: () => setOptionsOpen(false),
  };
}
