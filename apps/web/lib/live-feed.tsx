"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";

/**
 * One line at the foot of the canvas, and everyone who speaks on it. ADR-061.
 *
 * The page had four surfaces for live information -- a save line, a toast, a
 * stack of agent cards and a transcript panel -- three of them in the same band
 * along the bottom. Four places to look for "something happened" is three too
 * many on a page whose whole claim is that it stays out of your way.
 */

export type FeedTone = "trouble" | "standing" | "transient";

export type FeedEntry = {
  /** What it says on the line. One clause, sentence case, no full stop. */
  line: string;
  tone: FeedTone;
  /** What opening the line shows. An entry with no detail does not open. */
  detail?: ReactNode;
  /** Which standing entry speaks when several are outstanding. Higher first.
   *  Something to DEAL WITH outranks something to know. */
  rank?: number;
  /** Transient only: how long it holds the line before falling back. */
  holdMs?: number;
};

type Held = FeedEntry & { id: string; at: number };

const DEFAULT_HOLD_MS = 2000;

const Entries = createContext<Held[]>([]);
const Controls = createContext<{
  publish: (id: string, entry: FeedEntry) => void;
  retract: (id: string) => void;
} | null>(null);

const spent = (h: Held, now: number) =>
  h.tone === "transient" && now - h.at >= (h.holdMs ?? DEFAULT_HOLD_MS);

export function LiveFeedProvider({ children }: { children: ReactNode }) {
  const [held, setHeld] = useState<Held[]>([]);

  const publish = useCallback((id: string, entry: FeedEntry) => {
    const now = Date.now();
    setHeld((all) => [
      ...all.filter((h) => h.id !== id && !spent(h, now)),
      { ...entry, id, at: now },
    ]);
  }, []);

  const retract = useCallback((id: string) => {
    setHeld((all) => all.filter((h) => h.id !== id));
  }, []);

  const controls = useMemo(() => ({ publish, retract }), [publish, retract]);

  return (
    <Controls.Provider value={controls}>
      <Entries.Provider value={held}>{children}</Entries.Provider>
    </Controls.Provider>
  );
}

/**
 * Say something on the line, or stop saying it when `entry` is null.
 *
 * `deps` is explicit rather than inferred because `detail` is JSX and is a new
 * object on every render -- inferring would republish forever.
 */
export function usePublish(id: string, entry: FeedEntry | null, deps: unknown[]) {
  const controls = useContext(Controls);

  useEffect(() => {
    if (!controls) return;
    if (!entry) { controls.retract(id); return; }
    controls.publish(id, entry);
    // A flash is not withdrawn when its publisher re-renders; it expires.
    if (entry.tone === "transient") return;
    return () => controls.retract(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Everything outstanding, in the order the line should offer it. */
export function useStanding(): Held[] {
  const held = useContext(Entries);
  return useMemo(
    () => held.filter((h) => h.tone === "standing")
      .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || b.at - a.at),
    [held],
  );
}

/**
 * What the line says right now.
 *
 * Trouble holds it until it is fixed. A flash sits over the top of whatever was
 * standing and then falls back to it. Standing is the baseline.
 */
export function useLine(): Held | null {
  const held = useContext(Entries);
  const standing = useStanding();
  const [, tick] = useState(0);

  const now = Date.now();
  const trouble = held.filter((h) => h.tone === "trouble");
  const flashing = held.filter((h) => h.tone === "transient" && !spent(h, now));

  useEffect(() => {
    if (flashing.length === 0) return;
    const left = flashing.map((h) => (h.holdMs ?? DEFAULT_HOLD_MS) - (Date.now() - h.at));
    const timer = setTimeout(() => tick((n) => n + 1), Math.max(16, Math.min(...left)));
    return () => clearTimeout(timer);
  });

  return last(trouble) ?? last(flashing) ?? standing[0] ?? null;
}

const last = <T,>(all: T[]): T | undefined => all[all.length - 1];
