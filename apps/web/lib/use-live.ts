"use client";

import { useEffect, useRef } from "react";
import { subscribeLive, type LiveHandlers } from "./live-client";

/**
 * Live events for one note, as a hook. ADR-058.
 *
 * The handlers are held in a ref rather than in the dependency list, and that
 * is the whole trick: they are rebuilt on every render, and a dependency on
 * them would tear the stream down and reconnect it several times a second while
 * somebody typed. The subscription depends on the note and nothing else.
 */
export function useLiveNote(noteId: string | null, handlers: LiveHandlers): void {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (!noteId) return;
    return subscribeLive(noteId, {
      onInk: (e) => latest.current.onInk?.(e),
      onNote: (e) => latest.current.onNote?.(e),
      onBlock: (e) => latest.current.onBlock?.(e),
      onPresence: () => latest.current.onPresence?.(),
      onResync: () => latest.current.onResync?.(),
    });
  }, [noteId]);
}
