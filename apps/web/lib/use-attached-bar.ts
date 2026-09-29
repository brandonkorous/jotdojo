"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const GAP = 14;
const EDGE = 12;
/** Room kept clear at the top for the corner and the folded rail. */
const TOP_CLEAR = 64;

/**
 * Keep a bar attached to the selection it acts on: just below it, or above
 * when the page runs out. ADR-125. Every frame while shown, because a pan or a
 * drag moves the selection without React hearing about it; written straight
 * to the element's style, so a frame costs no render.
 */
export function useAttachedBar(
  bar: RefObject<HTMLElement | null>, locate: () => DOMRect | null, shown: boolean,
) {
  // Latest, not first: the engine behind it is only there after mount.
  const where = useRef(locate);
  useLayoutEffect(() => { where.current = locate; });
  useEffect(() => {
    if (!shown) return;
    let frame = 0;
    let last = "";
    const tick = () => {
      const el = bar.current;
      const r = where.current();
      const at = el && r ? place(el, r) : null;
      const key = at ? `${at.left}|${at.top}` : "none";
      if (el && key !== last) {
        last = key;
        el.style.visibility = at ? "visible" : "hidden";
        if (at) { el.style.left = `${at.left}px`; el.style.top = `${at.top}px`; }
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [bar, shown]);
}

/** Where the bar goes, in its positioned parent's own coordinates. */
export function place(el: HTMLElement, sel: DOMRect): { left: number; top: number } | null {
  const host = (el.offsetParent as HTMLElement | null)?.getBoundingClientRect();
  if (!host) return null;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const below = sel.bottom - host.top + GAP;
  const above = sel.top - host.top - GAP - h;
  let top = below + h <= host.height - EDGE ? below : above;
  // Neither fits -- the selection fills the screen -- so sit on the bottom edge.
  if (top < TOP_CLEAR) top = host.height - EDGE - h;
  const centre = sel.left + sel.width / 2 - host.left;
  const left = Math.min(Math.max(EDGE, centre - w / 2), host.width - EDGE - w);
  return { left: Math.round(left), top: Math.round(top) };
}
