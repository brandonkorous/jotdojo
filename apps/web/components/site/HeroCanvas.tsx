"use client";

import { useEffect, useState } from "react";
import { keepDraftAction } from "@/app/site/actions";
import { isInk, type CanvasTool } from "@/lib/canvas-tool";
import { DEFAULT_STYLES, styleFor, type InkStyles } from "@/lib/ink-style";
import { useDraft, type DraftState } from "@/lib/use-draft";
import { useMarks } from "@/lib/use-marks";
import { InkCanvas } from "@/components/InkCanvas";
import { ToolRail } from "@/components/ToolRail";
import { ToolOptions } from "@/components/ToolOptions";
import { HeroJot } from "@/components/site/HeroJot";

const PLACEHOLDER = "The thing you would rather not forget…";

/**
 * The hero is the product. ADR-010, ADR-076.
 *
 * The pitch on the left, the running canvas on the right in a Silica window
 * frame, tilted until somebody engages with it. The tilt straightens rather
 * than staying put because the ink layer maps pointers against an axis-aligned
 * bounding box -- see the note in site-hero.css.
 */
type Props = {
  children: React.ReactNode;
  /** The app's origin, resolved on the server. `appOrigin()` reads an env var
   *  that is not in the client bundle, so calling it here would render one URL
   *  on the server and a different one in the browser. */
  appHref: string;
};

export function HeroCanvas({ children, appHref }: Props) {
  const { body, noteId, hasInk, ready, state, limit, saves, onChange, ensureNote } = useDraft();
  const [tool, setTool] = useState<CanvasTool>("text");
  const [inkStarted, setInkStarted] = useState(false);
  const showInk = inkStarted || hasInk;
  const [touched, setTouched] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [styles, setStyles] = useState<InkStyles>(DEFAULT_STYLES);

  const { input, block, mark, heading, syncBlock, onKeyDown } = useMarks(onChange);

  // Anything already on the page counts as engagement, so a returning visitor
  // never sees the headline sitting on top of what they wrote OR drew.
  const engaged = touched || body.length > 0 || hasInk;

  // The demo jot goes on once, onto paper nobody has used yet, and stays
  // mounted afterwards so engaging with it can clear it rather than cut it.
  const [jot, setJot] = useState(false);
  useEffect(() => { if (ready && !engaged) setJot(true); }, [ready, engaged]);

  const setStyle = (
    which: "pen" | "highlighter", patch: { color?: string; width?: number },
  ) => setStyles((all) => ({ ...all, [which]: { ...all[which], ...patch } }));

  // Tapping the tool you already hold opens its options; picking a new one
  // does not. Same rule as the app -- the hero must not teach a different one.
  const choose = (next: CanvasTool) => {
    setTouched(true);
    setOptionsOpen(next === tool ? !optionsOpen : false);
    setTool(next);
    if (isInk(next)) {
      setInkStarted(true);
      void ensureNote();
    }
  };

  return (
    <div
      className="jd-hero"
      data-engaged={engaged}
      // Capture, so a pen touching the ink layer counts as engaging too.
      onPointerDownCapture={() => setTouched(true)}
      onFocusCapture={() => setTouched(true)}
    >
      <div className="jd-hero-titles">
        {children}
        <div className="jd-hero-cta">
          <a className="btn btn-primary btn-lg" href={appHref}>Start jotting</a>
          <a className="jd-hero-note" href="#how">See how it works &darr;</a>
        </div>
      </div>

      {/* Not a screenshot. What is written in here goes to Postgres under the
          same RLS as every other note, through the same actions and the same
          toolbar -- and "Keep this" hands the whole space to an account
          without copying a byte. ADR-010. */}
      <div className="jd-hero-frame">
        <div className="mockup-window jd-hero-mock">
          <div className="jd-hero-stage">
            <textarea
              ref={input}
              className="jd-canvas-input jd-hero-input font-sans"
              placeholder={showInk ? "" : PLACEHOLDER}
              aria-label="Try Jotacular"
              spellCheck
              readOnly={isInk(tool)}
              value={body}
              onChange={(e) => onChange(e.target.value)}
              onSelect={syncBlock}
              onKeyDown={onKeyDown}
            />

            {jot && <HeroJot />}

            {showInk && noteId && (
              <div className="jd-ink-mount" data-active={isInk(tool)}>
                <InkCanvas
                  noteId={noteId}
                  tool={tool}
                  style={styleFor(tool, styles)}
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
              open={optionsOpen}
              onClose={() => setOptionsOpen(false)}
              onStyle={setStyle}
              onMark={mark}
              onBlock={heading}
            />

            <div className="jd-hero-foot" data-state={state}>
              <p role="status" aria-live="polite" className="jd-hero-status">
                {status(state, limit, saves)}
              </p>
              {state !== "idle" && (
                <form action={keepDraftAction}>
                  <button type="submit" className="btn btn-primary btn-sm">Keep this</button>
                </form>
              )}
            </div>
          </div>
        </div>
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
    ? "Jot saved. Sign in to keep it and reach it from your phone."
    : "Jot saved.";
}
