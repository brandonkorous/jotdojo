"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getInkAction } from "@/app/actions";
import { useLiveNote } from "@/lib/use-live";
import { usePublish, type FeedEntry } from "@/lib/live-feed";
import { TranscriptCard } from "./TranscriptCard";

/**
 * The reading of a page of handwriting, and its place on the live line.
 * docs/08-ink.md, ADR-061.
 *
 * Confidence is always carried and always shown -- a transcript nobody trusts
 * and nobody can see is worse than none, because an agent will quote it back as
 * though it were what the person wrote. The line says how sure it is; opening
 * the line shows the words and the way to correct them.
 */

/**
 * The fallback, not the mechanism. ADR-058.
 *
 * A reading arriving is pushed down the live stream the moment the worker
 * stores it, so this exists only for a browser whose stream never connected.
 * It used to be four seconds because it was the only way to find out.
 */
const POLL_MS = 15_000;
const POLL_CEILING_MS = 30_000;

/**
 * How long "reading your handwriting" is still true for.
 *
 * Past this the claim is a lie -- and the shape of the lie matters. Nothing is
 * wrong with the page: the ink is stored, and it is stored as strokes, so a
 * reader arriving next week reads it just as well. What is not happening is a
 * reading, either because the queue is long or because recognition is not
 * switched on for this space, and the UI cannot tell which. So it stops
 * claiming an action is in progress and says the part it knows.
 */
const PATIENCE_MS = 90_000;

type Ink = Awaited<ReturnType<typeof getInkAction>>;

export function InkTranscript(
  { noteId, blockId, live = false }:
  { noteId: string; blockId: string | null; live?: boolean },
) {
  const [ink, setInk] = useState<Ink | null>(null);
  /** Set once the wait stops being a wait, so the card can stop promising. */
  const [waited, setWaited] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async (delay: number) => {
    if (!blockId) return;
    // Cancel whatever was already scheduled. There are now three callers -- the
    // mount, a live event and a reconnect -- and without this each would start
    // its own chain, only the last of which the cleanup can ever stop.
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try {
      const next = await getInkAction(blockId);
      setInk(next);
      // Stop polling once there is an answer, one way or the other. Backing off
      // matters more than it looks: this is a server action per tick, and a
      // page left open all afternoon would otherwise hammer the database for
      // a transcript that already arrived.
      if (next.transcriptState === "pending" && next.strokeCount > 0) {
        timer.current = setTimeout(() => poll(Math.min(delay * 1.5, POLL_CEILING_MS)), delay);
      }
    } catch {
      timer.current = setTimeout(() => poll(Math.min(delay * 2, POLL_CEILING_MS)), delay);
    }
  }, [blockId]);

  /** The worker finished reading this page. No wait, no poll interval. */
  useLiveNote(live && blockId ? noteId : null, {
    onBlock: (event) => { if (event.blockId === blockId) void poll(POLL_MS); },
    onResync: () => { void poll(POLL_MS); },
  });

  useEffect(() => {
    if (!blockId) return;
    setWaited(false);
    void poll(POLL_MS);
    // Polling continues -- a reading that arrives late should still appear.
    // Only the wording gives up, because only the wording was making a promise.
    const patience = setTimeout(() => setWaited(true), PATIENCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      clearTimeout(patience);
    };
  }, [blockId, poll]);

  /** Stable, so correcting the reading does not republish the line on every
   *  render of the card behind it. */
  const corrected = useCallback((text: string) => {
    setInk((was) => (was ? { ...was, transcript: text, confidence: null } : was));
  }, []);

  const showing = Boolean(blockId) && ink !== null && ink.strokeCount > 0;

  usePublish(
    "transcript",
    showing && blockId && ink ? entryFor(ink, waited, blockId, corrected) : null,
    [showing, ink?.transcriptState, ink?.transcript, ink?.confidence, waited, blockId],
  );

  return null;
}

/** What this page's reading says on the line, and what opening it shows. */
function entryFor(
  ink: Ink, waited: boolean, blockId: string, onCorrected: (text: string) => void,
): FeedEntry {
  const base = { tone: "standing" as const, rank: 10 };

  if (ink.transcriptState === "pending") {
    return {
      ...base,
      line: waited
        ? "Nothing has read your handwriting back yet"
        : "Reading your handwriting…",
    };
  }

  // Precise on purpose. The page is fine; only the reading failed, and saying
  // "could not save" would be a lie that causes panic.
  if (ink.transcriptState === "failed") {
    return { ...base, line: "Your ink is saved — reading it did not work" };
  }

  if (ink.transcript === null) return { ...base, line: "This page has not been read" };

  const byAuthor = ink.confidence === null && Boolean(ink.transcript);
  return {
    ...base,
    line: byAuthor
      ? "Your wording for this page"
      : `Read at ${Math.round((ink.confidence ?? 0) * 100)}% confidence`,
    detail: (
      <TranscriptCard
        blockId={blockId}
        reading={{ transcript: ink.transcript, confidence: ink.confidence }}
        onCorrected={onCorrected}
      />
    ),
  };
}
