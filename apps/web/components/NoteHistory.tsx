"use client";

import { useState } from "react";
import Link from "next/link";
import type { Cursor, ListedNote } from "@jotacular/domain";
import { olderNotesAction } from "@/app/dashboard-actions";
import { RemoveNote } from "./NoteBin";

/**
 * Every note in the space, a page at a time. Issue 053.
 *
 * The list used to stop at a hard 100 with nothing saying so, which is the
 * shape where a truncated list and a complete one render identically.
 */
export function NoteHistory(
  { spaceId, first, firstCursor }:
  { spaceId: string; first: ListedNote[]; firstCursor: Cursor | null },
) {
  const [notes, setNotes] = useState(first);
  const [cursor, setCursor] = useState(firstCursor);
  const [busy, setBusy] = useState(false);

  const older = async () => {
    if (!cursor) return;
    setBusy(true);
    try {
      const page = await olderNotesAction(spaceId, cursor);
      setNotes((had) => [...had, ...page.notes]);
      setCursor(page.cursor);
    } finally {
      setBusy(false);
    }
  };

  if (notes.length === 0) {
    return <p className="jd-quiet">Nothing here yet. Go have a thought.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-base-300">
        {notes.map((n) => (
          <li key={n.id} className="flex items-center gap-3">
            <Link href={`/n/${n.id}`} className="block min-w-0 flex-1 py-3 hover:bg-base-200">
              <div className="font-head">{n.title ?? "Untitled"}</div>
              <div className="mt-1 line-clamp-1 text-sm jd-quiet">{n.preview}</div>
              <div className="mt-1 text-xs jd-quiet">{n.updatedAt.toLocaleString()}</div>
            </Link>
            <RemoveNote id={n.id} />
          </li>
        ))}
      </ul>

      {cursor && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-sm" disabled={busy}
            onClick={() => void older()}>
            {busy ? "Fetching…" : "Show older"}
          </button>
          <span className="text-sm jd-quiet">
            {notes.length} so far, and there are older ones.
          </span>
        </div>
      )}
    </>
  );
}
