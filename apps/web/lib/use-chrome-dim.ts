import { useRef, useState } from "react";

const DIM_MS = 3000;

/**
 * Fade the furniture while somebody writes, and bring it back when they move.
 *
 * Its own file because the guard below is a performance argument about the
 * pointer hot path, and nothing else on the canvas reads it. ADR-102.
 */
export function useChromeDim() {
  const [dimmed, setDimmed] = useState(false);
  const dimmedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * `onPointerMove` on the shell is the only React call in the pointer hot
   * path, and setting state to its current value is NOT free -- it still
   * enters the dispatcher. Since the canvas gained two-finger gestures it
   * fires for both fingers of every pinch, so this guard earns its keep.
   */
  const dim = (on: boolean) => {
    if (dimmedRef.current === on) return;
    dimmedRef.current = on;
    setDimmed(on);
  };

  /** Typing dims the chrome and restarts the clock that brings it back. */
  const whileWriting = () => {
    dim(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => dim(false), DIM_MS);
  };

  return { dimmed, wake: () => dim(false), whileWriting };
}
