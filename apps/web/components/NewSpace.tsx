"use client";

import { useState } from "react";
import { createSpaceAction } from "@/app/people-actions";

/** A space to share with other people. Issue 001: a personal space seats one,
 *  so there was nowhere to put anybody even once inviting worked. */
export function NewSpace() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    try {
      await createSpaceAction(name.trim(), "family");
      setName("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        aria-label="What to call it"
        placeholder="The Okonkwo house"
        className="input input-sm w-56"
        maxLength={60}
        value={name}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="button" className="btn btn-sm" disabled={busy || !name.trim()}
        onClick={() => void make()}>
        Make a shared space
      </button>
    </div>
  );
}
