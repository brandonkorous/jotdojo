"use client";

import { useEffect } from "react";

/**
 * Reveal once, and stay revealed. ADR-093.
 *
 * The page used to animate on `animation-timeline: view()`, which is not a
 * trigger -- it is a function of scroll position. Scrolling back up played
 * every reveal in reverse, so a reader hunting for something they had already
 * read watched it un-write itself. This marks a section the first time it
 * appears and never unmarks it; the CSS holds every animation paused until
 * then, and `both` fill holds the end state forever after.
 *
 * `data-motion` goes on the root rather than being assumed, so a page with no
 * JavaScript never paints hidden content: without it the pause rule matches
 * nothing and everything is simply visible.
 */
const TARGETS = ".jd-site-main section, .jd-site-foot, .jd-story";

export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    root.dataset.motion = "on";

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-seen", "");
          io.unobserve(entry.target);
        }
      },
      // A little short of the fold, so a band starts its sequence as it
      // arrives rather than the instant its first pixel appears.
      { rootMargin: "0px 0px -12% 0px", threshold: 0 },
    );

    document.querySelectorAll(TARGETS).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
