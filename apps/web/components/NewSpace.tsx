"use client";

import { useState } from "react";
import { createSpaceAction } from "@/app/people-actions";

/** A space to share with other people. Issue 001: a personal space seats one,
 *  so there was nowhere to put anybody even once inviting worked. */
export function NewSpace({ covered }: { covered: { name: string; plan: string } | null }) {
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
    <div>
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
      <p className="mt-2 text-sm jd-quiet">{promise(covered)}</p>
    </div>
  );
}

/**
 * What the next space costs, said BEFORE it is made. Issue 051.
 *
 * Kwabena paid for six, pressed this, and landed on a free space seating one
 * with a price list under it. The bill is one bill now (ADR-119) -- and a
 * control that is silent about money is how he got there, so it says so.
 */
function promise(covered: { name: string; plan: string } | null): string {
  if (covered) {
    return `It joins your ${covered.plan} plan — no second bill, the same people,`
      + ` and the same monthly reading shared with ${covered.name}.`;
  }
  return "A new space starts free: one person, and 100 readings a month."
    + " You can put it on a plan afterwards.";
}
