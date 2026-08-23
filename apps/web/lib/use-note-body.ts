"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveNoteAction } from "@/app/actions";
import { noteBodyAction } from "@/app/actions/live";
import type { SaveState } from "@/lib/save-state";

/**
 * The typed body of a note: autosaved, and now also followed. ADR-039, ADR-058.
 *
 * Split out of Canvas.tsx at the size limit, and it belongs apart for the same
 * reason use-draft.ts does: this is the capture contract -- nothing blocks,
 * nothing is dropped, a failed save keeps the words and retries -- and the
 * component around it is a view.
 *
 * FOLLOW-WHEN-CLEAN is the rule for the live half, and it is deliberately not a
 * merge. A device with nothing unsaved adopts what another device wrote; a
 * device in the middle of a sentence keeps its sentence and lets the existing
 * revision conflict handle the collision. Two people typing into one paragraph
 * is still not solved here, because solving it means a CRDT and ADR-001 says
 * not yet. What IS solved is the case people actually hit: picking up a
 * different device, and an agent writing into a note you have open.
 */
export function useNoteBody(noteId: string, initialBody: string, initialRevision: number) {
  const [body, setBody] = useState(initialBody);
  const [state, setState] = useState<SaveState>("idle");

  const revision = useRef(initialRevision);
  const pending = useRef<string | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Unsaved work lives here. Nothing arriving from elsewhere may overwrite a
   *  page in this state -- it is the only copy of what somebody just typed. */
  const dirty = useCallback(() => pending.current !== null || inFlight.current, []);

  const flush = useCallback(async () => {
    if (inFlight.current) return;
    const next = pending.current;
    if (next === null) return;

    pending.current = null;
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
      // The text is still in the textarea and still in `pending`. Retry.
      pending.current = next;
      setState("retrying");
      setTimeout(() => void flush(), 3000);
      return;
    }

    if (pending.current !== null) void flush();
  }, [noteId]);

  const onChange = useCallback((value: string) => {
    setBody(value);
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  }, [flush]);

  /**
   * Take what another device saved -- but only if there is nothing to lose.
   *
   * The revision check comes first and costs nothing: most events are this
   * device's own save coming back around, and those need no fetch at all.
   */
  const adopt = useCallback(async (theirs?: number) => {
    if (dirty()) return;
    if (theirs !== undefined && theirs <= revision.current) return;

    const note = await noteBodyAction(noteId);
    // Checked AGAIN after the round trip: somebody can start typing during it,
    // and the copy in their textarea is newer than the one just fetched.
    if (!note || dirty() || note.revision <= revision.current) return;
    revision.current = note.revision;
    setBody(note.body);
    setState("saved");
  }, [noteId, dirty]);

  /** A tab closing mid-thought must not eat the last few characters. */
  useEffect(() => {
    const onHide = () => {
      if (pending.current === null) return;
      navigator.sendBeacon?.(
        "/api/capture-beacon",
        new Blob(
          [JSON.stringify({ noteId, body: pending.current, revision: revision.current })],
          { type: "application/json" },
        ),
      );
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") onHide(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [noteId]);

  return { body, state, onChange, adopt, dirty };
}
