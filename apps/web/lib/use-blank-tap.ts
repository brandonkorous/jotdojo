import { useRef, type RefObject } from "react";
import { isInk, type CanvasTool } from "@/lib/canvas-tool";

/** Close enough to be a tap rather than a pan, in screen pixels. The same
 *  number ink-input-select.ts uses, for the same unsteady hand. */
const TAP_SLOP = 6;

/**
 * Blank paper still types. ADR-102.
 *
 * The spine is only as tall as its words now, so most of a fresh page is
 * canvas rather than text field -- and a tap on it has to mean what it has
 * always meant, or ADR-008's contract is broken to buy a menu.
 *
 * A TAP, not any pointer-up. The camera moves on this surface too, and a
 * two-finger pan that ended by opening the keyboard over the page somebody
 * had just panned to would be worse than the fence it replaced.
 */
export function useBlankTap(input: RefObject<HTMLTextAreaElement | null>, tool: CanvasTool) {
  const from = useRef<{ x: number; y: number } | null>(null);

  /** Only the target itself. A pointer-up that began on a child is that
   *  child's business, whatever it was. */
  const landed = (e: React.PointerEvent): boolean => {
    const began = from.current;
    from.current = null;
    if (!began || isInk(tool) || e.target !== e.currentTarget) return false;
    return Math.hypot(e.clientX - began.x, e.clientY - began.y) <= TAP_SLOP;
  };

  return {
    // A second finger means the camera, never the caret. Cleared rather than
    // tracked, so the gesture cannot end as a tap on the way out.
    onPointerDown: (e: React.PointerEvent) => {
      from.current = e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!landed(e)) return;
      const el = input.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    },
    onPointerCancel: () => { from.current = null; },
  };
}
