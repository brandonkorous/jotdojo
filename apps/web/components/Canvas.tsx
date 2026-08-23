"use client";

import { useRef, useState } from "react";
import type { Align } from "@/lib/toolbar-side";
import { isInk, type CanvasTool } from "@/lib/canvas-tool";
import { DEFAULT_STYLES, styleFor, type InkStyles } from "@/lib/ink-style";
import { ToolOptions } from "./ToolOptions";
import { useMarks } from "@/lib/use-marks";
import { SaveIndicator } from "./SaveIndicator";
import { InkCanvas } from "./InkCanvas";
import { InkTranscript } from "./InkTranscript";
import { Photos } from "./Photos";
import { Recorder } from "./Recorder";
import { ScribbleHint } from "./ScribbleHint";
import { Chrome } from "./Chrome";
import { Presence } from "./Presence";
import { useNoteBody } from "@/lib/use-note-body";
import { usePresence } from "@/lib/use-presence";
import { useLiveNote } from "@/lib/use-live";

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
  const [dimmed, setDimmed] = useState(false);
  const dimmedRef = useRef(false);
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
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [inkBlockId, setInkBlockId] = useState<string | null>(null);
  // A counter rather than a boolean: tapping the camera twice in a row has
  // to reopen the picker, and a flag that is already true does nothing.
  const [cameraSignal, setCameraSignal] = useState(0);
  const [micSignal, setMicSignal] = useState(0);
  // Per tool, so the marker keeps its own colour instead of inheriting the
  // pen's near-black and painting a grey smear. ADR-045.
  const [styles, setStyles] = useState<InkStyles>(DEFAULT_STYLES);


  /**
   * Picking a tool does not open its options; tapping it again does.
   *
   * The pill sits in the band across the top of the page, which on a phone is
   * where the next line was going to go. Reaching for the pen is not a request
   * to see the palette -- reaching for the pen you are already holding is.
   */
  const chooseTool = (next: CanvasTool) => {
    if (isInk(next)) setInkStarted(true);
    setOptionsOpen(next === tool ? !optionsOpen : false);
    setTool(next);
  };

  const setStyle = (
    which: "pen" | "highlighter", patch: { color?: string; width?: number },
  ) => setStyles((all) => ({ ...all, [which]: { ...all[which], ...patch } }));

  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { body, state, onChange: save, adopt } = useNoteBody(noteId, initialBody, initialRevision);
  // Presence is for people, and an anonymous draft is one device by
  // construction -- its cookie is host-only. ADR-039, ADR-058.
  const { others, writing, refresh } = usePresence(noteId, user !== null);

  /**
   * What another device did. ADR-058.
   *
   * `adopt` is the whole text story and it is deliberately conservative: it
   * takes the other version only when there is nothing unsaved here. Ink is not
   * in this list because InkCanvas subscribes for itself -- the stream is
   * shared, so that costs no second connection.
   */
  useLiveNote(user ? noteId : null, {
    onNote: (event) => { void adopt(event.revision); },
    onPresence: () => { void refresh(); },
    onResync: () => { void adopt(); void refresh(); },
  });

  const onChange = (value: string) => {
    save(value);
    writing();

    dim(true);
    if (dimTimer.current) clearTimeout(dimTimer.current);
    dimTimer.current = setTimeout(() => dim(false), 3000);
  };

  /**
   * Dim the chrome, without a dispatch when it is already where it should be.
   *
   * `onPointerMove` on the shell is the only React call in the pointer hot
   * path, and setting state to its current value is NOT free -- it still
   * enters the dispatcher. Since the canvas gained two-finger gestures it
   * fires for both fingers of every pinch, so the guard now earns its keep.
   */
  function dim(on: boolean) {
    if (dimmedRef.current === on) return;
    dimmedRef.current = on;
    setDimmed(on);
  }

  const { input, block, mark, heading, syncBlock, onKeyDown } = useMarks(onChange);

  // The canvas runs edge to edge. The only padding that matters is enough top
  // room to clear the pill, and enough bottom room to clear the selection bar.
  const pad = "px-5 pt-16 pb-10 sm:px-8";

  return (
    <div className="jd-canvas-shell" onPointerMove={() => dim(false)}>
      <div className={`h-full w-full ${pad}`}>
        <textarea
          ref={input}
          autoFocus={!isInk(tool)}
          readOnly={isInk(tool)}
          className="jd-canvas-input font-sans"
          // A prompt to start, and only that. Once there is ink on the page it
          // is showing through somebody's handwriting to tell them to begin
          // something they have visibly already begun.
          placeholder={inkStarted ? "" : "Start jotting."}
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
            tool={tool}
            style={styleFor(tool, styles)}
            onReady={setInkBlockId}
            onDraw={writing}
            onTextPlaced={() => setTool("text")}
            live={user !== null}
          />
        </div>
      )}

      {/* DOM order here is recorder, photos, transcript -- and it is load
          bearing. All three are absolutely positioned, so the order changes
          nothing visually, but globals.css uses sibling selectors to stack
          them when more than one is on screen, and `~` only looks forward. */}
      <Recorder noteId={noteId} startSignal={micSignal} />

      <Photos noteId={noteId} openSignal={cameraSignal} />

      {inkStarted && <InkTranscript noteId={noteId} blockId={inkBlockId} live={user !== null} />}

      <Chrome align={toolbarPreference} user={user} dimmed={dimmed} tool={tool} onTool={chooseTool}
        onCamera={() => setCameraSignal((n) => n + 1)}
        onMic={() => setMicSignal((n) => n + 1)} />

      <ToolOptions
        onTextBox={() => { setOptionsOpen(false); setInkStarted(true); setTool("textbox"); }}
        tool={tool}
        styles={styles}
        block={block}
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        onStyle={setStyle}
        onMark={mark}
        onBlock={heading}
      />

      <Presence who={others} />

      <SaveIndicator state={state} />
    </div>
  );
}
