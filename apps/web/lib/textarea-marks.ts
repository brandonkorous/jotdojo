import type { Span } from "./markdown-marks";

/**
 * Apply a mark to whatever is selected in a real textarea. ADR-045.
 *
 * The rules live in markdown-marks.ts and are pure; this is the twenty lines
 * that know about the DOM, kept apart so the rules stay testable without one.
 *
 * Returns the new text for the caller to put through its own change handler --
 * it never writes `el.value` directly, because the value belongs to React and
 * the autosave queue is watching it.
 */
export function applyToTextarea(
  el: HTMLTextAreaElement, rule: (span: Span) => Span,
): string {
  const next = rule({ text: el.value, start: el.selectionStart, end: el.selectionEnd });

  /**
   * The caret is restored after the re-render, not before it.
   *
   * React writes `value` on the next commit, and writing it resets the caret to
   * the end -- so setting the range now would put it back and then lose it, and
   * the person would be typing at the bottom of their note.
   */
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(next.start, next.end);
  });

  return next.text;
}
