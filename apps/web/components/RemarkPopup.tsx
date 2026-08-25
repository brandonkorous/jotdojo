"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Icon } from "@/components/Icon";
import type { InkEngine } from "@/lib/ink-engine";
import { anchorRect, placeBeside } from "@/lib/remark-anchor";
import { useRemarks } from "@/lib/remarks";
import { RemarkThread, threadTitle } from "./RemarkThread";

/**
 * The conversation about one thing, beside that thing. ADR-107.
 *
 * NOT in the drawer. A page can hold five unrelated notes, and reading what
 * somebody said about the third one in a panel at the edge of the screen means
 * holding "which note was that" in your head the whole time. Here the words
 * and the note they are about are in the same glance.
 *
 * It FOLLOWS its object. Panning the page carries the popup along, which is
 * what makes it read as attached rather than as a dialog that happened to open
 * near something.
 */
export function RemarkPopup(
  { engine }: { engine: RefObject<InkEngine | null> },
) {
  const remarks = useRemarks();
  const ref = useRef<HTMLDivElement>(null);
  const focus = remarks?.focus ?? null;

  useFollow(ref, engine, focus);

  useEffect(() => {
    if (focus === null || !remarks) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") remarks.openThread(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, remarks]);

  if (!remarks || focus === null) return null;
  const thread = remarks.threads.find((t) => t.anchorId === focus)
    ?? { anchorId: focus, label: null, comments: [], open: 0 };

  return (
    <div ref={ref} className="jd-remark-popup" role="dialog" aria-label="Comments on this">
      <header className="jd-remark-popup-head">
        <h2 className="jd-remark-popup-title">{threadTitle(thread)}</h2>
        <button
          type="button"
          className="jd-tool"
          aria-label="Close"
          onClick={() => remarks.openThread(null)}
        >
          <Icon name="close" />
        </button>
      </header>
      {/* Shown by CSS from `data-adrift`, which the frame loop keeps current.
          The label above it is only as fresh as the last render. */}
      <p className="jd-remark-adrift">
        This has been rubbed out. What was said about it stays here.
      </p>
      <RemarkThread thread={thread} />
      <button
        type="button"
        className="jd-remark-all"
        onClick={() => { remarks.openThread(null); remarks.setDrawer(true); }}
      >
        Everything on this page
      </button>
    </div>
  );
}

/**
 * Keep the popup on its object, every frame, without re-rendering.
 *
 * A frame loop rather than React state: the camera deliberately tells React
 * nothing on a pan (docs/08), so there is no render to hang this off, and one
 * that existed would be a render per pointer sample.
 */
function useFollow(
  ref: RefObject<HTMLDivElement | null>,
  engine: RefObject<InkEngine | null>,
  focus: string | null,
) {
  useEffect(() => {
    if (focus === null) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      const held = engine.current;
      if (!el || !held) return;
      const at = anchorRect(held, focus);
      // Erased while the popup was open. It stays where it is and says so --
      // closing it would take the words away at the moment they became the
      // only record of what was there.
      el.dataset.adrift = String(at === null);
      // Hidden until it has been somewhere, so it is never painted once at
      // whatever position the stylesheet happened to give it.
      el.dataset.placed = "true";
      if (!at) return;
      const to = placeBeside(
        at, { w: el.offsetWidth, h: el.offsetHeight },
        { w: window.innerWidth, h: window.innerHeight },
      );
      el.style.left = `${Math.round(to.left)}px`;
      el.style.top = `${Math.round(to.top)}px`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref, engine, focus]);
}
