"use client";

import { useState } from "react";
import { keepDraftAction } from "@/app/site/actions";
import { isInk, type CanvasTool } from "@/lib/canvas-tool";
import { DEFAULT_STYLES, styleFor, type InkStyles } from "@/lib/ink-style";
import { useDraft, type DraftState } from "@/lib/use-draft";
import { useMarks } from "@/lib/use-marks";
import { InkCanvas } from "@/components/InkCanvas";
import { ToolRail, inkToolFor } from "@/components/ToolRail";
import { ToolOptions } from "@/components/ToolOptions";

const PLACEHOLDER = "The thing you would rather not forget…";

/**
 * The hero is the product. ADR-010.
 *
 * Not a screenshot and not a demo: what is written here goes to Postgres under
 * the same RLS as every other note, through the same actions, the same toolbar
 * and the same formatting, and "Keep this" hands the whole space to an account
 * without copying a byte.
 *
 * The headline sits ON the canvas and drops to the foot the moment somebody
 * engages with it, because from that moment the page is theirs to write on
 * rather than ours to pitch on.
 */
export function HeroCanvas({ children }: { children: React.ReactNode }) {
  const { body, noteId, hasInk, state, limit, saves, onChange, ensureNote } = useDraft();
  const [tool, setTool] = useState<CanvasTool>("text");
  const [inkStarted, setInkStarted] = useState(false);
  const showInk = inkStarted || hasInk;
  const [touched, setTouched] = useState(false);
  const [styles, setStyles] = useState<InkStyles>(DEFAULT_STYLES);

  const { input, block, mark, heading, syncBlock, onKeyDown } = useMarks(onChange);

  // Anything already on the page counts as engagement, so a returning visitor
  // never sees the headline sitting on top of what they wrote OR drew.
  const engaged = touched || body.length > 0 || hasInk;

  const setStyle = (
    which: "pen" | "highlighter", patch: { color?: string; width?: number },
  ) => setStyles((all) => ({ ...all, [which]: { ...all[which], ...patch } }));

  const choose = (next: CanvasTool) => {
    setTouched(true);
    setTool(next);
    if (isInk(next)) {
      setInkStarted(true);
      void ensureNote();
    }
  };

  return (
    <div
      className="jd-hero-stage"
      data-engaged={engaged}
      // Capture, so a pen touching the ink layer counts as engaging too.
      onPointerDownCapture={() => setTouched(true)}
      onFocusCapture={() => setTouched(true)}
    >
      {/* Pointer-transparent, so a click on the headline lands on the canvas
          underneath it and the headline gets out of its own way. */}
      <div className="jd-hero-titles">{children}</div>

      <textarea
        ref={input}
        className="jd-canvas-input jd-hero-input font-sans"
        placeholder={PLACEHOLDER}
        aria-label="Try jotdojo"
        spellCheck
        readOnly={isInk(tool)}
        value={body}
        onChange={(e) => onChange(e.target.value)}
        onSelect={syncBlock}
        onKeyDown={onKeyDown}
      />

      {showInk && noteId && (
        <div className="jd-ink-mount" data-active={isInk(tool)}>
          <InkCanvas
            noteId={noteId}
            tool={inkToolFor(tool)}
            style={styleFor(inkToolFor(tool), styles)}
          />
        </div>
      )}

      <div className="jd-chrome glass jd-hero-rail top-3 left-1/2 z-20 flex -translate-x-1/2 items-center rounded-full p-1">
        <ToolRail
          tool={tool}
          onTool={choose}
          unavailable={["mic", "cam"]}
          unavailableHint="sign in to record voice notes and add photos"
        />
      </div>

      <ToolOptions
        tool={tool}
        styles={styles}
        block={block}
        onStyle={setStyle}
        onMark={mark}
        onBlock={heading}
      />

      <div className="jd-hero-foot">
        <p role="status" aria-live="polite" className="jd-hero-status">
          {status(state, limit, saves)}
        </p>
        {state !== "idle" && (
          <form action={keepDraftAction}>
            <button type="submit" className="btn btn-accent btn-sm">Keep this</button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Honest about the state without nagging. docs/16-web-presence.md.
 *
 * The "sign in to keep this" line is shown ONCE, after the first save. Not a
 * modal, not on every keystroke.
 */
function status(state: DraftState, limit: string | null, saves: number): string {
  if (state === "idle") return "Nothing to sign up for. Start typing or writing.";
  if (state === "saving") return "Saving…";
  if (state === "full") return limit ?? "Sign in to keep writing.";
  if (state === "error") return "That did not send. It is safe here and will retry.";
  return saves === 1
    ? "Saved. Sign in to keep this and reach it from your phone."
    : "Saved.";
}
