"use client";

import { useRef, useState } from "react";
import {
  blockAt, markForKey, setBlock, toggleMark, type Block, type Mark,
} from "./markdown-marks";
import { applyToTextarea } from "./textarea-marks";

/**
 * Formatting a typing surface, wired to one textarea. ADR-045.
 *
 * A hook rather than a copy in each component: the app canvas and the marketing
 * hero are the same writing surface, and two implementations of the same
 * keyboard shortcuts is how they stop being the same writing surface.
 *
 * The caller supplies its own change handler, so the text goes through whatever
 * autosave queue that surface already has instead of round a second path.
 */
export function useMarks(onText: (text: string) => void) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [block, setBlockState] = useState<Block>("body");

  const mark = (which: Mark) => {
    if (input.current) onText(applyToTextarea(input.current, (sp) => toggleMark(sp, which)));
  };

  const heading = (level: Block) => {
    if (!input.current) return;
    onText(applyToTextarea(input.current, (sp) => setBlock(sp, level)));
    setBlockState(level);
  };

  /** Which heading the caret is in, so the three size controls read as one
   *  setting rather than as three unrelated buttons. */
  const syncBlock = () => {
    const el = input.current;
    if (el) setBlockState(blockAt(el.value, el.selectionStart));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const which = markForKey(e.key, e.metaKey || e.ctrlKey);
    if (!which) return;
    // Otherwise Ctrl-B is "bold" to us and "bookmark" to Firefox at once.
    e.preventDefault();
    mark(which);
  };

  return { input, block, mark, heading, syncBlock, onKeyDown };
}
