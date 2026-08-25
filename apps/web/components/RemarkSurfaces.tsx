"use client";

import type { RefObject } from "react";
import type { InkEngine } from "@/lib/ink-engine";
import { RemarkPins } from "./RemarkPins";
import { RemarkPopup } from "./RemarkPopup";
import { RemarksDrawer } from "./RemarksDrawer";

/**
 * The three places a comment shows up, all of which need the page. ADR-107.
 *
 * They live here rather than beside the live line, because every one of them
 * has to ask the engine where something is: the pins to place a mark, the
 * popup to follow one, and the drawer to travel to one. `CanvasStage` owns
 * what the page SAYS; this owns what it points at.
 */
export function RemarkSurfaces(
  { engine, ready }: { engine: RefObject<InkEngine | null>; ready: boolean },
) {
  return (
    <>
      <RemarkPins engine={engine} ready={ready} />
      <RemarkPopup engine={engine} />
      <RemarksDrawer engine={engine} />
    </>
  );
}
