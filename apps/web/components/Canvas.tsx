"use client";

import { useEffect, useRef, useState } from "react";
import type { Align } from "@/lib/toolbar-side";
import { isInk } from "@/lib/canvas-tool";
import { useCanvasTool } from "@/lib/use-canvas-tool";
import { styleFor } from "@/lib/ink-style";
import { ToolOptions } from "./ToolOptions";
import { useMarks } from "@/lib/use-marks";
import { SaveIndicator } from "./SaveIndicator";
import { InkCanvas } from "./InkCanvas";
import { CanvasMenuHost } from "./CanvasMenuHost";
import { Spine } from "./Spine";
import { InkTranscript } from "./InkTranscript";
import { Photos } from "./Photos";
import { Recorder } from "./Recorder";
import { ScribbleHint } from "./ScribbleHint";
import { Chrome } from "./Chrome";
import { Presence } from "./Presence";
import { RemarkSurfaces } from "./RemarkSurfaces";
import type { InkEngine, SelectionSummary } from "@/lib/ink-engine";
import { NO_SELECTION } from "@/lib/ink-selection";
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
/** Close enough to be a tap rather than a pan, in screen pixels. The same
 *  number ink-input-select.ts uses, for the same unsteady hand. */
const TAP_SLOP = 6;

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
  /** The whole page. The camera listens here so it can be moved on every tool,
   *  and the menu triggers here so it exists on every tool. ADR-102. */
  const shellRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<InkEngine | null>(null);
  const [selection, setSelection] = useState<SelectionSummary>(NO_SELECTION);
  // A counter rather than a boolean: tapping the camera twice in a row has to
  // reopen the picker, and a flag that is already true does nothing.
  const [cameraSignal, setCameraSignal] = useState(0);
  const [micSignal, setMicSignal] = useState(0);
  const [inkBlockId, setInkBlockId] = useState<string | null>(null);

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
  const {
    tool, setTool, styles, setStyle, choose, armTextBox,
    inkStarted, startInk, optionsOpen, closeOptions,
  } = useCanvasTool(input, hasInk);

  /**
   * Blank paper still types. ADR-102.
   *
   * The spine is only as tall as its words now, so most of a fresh page is
   * canvas rather than text field -- and a tap on it has to mean what it has
   * always meant, or ADR-008's contract is broken to buy a menu.
   *
   * A TAP, not any pointer-up. The camera moves on this surface too, and a
   * two-finger pan that ended by opening the keyboard over the page somebody
   * had just panned to would be worse than the fence it replaced.
   */
  const from = useRef<{ x: number; y: number } | null>(null);

  const tapBlank = (e: React.PointerEvent) => {
    const began = from.current;
    from.current = null;
    if (!began || isInk(tool) || e.target !== e.currentTarget) return;
    if (Math.hypot(e.clientX - began.x, e.clientY - began.y) > TAP_SLOP) return;
    const el = input.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  };

  return (
    <CanvasMenuHost noteId={noteId} engine={engineRef} selection={selection}>
      <div
        ref={shellRef}
        className="jd-canvas-shell"
        onPointerMove={() => dim(false)}
        // A second finger means the camera, never the caret. Cleared rather
        // than tracked, so the gesture cannot end as a tap on the way out.
        onPointerDown={(e) => {
          from.current = e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
        }}
        onPointerUp={tapBlank}
        onPointerCancel={() => { from.current = null; }}
      >
        <Spine
          input={input}
          value={body}
          // A prompt to start, and only that. Once there is ink on the page it
          // is showing through somebody's handwriting to tell them to begin
          // something they have visibly already begun.
          placeholder={inkStarted ? "" : "Start jotting."}
          readOnly={isInk(tool)}
          autoFocus={!isInk(tool)}
          onChange={onChange}
          onSelect={syncBlock}
          onKeyDown={onKeyDown}
        />

        {/* Only while typing: over a page of ink it would be telling someone
            something they have visibly already worked out. */}
        <ScribbleHint visible={!isInk(tool)} />

        {/* ALWAYS mounted, whether or not anything is drawn yet. ADR-102: the
            camera and the canvas menu live on this surface, and a page that
            waited for somebody to pick up a pen before it had either was a
            page you could not pan, pinch or hold on. `data-active` still
            decides whether it takes the pointer -- the spine is underneath. */}
        <div className="jd-ink-mount" data-active={isInk(tool)}>
          <InkCanvas
            noteId={noteId}
            tool={tool}
            style={styleFor(tool, styles)}
            onReady={setInkBlockId}
            onDraw={writing}
            onTextPlaced={() => setTool("text")}
            live={user !== null}
            outer={shellRef}
            held={engineRef}
            onSelection={setSelection}
          />
        </div>

        {/* DOM order here is recorder, photos, transcript -- and it is load
            bearing. All three are absolutely positioned, so the order changes
            nothing visually, but globals.css uses sibling selectors to stack
            them when more than one is on screen, and `~` only looks forward. */}
        <Recorder noteId={noteId} startSignal={micSignal} />

        {/* The picture goes ON the page, where somebody is looking, and is
            then an object like any other. ADR-103. */}
        <Photos
          noteId={noteId}
          openSignal={cameraSignal}
          onPlaced={(blockId, natural) => {
            startInk();
            engineRef.current?.placeImage(blockId, natural);
          }}
        />

        {inkStarted && <InkTranscript noteId={noteId} blockId={inkBlockId} live={user !== null} />}

        <Chrome align={toolbarPreference} user={user} dimmed={dimmed} tool={tool} onTool={choose}
          onCamera={() => setCameraSignal((n) => n + 1)}
          onMic={() => setMicSignal((n) => n + 1)}
          onTextBox={armTextBox} />

        <ToolOptions
          tool={tool}
          styles={styles}
          block={block}
          open={optionsOpen}
          onClose={closeOptions}
          onStyle={setStyle}
          onMark={mark}
          onBlock={heading}
        />

        <Presence who={others} />

        {/* The marks on the page, the conversation beside one of them, and the
            list of all of it. All three ask the engine where things are, so
            they hang off the canvas rather than off the stage. ADR-107. */}
        <RemarkSurfaces engine={engineRef} ready={inkBlockId !== null} />

        <SaveIndicator state={state} />
      </div>
    </CanvasMenuHost>
  );
}
