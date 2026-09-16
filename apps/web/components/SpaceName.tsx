"use client";

import { useState } from "react";
import { renameSpaceAction } from "@/app/dashboard-actions";

/**
 * A space's name, editable in place by its owner. Issue 003.
 *
 * On the dashboard badge rather than on a space screen, because there is no
 * space screen yet (issue 001) and a name nobody can change is worse than a
 * name in an unglamorous place.
 */
export function SpaceName(
  { id, name, owner, ownedBy }:
  { id: string; name: string; owner: boolean; ownedBy: string | null },
) {
  const [value, setValue] = useState(name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);

  // Two spaces both called Personal read identically to somebody who was let
  // into one of them, and neither person has a reason to rename it. Issue 052.
  if (!owner) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="badge badge-neutral">{value}</span>
        {ownedBy && <span className="text-xs jd-quiet">{ownedBy}&rsquo;s</span>}
      </span>
    );
  }

  const save = async () => {
    const wanted = draft.trim();
    if (!wanted || wanted === value) {
      setDraft(value);
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      setValue(await renameSpaceAction(id, wanted));
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="badge badge-neutral cursor-text"
        title="Rename this space"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value}
      </button>
    );
  }

  return (
    <input
      autoFocus
      aria-label="Space name"
      className="input input-sm w-40"
      maxLength={60}
      disabled={busy}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); void save(); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
    />
  );
}
