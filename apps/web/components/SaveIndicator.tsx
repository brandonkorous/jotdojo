import type { SaveState } from "@/lib/save-state";

/**
 * The save line. Split out of Canvas.tsx at the size limit, and it earns the
 * file: this is the only place the capture contract is spoken out loud, so
 * "that did not send, it is safe here" belongs somewhere it can be read.
 */
export function SaveIndicator({
  state,
}: { state: SaveState }) {
  if (state === "idle") return null;

  const text = {
    saving: "Saving\u2026",
    saved: "Saved",
    retrying: "That did not send. It is safe here and will retry.",
    conflict: "This note changed somewhere else. Your text is still here.",
  }[state];

  const tone = state === "retrying" || state === "conflict" ? "text-accent" : "opacity-50";

  return (
    <p
      role="status"
      aria-live="polite"
      className={`jd-chrome pointer-events-none z-10 bottom-3 left-0 right-0 text-center text-xs ${tone}`}
    >
      {text}
    </p>
  );
}
