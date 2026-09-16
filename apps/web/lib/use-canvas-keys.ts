"use client";

import { useEffect, type RefObject } from "react";
import type { InkEngine } from "./ink-engine";

/**
 * The keyboard, on a surface that has no focus of its own. ADR-109, ADR-110.
 *
 * Split out of InkCanvas.tsx when undo and the clipboard tripled the number of
 * keys the page answers to. The seam is a real one: the component mounts
 * canvases and renders furniture, and this is a list of what each chord means.
 *
 * BOUND ON THE WINDOW, not the canvas. A canvas is not focusable, and giving
 * the drawing surface a tabindex would put a focus ring round the page every
 * time somebody picked up the pen.
 *
 * NOTHING HERE FIRES WHILE SOMETHING IS BEING TYPED INTO. A text box on the
 * plane is a real `<textarea>` with the browser's own undo, its own selection
 * and its own clipboard, and all three are better than ours inside it.
 */
export function useCanvasKeys(engine: RefObject<InkEngine | null>, selected: number) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing()) return;
      const held = engine.current;
      if (!held) return;
      if (act(held, e, selected)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, selected]);
}

/** Whether the caret is somewhere that owns these keys already. */
function typing(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement
    && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
}

/**
 * What this chord does, and whether it did anything.
 *
 * Returning false rather than preventing the default is what keeps the browser
 * shortcuts we have not claimed: Ctrl+R still reloads, and Ctrl+P still prints.
 */
function act(engine: InkEngine, e: KeyboardEvent, selected: number): boolean {
  // Cmd on a Mac, Ctrl everywhere else. Reading both is not a guess about the
  // platform -- no browser reports Cmd as `ctrlKey`, so the two never collide.
  const mod = e.metaKey || e.ctrlKey;

  if (!mod) {
    if (e.key === "Escape") return engine.links?.aiming
      ? (engine.links.cancelAim(), true)
      : false;
    if (e.key !== "Delete" && e.key !== "Backspace") return false;
    if (selected === 0) return false;
    engine.selection.remove();
    return true;
  }

  const key = e.key.toLowerCase();
  // Shift+Z as well as Y: the first is what a Mac does and the second is what
  // Windows does, and a person should not have to know which one we chose.
  if (key === "z" && e.shiftKey) return engine.doc.redo();
  if (key === "z") return engine.doc.undo();
  if (key === "y") return engine.doc.redo();
  if (key === "c") return engine.doc.copy();
  if (key === "x") return engine.doc.copy() && (engine.selection.remove(), true);
  if (key === "v") return engine.doc.paste();
  if (key === "d") return engine.doc.duplicate();
  return false;
}
