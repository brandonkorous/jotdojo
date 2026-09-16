"use client";

import { useState } from "react";
import { inviteAction } from "@/app/people-actions";

type Made = { inviteId: string; url: string };

/**
 * Invite somebody, and get a link you send yourself. Issue 001.
 *
 * There is no mail library in this repo, so the link IS the delivery: the
 * alternative is a row in a table that nobody ever hears about.
 */
export function InviteForm(
  { spaceId, full, pendingIds }: { spaceId: string; full: boolean; pendingIds: string[] },
) {
  const [email, setEmail] = useState("");
  const [made, setMade] = useState<Made | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const { inviteId, token } = await inviteAction(spaceId, email, "member");
      setMade({ inviteId, url: `${window.location.origin}/invite/${token}` });
      setEmail("");
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (full) {
    return <p className="text-sm jd-quiet">Every seat is taken. Change the plan to add more.</p>;
  }

  // Taking an invite back, or the guest using it, kills the link. Derived here
  // rather than cleared in the handler, because the list is what changed and
  // this component never unmounts. Issue 049.
  const link = made && pendingIds.includes(made.inviteId) ? made.url : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          aria-label="Their email address"
          placeholder="their@email.com"
          className="input input-sm w-56"
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="button" className="btn btn-primary btn-sm"
          disabled={busy || !email.includes("@")} onClick={() => void send()}>
          Make an invite
        </button>
      </div>

      {problem && <p className="mt-2 text-sm text-error">{problem}</p>}

      {link !== null && (
        <div className="mt-3">
          <p className="text-sm">
            Send them this link. It lasts a fortnight and only works for that address.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input readOnly aria-label="The invite link" className="input input-sm w-full max-w-md"
              value={link} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-sm"
              onClick={() => void navigator.clipboard?.writeText(link)}>
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
