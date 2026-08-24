"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveNoteAction } from "@/app/actions";
import { startDraftAction, resumeDraftAction, type Draft } from "@/app/site/actions";

/**
 * An anonymous draft, autosaved. ADR-039, ADR-041.
 *
 * Split out of the hero component at the size limit, and it belongs apart: this
 * is the capture contract -- nothing blocks, nothing is dropped, a failed save
 * keeps the words and retries -- and the component around it is a view.
 */

export type DraftState = "idle" | "saving" | "saved" | "full" | "error";

export function useDraft() {
  const [body, setBody] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);
  // A returning visitor who drew something must see it without picking up the
  // pen again. ADR-047.
  const [hasInk, setHasInk] = useState(false);
  const [state, setState] = useState<DraftState>("idle");
  const [limit, setLimit] = useState<string | null>(null);
  // Counted rather than flagged, so the "sign in to keep this" line shows
  // exactly once without a ref being mutated during render.
  const [saves, setSaves] = useState(0);
  // Whether the resume round trip has come back. Nothing decorative goes on the
  // paper before it, or a returning visitor sees it flash over their own words.
  const [ready, setReady] = useState(false);

  const note = useRef<string | null>(null);
  const revision = useRef(0);
  const resumed = useRef<Promise<Draft | null> | null>(null);
  const starting = useRef<Promise<Draft> | null>(null);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    resumed.current = resumeDraftAction();
    void resumed.current.then((draft) => {
      if (!alive) return;
      setReady(true);
      // Somebody who started typing during the round trip keeps what they typed.
      if (!draft || note.current || pending.current !== null) return;
      note.current = draft.noteId;
      revision.current = draft.revision;
      setNoteId(draft.noteId);
      if (draft.hasInk) setHasInk(true);
      if (draft.body) {
        setBody(draft.body);
        setSaves(2);
        setState("saved");
      }
    });
    return () => { alive = false; };
  }, []);

  /**
   * Minted on first use, never on render.
   *
   * A crawler must not leave a row behind, and neither must somebody who
   * scrolled past. The single in-flight promise is what stops a fast typist
   * minting two drafts before the first request comes back.
   */
  const ensureNote = useCallback(async (): Promise<string> => {
    if (note.current) return note.current;
    await resumed.current;
    if (note.current) return note.current;

    starting.current ??= startDraftAction();
    const draft = await starting.current;
    note.current = draft.noteId;
    revision.current = draft.revision;
    setNoteId(draft.noteId);
    return draft.noteId;
  }, []);

  const flush = useCallback(async (): Promise<void> => {
    if (inFlight.current) return;
    const next = pending.current;
    if (next === null) return;

    pending.current = null;
    inFlight.current = true;
    setState("saving");

    const result = await saveNoteAction(await ensureNote(), next, revision.current);
    inFlight.current = false;

    if (result.ok) {
      revision.current = result.revision;
      setSaves((n) => n + 1);
      setState("saved");
    } else if (result.reason === "limit") {
      setState("full");
      setLimit(result.message);
      return;
    } else {
      // The text is still in the textarea and still queued here. Never dropped.
      if (result.reason === "conflict") revision.current = result.currentRevision;
      pending.current = next;
      setState("error");
      setTimeout(() => void flush(), 3000);
      return;
    }

    if (pending.current !== null) void flush();
  }, [ensureNote]);

  const onChange = useCallback((value: string) => {
    setBody(value);
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  }, [flush]);

  /**
   * A tab closing mid-thought must not eat the last few characters -- the same
   * guarantee the app makes, for somebody who has not signed in. ADR-039.
   */
  useEffect(() => {
    const onHide = () => {
      if (pending.current === null || !note.current) return;
      navigator.sendBeacon?.(
        "/api/capture-beacon",
        new Blob(
          [JSON.stringify({
            noteId: note.current, body: pending.current, revision: revision.current,
          })],
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
  }, []);

  return { body, noteId, hasInk, ready, state, limit, saves, onChange, ensureNote };
}
