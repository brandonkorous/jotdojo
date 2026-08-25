"use client";

import { useEffect, type RefObject } from "react";
import type { InkEngine } from "@/lib/ink-engine";
import { labelsFor } from "@/lib/remark-anchor";
import { useRemarks } from "@/lib/remarks";

/**
 * The one place React and the pin layer meet. ADR-107.
 *
 * Headless: it renders nothing. The pins are DOM the engine owns, because they
 * are repositioned from the paint loop and a component re-rendering per pan
 * frame is the thing docs/08 is most explicit about not doing. This pushes
 * what there is to mark, and reads back what the canvas calls each object so
 * the drawer can say which note a thread belongs to.
 */
export function RemarkPins(
  { engine, ready }: { engine: RefObject<InkEngine | null>; ready: boolean },
) {
  const remarks = useRemarks();
  const pins = remarks?.pins;
  const openThread = remarks?.openThread;
  const setLabels = remarks?.setLabels;
  // Read again when either surface opens, because a note's words change
  // without React hearing about it -- the plane owns those textareas.
  const showing = `${remarks?.drawer}:${remarks?.focus}`;

  useEffect(() => {
    const held = engine.current;
    if (!held?.pins || !pins || !openThread || !setLabels) return;
    held.pins.set(pins, openThread);
    setLabels(labelsFor(held, pins.map((p) => p.anchorId)));
  }, [engine, ready, pins, openThread, setLabels, showing]);

  return null;
}
