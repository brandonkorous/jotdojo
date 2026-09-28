"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { Side } from "@/lib/toolbar-side";
import type { CanvasTool } from "@/lib/canvas-tool";
import { useNarrow } from "@/lib/use-narrow";
import { ToolRail } from "./ToolRail";
import { AddMenu } from "./AddMenu";
import { SelectOrPan } from "./SelectOrPan";

/**
 * The tools, standing down one side of the page. ADR-120.
 * Modes above the seam, things that add something below it. On a phone it
 * folds to the tool in hand, and the first tap only unfolds it. ADR-101.
 */
export function SideRail({
  side, dimmed, tool, onTool, onCamera, onMic, onTextBox, onSticker,
}: {
  side: Side;
  dimmed: boolean;
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  onCamera: () => void;
  onMic: () => void;
  onTextBox: () => void;
  onSticker: () => void;
}) {
  const narrow = useNarrow();
  const [open, setOpen] = useState(true);
  useEffect(() => { setOpen(!narrow); }, [narrow]);
  const fold = () => { if (narrow) setOpen(false); };
  const rail = useRef<HTMLDivElement>(null);
  const [choosing, setChoosing] = useState(false);

  const tapTool = (next: CanvasTool) => {
    if (!open) return void setOpen(true);
    // Select or Pan already in hand: the tap asks which. ADR-123.
    if (next === tool && (next === "select" || next === "pan")) return void setChoosing(true);
    onTool(next);
    fold();
  };

  return (
    <div
      ref={rail}
      data-side={side}
      data-open={open}
      data-dimmed={dimmed}
      className="jd-chrome glass jd-side-rail"
    >
      <ToolRail tool={tool} onTool={tapTool} open={open} />
      <RailActions side={side} fold={fold} onCamera={onCamera} onMic={onMic}
        onTextBox={onTextBox} onSticker={onSticker} />
      <SelectOrPan open={choosing} onOpenChange={setChoosing} anchor={rail} side={side}
        onTool={(t) => { onTool(t); fold(); }} />
    </div>
  );
}

/** Below the seam: things that put something new on the page, then finish. */
function RailActions({ side, fold, onCamera, onMic, onTextBox, onSticker }: {
  side: Side;
  fold: () => void;
  onCamera: () => void;
  onMic: () => void;
  onTextBox: () => void;
  onSticker: () => void;
}) {
  const then = (act: () => void) => () => { act(); fold(); };
  return (
    <>
      <span aria-hidden className="jd-rail-sep-v jd-rail-extra" />
      <button type="button" className="jd-tool jd-rail-extra" title="Record a voice note"
        aria-label="Voice note" onClick={then(onMic)}>
        <Icon name="voice" />
      </button>
      <button type="button" className="jd-tool jd-rail-extra" title="Put a photo on the page"
        aria-label="Photo" onClick={then(onCamera)}>
        <Icon name="photo" />
      </button>
      <span className="jd-rail-extra">
        <AddMenu side={side === "left" ? "right" : "left"} onPhoto={then(onCamera)}
          onVoice={then(onMic)} onNote={then(onTextBox)} onSticker={then(onSticker)} />
      </span>
    </>
  );
}
