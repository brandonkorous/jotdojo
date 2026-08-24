"use client";

import { useEffect, type RefObject } from "react";

/**
 * The typing surface. ADR-008, ADR-102.
 *
 * It is the SPINE: a tap lands here and the words go in, which is what keeps
 * capture under 300ms (docs/02). It is a real `<textarea>` for every reason
 * markdown-marks.ts lists -- Scribble, IME, paste, native undo, spellcheck.
 *
 * IT IS SIZED TO WHAT IS IN IT, and that is the part worth knowing. It used to
 * be 100% of a 100dvh shell, so a page with four words on it was still a text
 * field from edge to edge -- and every hold, every right-click and every empty
 * inch of "canvas" belonged to the textarea. There was no blank paper to put a
 * menu on because there was no blank paper.
 *
 * A long note fills the screen again and scrolls its own words, which is
 * correct: by then there is no blank paper, because somebody used it.
 */
export function Spine({
  input, value, placeholder, readOnly, autoFocus, onChange, onSelect, onKeyDown,
}: {
  input: RefObject<HTMLTextAreaElement | null>;
  value: string;
  placeholder: string;
  readOnly: boolean;
  autoFocus: boolean;
  onChange: (value: string) => void;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  // Measured after every change: `scrollHeight` is only honest once the height
  // is released, so it is cleared and re-read rather than compared.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, input]);

  /**
   * A hold on words is the SYSTEM's gesture, and the right one to keep.
   *
   * The canvas menu triggers on the shell above this, so without stopping the
   * event here a long press on a half-written sentence would offer to delete a
   * selection instead of offering to select a word. ADR-084 made the same call
   * for notes on the plane, for the same reason.
   */
  const keep = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="jd-spine px-5 pt-16 pb-10 sm:px-8">
      <textarea
        ref={input}
        autoFocus={autoFocus}
        readOnly={readOnly}
        className="jd-canvas-input font-sans"
        placeholder={placeholder}
        aria-label="Note"
        spellCheck
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={onSelect}
        onKeyDown={onKeyDown}
        onContextMenu={keep}
        onPointerDown={keep}
      />
    </div>
  );
}
