"use client";

import { useEffect, useState } from "react";
import {
  STICKER_GROUPS, type StickerGroup, type StickerName,
} from "@jotacular/domain/stickers";
import { STICKER_ART, STICKER_BORDER } from "@jotacular/ink-render";
import { PEN_COLORS } from "@/lib/ink-style";
import { Icon } from "@/components/Icon";

/**
 * The stickers you can reach for. ADR-115.
 *
 * A panel rather than a popover, which is the shape ToolOptions already
 * settled on for the same surface: this is a grid of sixty-five small targets,
 * and a menu that has to be navigated is a menu nobody finds on a surface whose
 * whole point is not stopping to think.
 *
 * CLOSED until asked for, and it closes on the first pick. Marking a page is
 * one thing at a time, and a tray that stayed open would cover the page it is
 * about to be used on.
 *
 * The colours are PEN_COLORS -- the house hues, not a palette invented here.
 * ink-cards.ts made the same call and says why.
 */
const HEADINGS: Record<StickerGroup, string> = {
  mark: "Mark it",
  face: "Faces",
  win: "Win and lose",
  work: "Work",
  life: "Life",
  shape: "Shapes",
};

export function StickerTray({
  open, onClose, onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (name: StickerName, color: string) => void;
}) {
  const [color, setColor] = useState(PEN_COLORS[0]!.color);

  // Escape closes it. A panel over the page that can only be dismissed by
  // finding its X reads as stuck, and this one covers what it is about to be
  // used on.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pick = (name: StickerName) => {
    onPick(name, color);
    onClose();
  };

  return (
    <>
      {/* Invisible, and only there to catch a tap outside. The page is not
          dimmed: this is a tray over a canvas, not a modal over a form. */}
      <button
        type="button"
        className="jd-sticker-scrim"
        aria-label="Close stickers"
        onClick={onClose}
      />
      <div
        className="jd-chrome glass jd-sticker-tray"
        role="dialog"
        aria-label="Stickers"
      >
        <div className="jd-sticker-tray-head">
          <div role="group" aria-label="Sticker colour" className="jd-menu-swatches">
            {PEN_COLORS.map((swatch) => (
              <button
                key={swatch.name}
                type="button"
                className="jd-tool jd-swatch"
                title={swatch.name}
                aria-label={swatch.name}
                aria-pressed={swatch.color === color}
                onClick={() => setColor(swatch.color)}
              >
                <span aria-hidden className="jd-chip" style={{ background: swatch.color }} />
              </button>
            ))}
          </div>
          <button type="button" className="jd-tool" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <div className="jd-sticker-tray-body">
          {(Object.keys(STICKER_GROUPS) as StickerGroup[]).map((group) => (
            <section key={group}>
              <h2 className="jd-sticker-group">{HEADINGS[group]}</h2>
              <div className="jd-sticker-grid">
                {STICKER_GROUPS[group].map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="jd-tool jd-sticker-pick"
                    title={name}
                    aria-label={name}
                    onClick={() => pick(name)}
                  >
                    <Glyph name={name} color={color} />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      </>
    );
}

/**
 * One sticker, previewed exactly as it will land.
 *
 * The same `paint-order` die-cut edge the plane and the exporter draw, so what
 * is in the tray is what goes on the page rather than a flat icon of it.
 */
function Glyph({ name, color }: { name: StickerName; color: string }) {
  const art = STICKER_ART[name];
  if (!art) return null;
  const longest = Math.max(art.w, art.h);
  return (
    <svg
      className="jd-sticker-glyph"
      viewBox={`0 0 ${art.w} ${art.h}`}
      style={{ width: `${(art.w / longest).toFixed(4)}em`, height: `${(art.h / longest).toFixed(4)}em` }}
      focusable="false"
      aria-hidden
    >
      <path
        d={art.d}
        fill={color}
        stroke="#FFFFFF"
        strokeWidth={STICKER_BORDER * 2 * longest}
        strokeLinejoin="round"
        paintOrder="stroke fill"
      />
    </svg>
  );
}
