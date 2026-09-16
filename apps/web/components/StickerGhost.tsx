"use client";

import { useEffect, useState } from "react";
import { STICKER_ART, STICKER_BORDER } from "@jotacular/ink-render";
import { STICKER_FRACTION, type ArmedSticker } from "@/lib/ink-sticker-layer";

/**
 * The loaded sticker, following the pointer. ADR-115.
 *
 * NOT ON TOUCH, and that is the whole reason this is a separate component
 * rather than three lines in the plane. A finger has no hover: there is nothing
 * to follow until it lands, and a ghost drawn under a fingertip would cover the
 * thing it is about to mark. On a phone the tap IS the preview.
 *
 * It costs no camera arithmetic. A new sticker is a fraction of the shorter
 * side of the surface DIVIDED BY THE ZOOM, so its size on the glass is the same
 * at every zoom -- which makes this a plain fixed-position element at a plain
 * pixel size, and makes it exactly as big as the thing it is about to become.
 * `.jd-canvas-shell` is `100dvh` by `100%`, so the viewport is that surface.
 */
export function StickerGhost({ armed }: { armed: ArmedSticker | null }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!armed) {
      setAt(null);
      return;
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") setAt(null);
      else setAt({ x: e.clientX, y: e.clientY });
    };
    // Off the window entirely. Without this it is left stranded at the edge,
    // over a page nobody is pointing at any more.
    const gone = () => setAt(null);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerleave", gone);
    window.addEventListener("blur", gone);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", gone);
      window.removeEventListener("blur", gone);
    };
  }, [armed]);

  if (!armed || !at) return null;
  const art = STICKER_ART[armed.name];
  if (!art) return null;

  const size = Math.min(window.innerWidth, window.innerHeight) * STICKER_FRACTION;
  const longest = Math.max(art.w, art.h);
  return (
    <svg
      className="jd-sticker-ghost"
      viewBox={`0 0 ${art.w} ${art.h}`}
      style={{
        // Centred on the pointer, because that is where it lands.
        left: at.x,
        top: at.y,
        width: (art.w / longest) * size,
        height: (art.h / longest) * size,
      }}
      aria-hidden
      focusable="false"
    >
      <path
        d={art.d}
        fill={armed.color}
        stroke="#FFFFFF"
        strokeWidth={STICKER_BORDER * 2 * longest}
        strokeLinejoin="round"
        paintOrder="stroke fill"
      />
    </svg>
  );
}
