"use client";

import { useEffect } from "react";

/**
 * Reveal once, and stay revealed. ADR-093.
 *
 * The page used to animate on `animation-timeline: view()`, which is not a
 * trigger -- it is a function of scroll position. Scrolling back up played
 * every reveal in reverse, so a reader hunting for something they had already
 * read watched it un-write itself. This marks a section the first time it
 * appears and never unmarks it.
 *
 * IT MUST FAIL OPEN. The resting state of a reveal is INVISIBLE, so anything
 * that stops the marking from happening leaves a blank page. `data-motion` is
 * set by this component, so a browser with no JavaScript never hides anything
 * -- and the watchdog below covers the case where JavaScript runs but the
 * observer does not fire, which is not hypothetical: it happens in automated
 * Chrome, and it would happen to a reader with no way to tell us.
 */
const TARGETS = ".jd-site-main section, .jd-site-foot, .jd-story";

export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;

    const targets = [...document.querySelectorAll(TARGETS)];
    if (targets.length === 0) return;

    const show = (el: Element) => el.setAttribute("data-seen", "");
    root.dataset.motion = "on";

    // Whatever is already on screen reveals from a rect, not from a callback.
    const fold = window.innerHeight * 0.88;
    for (const el of targets) {
      if (el.getBoundingClientRect().top < fold) show(el);
    }

    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        fired = true;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0 },
    );
    targets.forEach((el) => io.observe(el));

    // If the observer never reports, reveal everything rather than hide it.
    const watchdog = window.setTimeout(() => {
      if (fired) return;
      io.disconnect();
      targets.forEach(show);
    }, 1500);

    return () => {
      window.clearTimeout(watchdog);
      io.disconnect();
    };
  }, []);

  return null;
}
