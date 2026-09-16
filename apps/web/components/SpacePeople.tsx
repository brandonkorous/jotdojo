"use client";

import { useTransition } from "react";
import type { MemberSummary, InviteSummary, Seats } from "@jotacular/domain";
import { removeMemberAction, revokeInviteAction } from "@/app/people-actions";
import { InviteForm } from "./InviteForm";

export type SpacePeopleProps = {
  spaceId: string;
  name: string;
  /** Whose it is, when it is not yours. Two sections both headed Personal are
   *  the same section to a member. Issue 052. */
  ownedBy: string | null;
  seats: Seats;
  members: MemberSummary[];
  invites: InviteSummary[];
  owner: boolean;
};

/**
 * Who is in one space, and how to change that. Issue 001.
 *
 * A member sees the list and no controls, rather than controls that will
 * refuse them -- the same rule Account's other sections already follow.
 */
export function SpacePeople(p: SpacePeopleProps) {
  const [busy, start] = useTransition();
  const pending = p.invites.filter((i) => !i.acceptedAt && !i.revokedAt && i.expiresAt > new Date());

  return (
    <div className="mb-6 rounded-box border border-base-300 p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-head text-lg">{p.name}</h3>
        {p.ownedBy && <span className="text-sm jd-quiet">{p.ownedBy}&rsquo;s</span>}
        <span className="text-sm jd-quiet">
          {p.seats.taken} of {p.seats.seats} {p.seats.seats === 1 ? "seat" : "seats"} taken
        </span>
      </div>

      <ul className="mt-3 divide-y divide-base-300">
        {p.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 break-words text-sm">
              {m.displayName ?? m.email}
              <span className="ml-2 jd-quiet">{m.role}</span>
            </span>
            {p.owner && m.role !== "owner" && (
              <button type="button" className="btn btn-ghost btn-xs shrink-0" disabled={busy}
                onClick={() => start(() => { void removeMemberAction(p.spaceId, m.userId); })}>
                Take out
              </button>
            )}
          </li>
        ))}
        {pending.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 break-words text-sm jd-quiet">
              {i.email} — invited, not in yet
            </span>
            {p.owner && (
              <button type="button" className="btn btn-ghost btn-xs shrink-0" disabled={busy}
                onClick={() => start(() => { void revokeInviteAction(i.id); })}>
                Take it back
              </button>
            )}
          </li>
        ))}
      </ul>

      {p.owner && (
        <div className="mt-4">
          <InviteForm spaceId={p.spaceId} full={p.seats.left <= 0}
            pendingIds={pending.map((i) => i.id)} />
        </div>
      )}
    </div>
  );
}
