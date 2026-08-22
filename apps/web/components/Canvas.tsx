"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveNoteAction } from "@/app/actions";
import type { Align } from "@/lib/toolbar-side";
import { isInk, type CanvasTool } from "@/lib/canvas-tool";
import { DEFAULT_STYLES, styleFor, type InkStyles } from "@/lib/ink-style";
import { inkToolFor } from "./ToolRail";
import { ToolOptions } from "./ToolOptions";
import { useMarks } from "@/lib/use-marks";
import { SaveIndicator } from "./SaveIndicator";
import { InkCanvas } from "./InkCanvas";
import { InkTranscript } from "./InkTranscript";
import { Photos } from "./Photos";
import { Recorder } from "./Recorder";
import { ScribbleHint } from "./ScribbleHint";
import { Chrome } from "./Chrome";

import type { SaveState } from "@/lib/save-state";

/**
 * The canvas. This IS the app -- no dashboard, no create button, no empty
 * state with a call to action. ADR-008.
 *
 * The capture contract (docs/02-product-spec.md) governs everything here:
 * writing is live immediately, nothing blocks on the network, and a failed
 * save keeps the text and retries rather than losing it.
 */
export function Canvas({
  noteId, initialBody, initialRevision, hasInk, user, toolbarPreference,
}: {
  noteId: string;
  initialBody: string;
  initialRevision: number;
  /** Whether this note already has handwriting. ADR-047. */
  hasInk: boolean;
  user: { name?: string | null; image?: string | null; email?: string | null } | null;
  toolbarPreference: Align;
}) {
  const [body, setBody] = useState(initialBody);
  const [state, setState] = useState<SaveState>("idle");
  const [dimmed, setDimmed] = useState(false);
  const [tool, setTool] = useState<CanvasTool>("text");
  // Mounted from the start when the page already HAS ink, or it would not be
  // drawn until somebody reached for the pen -- and reaching for the pen used
  // to start a second block and orphan the first. ADR-047.
  //
  // Once ink exists on this page it stays mounted, whatever the toolbar says.
  // Unmounting would start a NEW ink block on the next pen tap and orphan
  // everything already drawn -- the strokes would still be in the database,
  // attached to a block nothing renders.
  const [inkStarted, setInkStarted] = useState(hasInk);
  const [inkBlockId, setInkBlockId] = useState<string | null>(null);
  // A counter rather than a boolean: tapping the camera twice in a row has
  // to reopen the picker, and a flag that is already true does nothing.
  const [cameraSignal, setCameraSignal] = useState(0);
  const [micSignal, setMicSignal] = useState(0);
  // Per tool, so the marker keeps its own colour instead of inheriting the
  // pen's near-black and painting a grey smear. ADR-045.
  const [styles, setStyles] = useState<InkStyles>(DEFAULT_STYLES);


  const chooseTool = (next: CanvasTool) => {
    if (isInk(next)) setInkStarted(true);
    setTool(next);
  };

  const setStyle = (
    which: "pen" | "highlighter", patch: { color?: string; width?: number },
  ) => setStyles((all) => ({ ...all, [which]: { ...all[which], ...patch } }));

  const revision = useRef(initialRevision);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pendingBody = useRef<string | null>(null);


  const flush = useCallback(async () => {
    if (inFlight.current) return;
    const next = pendingBody.current;
    if (next === null) return;

    pendingBody.current = null;
    inFlight.current = true;
    setState("saving");

    const result = await saveNoteAction(noteId, next, revision.current);
    inFlight.current = false;

    if (result.ok) {
      revision.current = result.revision;
      setState("saved");
    } else if (result.reason === "conflict") {
      // Never merge, never discard -- see RevisionConflict in the domain layer.
      // M0 surfaces it; M3 forks the losing copy into a flagged duplicate.
      revision.current = result.currentRevision;
      setState("conflict");
    } else {
      // The text is still in the textarea and still in pendingBody. Retry.
      pendingBody.current = next;
      setState("retrying");
      setTimeout(() => void flush(), 3000);
      return;
    }

    if (pendingBody.current !== null) void flush();
  }, [noteId]);

  const onChange = (value: string) => {
    setBody(value);
    pendingBody.current = value;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 600);

    setDimmed(true);
    if (dimTimer.current) clearTimeout(dimTimer.current);
    dimTimer.current = setTimeout(() => setDimmed(false), 3000);
  };

  const { input, block, mark, heading, syncBlock, onKeyDown } = useMarks(onChange);

  // A tab closing mid-thought must not eat the last few characters.
  useEffect(() => {
    const onHide = () => {
      if (pendingBody.current === null) return;
      navigator.sendBeacon?.(
        "/api/capture-beacon",
        new Blob(
          [JSON.stringify({ noteId, body: pendingBody.current, revision: revision.current })],
          { type: "application/json" },
        ),
      );
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [noteId]);

  // The canvas runs edge to edge. The only padding that matters is enough top
  // room to clear the pill, and enough bottom room to clear the save line.
  const pad = "px-5 pt-16 pb-10 sm:px-8";

  return (
    <div className="jd-canvas-shell" onPointerMove={() => setDimmed(false)}>
      <div className={`h-full w-full ${pad}`}>
        <textarea
          ref={input}
          autoFocus={!isInk(tool)}
          readOnly={isInk(tool)}
          className="jd-canvas-input font-sans"
          placeholder="Start jotting."
          aria-label="Note"
          spellCheck
          value={body}
          onChange={(e) => onChange(e.target.value)}
          onSelect={syncBlock}
          onKeyDown={onKeyDown}
        />
      </div>

      {/* Only while typing: over a page of ink it would be telling someone
          something they have visibly already worked out. */}
      <ScribbleHint visible={!isInk(tool)} />

      {inkStarted && (
        <div className="jd-ink-mount" data-active={isInk(tool)}>
          <InkCanvas
            noteId={noteId}
            tool={inkToolFor(tool)}
            style={styleFor(inkToolFor(tool), styles)}
            onReady={setInkBlockId}
          />
        </div>
      )}

      {/* DOM order here is recorder, photos, transcript -- and it is load
          bearing. All three are absolutely positioned, so the order changes
          nothing visually, but globals.css uses sibling selectors to stack
          them when more than one is on screen, and `~` only looks forward. */}
      <Recorder noteId={noteId} startSignal={micSignal} />

      <Photos noteId={noteId} openSignal={cameraSignal} />

      {inkStarted && <InkTranscript blockId={inkBlockId} />}

      <Chrome align={toolbarPreference} user={user} dimmed={dimmed} tool={tool} onTool={chooseTool}
        onCamera={() => setCameraSignal((n) => n + 1)}
        onMic={() => setMicSignal((n) => n + 1)} />

      <ToolOptions
        tool={tool}
        styles={styles}
        block={block}
        onStyle={setStyle}
        onMark={mark}
        onBlock={heading}
      />

      <SaveIndicator state={state} />
    </div>
  );
}
