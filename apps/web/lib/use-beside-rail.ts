"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

const GAP = 10;
const EDGE = 12;

/**
 * Where a tool's options pop out: beside that tool's own button on the rail,
 * on the side away from the screen edge, as the `+` and Select menus do.
 * ADR-123. Hidden until measured, so it never flashes somewhere else first.
 */
export function useBesideRail(
  pill: RefObject<HTMLElement | null>, tool: string, open: boolean,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => setStyle(measure(pill.current, tool));
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [pill, tool, open]);

  return style;
}

/** In the pill's own positioned parent, which is the canvas or the hero. */
function measure(el: HTMLElement | null, tool: string): CSSProperties {
  const host = el?.offsetParent as HTMLElement | null;
  const rail = host?.querySelector<HTMLElement>(".jd-side-rail");
  const button = rail?.querySelector<HTMLElement>(`[data-mode="${tool}"]`);
  if (!el || !host || !rail || !button) return { visibility: "hidden" };
  const h = host.getBoundingClientRect();
  const b = button.getBoundingClientRect();
  const w = el.offsetWidth;
  const onLeft = rail.dataset.side !== "right";
  const x = onLeft ? b.right - h.left + GAP : b.left - h.left - GAP - w;
  const fits = x >= EDGE && x + w <= h.width - EDGE;
  // No room beside it -- a phone's folded chip -- so drop below instead.
  if (!fits) {
    return { top: b.bottom - h.top + GAP, left: EDGE, maxWidth: h.width - EDGE * 2 };
  }
  // Never above the rail's own top, where the logo is. ADR-129.
  const floor = Math.max(EDGE, rail.getBoundingClientRect().top - h.top);
  const y = Math.min(Math.max(floor, b.top - h.top + b.height / 2 - el.offsetHeight / 2),
    h.height - el.offsetHeight - EDGE);
  return { top: y, left: x };
}
